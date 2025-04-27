// background.js
// Track automation state per tab
let runningTabs = {};

// Execute the automation script in all tabs in the current window
function executeInAllTabs(config, scheduledStopTime) {
  chrome.tabs.query({ currentWindow: true }, function(tabs) {
    tabs.forEach(tab => {
      // Skip extension pages and special pages
      if (tab.url.startsWith('chrome-extension://') || 
          tab.url.startsWith('chrome://') || 
          tab.url.startsWith('about:')) {
        return;
      }
      
      // Execute the content script if needed
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: function(config, stopTime, tabId) {
          // This message will be caught by the content script in the tab
          window.postMessage({
            source: 'random-mouse-automation-background',
            type: 'startAutomation',
            config: config,
            scheduledStopTime: stopTime,
            tabId: tabId
          }, '*');
        },
        args: [config, scheduledStopTime, tab.id]
      }).catch(error => {
        // Just silently fail - this is expected in some tabs
      });
      
      // Also try direct message to content script
      chrome.tabs.sendMessage(
        tab.id, 
        { 
          type: 'startAutomation', 
          config: config,
          scheduledStopTime: scheduledStopTime,
          tabId: tab.id
        }
      ).catch(() => {
        // Expected to fail on tabs without content script
      });
    });
  });
}

// Verify tab is actually running
function verifyTabRunning(tabId, callback) {
  if (!tabId) {
    callback(false);
    return;
  }
  
  // Check if we're tracking this tab
  if (!runningTabs[tabId]) {
    callback(false);
    return;
  }
  
  // Verify with the content script
  try {
    chrome.tabs.sendMessage(tabId, { type: 'getStatus' }, function(response) {
      // Check if we got a response and if the content script thinks it's running
      if (response && response.isRunning) {
        callback(true);
      } else {
        // Clean up our tracking since it's not actually running
        delete runningTabs[tabId];
        callback(false);
      }
    });
  } catch (e) {
    // Assume not running if we can't reach the content script
    delete runningTabs[tabId];
    callback(false);
  }
}

// Clean up stale tabs
function cleanupStaleTabs() {
  const tabIds = Object.keys(runningTabs);
  
  tabIds.forEach(tabId => {
    // Convert to number
    const numericTabId = parseInt(tabId);
    
    // Check if tab still exists
    chrome.tabs.get(numericTabId, function(tab) {
      if (chrome.runtime.lastError) {
        // Tab doesn't exist anymore
        delete runningTabs[numericTabId];
        return;
      }
      
      // Verify tab is actually running
      verifyTabRunning(numericTabId, function(isRunning) {
        if (!isRunning) {
          delete runningTabs[numericTabId];
        }
      });
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : message.tabId || null;
  
  if (message.type === 'resetState') {
    // Stop automation in all tabs first
    stopInAllTabs();
    
    // Clear running tabs tracking
    runningTabs = {};
    
    // Send response
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'startAutomation') {
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab ID specified' });
      return true;
    }
    
    // Clean up stale tabs before checking
    cleanupStaleTabs();
    
    // Verify the tab is actually already running
    if (runningTabs[tabId]) {
      verifyTabRunning(tabId, function(isActuallyRunning) {
        if (isActuallyRunning) {
          sendResponse({ success: false, error: 'Automation is already running on this tab' });
        } else {
          startAutomationInTab(tabId, message.config, message.scheduledStopTime, sendResponse);
        }
      });
      return true;
    }
    
    // Start automation in the tab
    startAutomationInTab(tabId, message.config, message.scheduledStopTime, sendResponse);
    return true; // Required for async sendResponse
  }

  if (message.type === 'stopAutomation') {
    // If no specific tab ID, use the sender tab ID or stop in the active tab
    if (!tabId) {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs.length > 0) {
          stopAutomation(tabs[0].id);
        }
      });
    } else {
      stopAutomation(tabId);
    }
    
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'getStatus') {
    // If a specific tabId is provided, get status for that tab
    if (message.tabId) {
      const status = runningTabs[message.tabId] || { isRunning: false };
      sendResponse(status);
    } else {
      // Otherwise check the active tab
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs.length > 0) {
          const activeTabId = tabs[0].id;
          const status = runningTabs[activeTabId] || { isRunning: false };
          sendResponse(status);
        } else {
          sendResponse({ isRunning: false });
        }
      });
    }
    return true;
  }
  
  if (message.type === 'automationStarted') {
    // Store the running state for this tab
    if (tabId) {
      runningTabs[tabId] = runningTabs[tabId] || {
        isRunning: true,
        scheduledStopTime: message.scheduledStopTime || null
      };
      
      // Forward status to the popup if it's open
      chrome.runtime.sendMessage({
        type: 'automationStarted',
        tabId: tabId,
        scheduledStopTime: message.scheduledStopTime
      });
    }
    return true;
  }
  
  if (message.type === 'automationStopped') {
    // Remove the tab from running tabs
    if (tabId && runningTabs[tabId]) {
      delete runningTabs[tabId];
    }
    
    // Forward status to the popup
    chrome.runtime.sendMessage({
      type: 'automationStopped',
      tabId: tabId
    });
    return true;
  }

  if (message.type === 'getTabId') {
    // Get the sender tab ID
    sendResponse({ tabId: tabId });
    return true;
  }
});

// Handle tab removal - stop automation if the tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (runningTabs[tabId]) {
    stopAutomation(tabId);
  }
});

// Execute scheduled stop for a specific tab
function executeScheduledStop(tabId) {
  stopAutomation(tabId);
  
  // Notify content script in ONLY this tab
  chrome.tabs.sendMessage(tabId, { 
    type: 'stopAutomation',
    tabId: tabId
  });
  
  // Broadcast status update with specific tabId
  chrome.runtime.sendMessage({ 
    type: 'automationStopped',
    tabId: tabId
  });
}

// Stop automation for a specific tab
function stopAutomation(tabId) {
  if (!tabId) return;
  
  // Clean up tab state
  if (runningTabs[tabId]) {
    // Clear any scheduled stop timer
    if (runningTabs[tabId].scheduledStopTimer) {
      clearTimeout(runningTabs[tabId].scheduledStopTimer);
    }
    
    // Remove from running tabs
    delete runningTabs[tabId];
  }

  // Only stop in the requested tab
  try {
    chrome.tabs.sendMessage(tabId, { 
      type: 'stopAutomation',
      tabId: tabId 
    });
  } catch (e) {
    // Silently fail if tab can't be reached
  }
  
  // Update the storage for the tab
  chrome.storage.local.set({ [`automationActive_${tabId}`]: false });
}

// Stop automation in all tabs
function stopInAllTabs() {
  chrome.tabs.query({ currentWindow: true }, function(tabs) {
    tabs.forEach(tab => {
      try {
        chrome.tabs.sendMessage(tab.id, { 
          type: 'stopAutomation',
          tabId: tab.id
        });
      } catch (e) {
        // Silently fail
      }
    });
  });
}

// Start automation in a specific tab
function startAutomationInTab(tabId, config, scheduledStopTime, sendResponse) {
  // Get the active tab in the current window
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs.length === 0) {
      sendResponse({ success: false, error: 'No active tab found' });
      return;
    }
    
    // Store the tab information
    const targetTabId = tabId || tabs[0].id;
    runningTabs[targetTabId] = {
      isRunning: true,
      scheduledStopTime: scheduledStopTime || null,
      scheduledStopTimer: null,
      config: config || {}
    };
    
    // Handle scheduled stop
    if (scheduledStopTime) {
      const scheduledTime = scheduledStopTime;
      
      // Calculate ms until stop time
      const timeUntilStop = scheduledTime - Date.now();
      
      // Set up the timer
      runningTabs[targetTabId].scheduledStopTimer = setTimeout(() => {
        executeScheduledStop(targetTabId);
      }, timeUntilStop);
    }
    
    // If we should run in all tabs, execute in all tabs
    if (config && config.runInBackground) {
      executeInAllTabs(config, scheduledStopTime);
    } else {
      // Otherwise just execute in the active tab
      chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        function: function(config, stopTime, tabId) {
          // This message will be caught by the content script in the tab
          window.postMessage({
            source: 'random-mouse-automation-background',
            type: 'startAutomation',
            config: config,
            scheduledStopTime: stopTime,
            tabId: tabId
          }, '*');
          return { success: true };
        },
        args: [config, scheduledStopTime, targetTabId]
      }).then(results => {
        sendResponse({ success: true, results: results });
      }).catch(error => {
        delete runningTabs[targetTabId];
        sendResponse({ success: false, error: error.message });
      });
    }
  });
}