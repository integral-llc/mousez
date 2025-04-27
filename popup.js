// popup.js
document.addEventListener('DOMContentLoaded', function() {
  // UI Elements
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusDiv = document.getElementById('status');
  const clickProbabilitySlider = document.getElementById('clickProbability');
  const clickProbabilityValue = document.getElementById('clickProbabilityValue');
  const movementIntervalSlider = document.getElementById('movementInterval');
  const movementIntervalValue = document.getElementById('movementIntervalValue');
  const movementStepsSlider = document.getElementById('movementSteps');
  const movementStepsValue = document.getElementById('movementStepsValue');
  const runInBackgroundCheckbox = document.getElementById('runInBackground');
  const showTitleIndicatorCheckbox = document.getElementById('showTitleIndicator');
  
  // Schedule elements
  const scheduleNone = document.getElementById('scheduleNone');
  const scheduleDuration = document.getElementById('scheduleDuration');
  const scheduleTime = document.getElementById('scheduleTime');
  const durationInputs = document.getElementById('durationInputs');
  const timeInputs = document.getElementById('timeInputs');
  const durationMinutes = document.getElementById('durationMinutes');
  const stopTime = document.getElementById('stopTime');
  const scheduleStatus = document.getElementById('scheduleStatus');
  
  // Default configuration
  let config = {
    clickProbability: 0.3,
    minInterval: 500,
    maxInterval: 3000,
    minMoveSteps: 5,
    maxMoveSteps: 15,
    scheduleType: 'none',
    durationMinutes: 30,
    stopTime: null,
    runInBackground: true,
    showTitleIndicator: true
  };
  
  // Scheduled stop timer
  let scheduledStopTimer = null;
  
  // Update UI with configuration values
  function updateUI() {
    clickProbabilitySlider.value = config.clickProbability * 100;
    clickProbabilityValue.textContent = `${Math.round(config.clickProbability * 100)}%`;
    
    // Map interval values to slider (0-100)
    const intervalRange = 5000; // Max possible interval
    const intervalValue = ((config.minInterval + config.maxInterval) / 2) / intervalRange * 100;
    movementIntervalSlider.value = intervalValue;
    movementIntervalValue.textContent = `${config.minInterval/1000}s - ${config.maxInterval/1000}s`;
    
    // Map steps values to slider (0-100)
    const stepsRange = 30; // Max possible steps
    const stepsValue = ((config.minMoveSteps + config.maxMoveSteps) / 2) / stepsRange * 100;
    movementStepsSlider.value = stepsValue;
    movementStepsValue.textContent = `${config.minMoveSteps} - ${config.maxMoveSteps} steps`;
    
    // Update checkbox states
    runInBackgroundCheckbox.checked = config.runInBackground;
    showTitleIndicatorCheckbox.checked = config.showTitleIndicator;
    
    // Update schedule UI
    if (config.scheduleType === 'duration') {
      scheduleDuration.checked = true;
      durationMinutes.value = config.durationMinutes;
      durationInputs.style.display = 'block';
      timeInputs.style.display = 'none';
    } else if (config.scheduleType === 'time') {
      scheduleTime.checked = true;
      if (config.stopTime) {
        stopTime.value = config.stopTime;
      } else {
        // Set default to current time + 1 hour
        const now = new Date();
        now.setHours(now.getHours() + 1);
        stopTime.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      }
      durationInputs.style.display = 'none';
      timeInputs.style.display = 'block';
    } else {
      scheduleNone.checked = true;
      durationInputs.style.display = 'none';
      timeInputs.style.display = 'none';
    }
  }
  
  // Load tab-specific configuration when popup opens
  loadConfig();
  
  // Load configuration from storage
  function loadConfig() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length === 0) return;
      
      const activeTabId = tabs[0].id;
      const configKey = `tabConfig_${activeTabId}`;
      
      chrome.storage.local.get([configKey, 'randomMouseConfig'], function(result) {
        // First try tab-specific config
        if (result[configKey]) {
          config = result[configKey];
        } 
        // Fall back to global config if available
        else if (result.randomMouseConfig) {
          config = result.randomMouseConfig;
        }
        // Otherwise use defaults (already set)
        
        updateUI();
        
        // If no tab-specific config exists, store the current one
        if (!result[configKey]) {
          saveConfig();
        }
      });
    });
  }
  
  // Save configuration to storage
  function saveConfig() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length === 0) return;
      
      const activeTabId = tabs[0].id;
      const configKey = `tabConfig_${activeTabId}`;
      
      // Save tab-specific config
      chrome.storage.local.set({ [configKey]: config });
    });
  }
  
  // Update configuration from UI values
  function updateConfigFromUI() {
    config.clickProbability = clickProbabilitySlider.value / 100;
    
    // Map slider value (0-100) to interval range
    const intervalValue = movementIntervalSlider.value / 100;
    config.minInterval = Math.round(300 + intervalValue * 1200); // 300ms to 1500ms
    config.maxInterval = Math.round(config.minInterval + 1000 + intervalValue * 3000); // 1300ms to 5500ms
    
    // Map slider value (0-100) to steps range
    const stepsValue = movementStepsSlider.value / 100;
    config.minMoveSteps = Math.round(3 + stepsValue * 7); // 3 to 10
    config.maxMoveSteps = Math.round(config.minMoveSteps + 5 + stepsValue * 15); // 8 to 30
    
    // Update checkbox settings
    config.runInBackground = runInBackgroundCheckbox.checked;
    config.showTitleIndicator = showTitleIndicatorCheckbox.checked;
    
    // Update schedule configuration
    if (scheduleDuration.checked) {
      config.scheduleType = 'duration';
      config.durationMinutes = parseInt(durationMinutes.value) || 30;
    } else if (scheduleTime.checked) {
      config.scheduleType = 'time';
      config.stopTime = stopTime.value;
    } else {
      config.scheduleType = 'none';
    }
    
    // Update UI to reflect actual values
    updateUI();
    
    // Save to storage
    saveConfig();
  }
  
  // Handle UI events
  clickProbabilitySlider.addEventListener('input', function() {
    const value = this.value / 100;
    config.clickProbability = value;
    clickProbabilityValue.textContent = `${Math.round(value * 100)}%`;
  });
  
  clickProbabilitySlider.addEventListener('change', updateConfigFromUI);
  movementIntervalSlider.addEventListener('change', updateConfigFromUI);
  movementStepsSlider.addEventListener('change', updateConfigFromUI);
  runInBackgroundCheckbox.addEventListener('change', updateConfigFromUI);
  showTitleIndicatorCheckbox.addEventListener('change', updateConfigFromUI);
  
  // Movement interval slider live update
  movementIntervalSlider.addEventListener('input', function() {
    const value = this.value / 100;
    const minInterval = Math.round(300 + value * 1200);
    const maxInterval = Math.round(minInterval + 1000 + value * 3000);
    movementIntervalValue.textContent = `${(minInterval/1000).toFixed(1)}s - ${(maxInterval/1000).toFixed(1)}s`;
  });
  
  // Movement steps slider live update
  movementStepsSlider.addEventListener('input', function() {
    const value = this.value / 100;
    const minSteps = Math.round(3 + value * 7);
    const maxSteps = Math.round(minSteps + 5 + value * 15);
    movementStepsValue.textContent = `${minSteps} - ${maxSteps} steps`;
  });
  
  // Schedule option change events
  scheduleNone.addEventListener('change', function() {
    if (this.checked) {
      durationInputs.style.display = 'none';
      timeInputs.style.display = 'none';
      updateConfigFromUI();
    }
  });
  
  scheduleDuration.addEventListener('change', function() {
    if (this.checked) {
      durationInputs.style.display = 'block';
      timeInputs.style.display = 'none';
      updateConfigFromUI();
    }
  });
  
  scheduleTime.addEventListener('change', function() {
    if (this.checked) {
      durationInputs.style.display = 'none';
      timeInputs.style.display = 'block';
      updateConfigFromUI();
    }
  });
  
  durationMinutes.addEventListener('change', updateConfigFromUI);
  stopTime.addEventListener('change', updateConfigFromUI);
  
  // Check if automation is running and update UI
  function checkStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length === 0) return;
      
      const activeTabId = tabs[0].id;
      
      chrome.runtime.sendMessage({ 
        type: 'getStatus', 
        tabId: activeTabId 
      }, function(response) {
        updateStatus(response.isRunning);
        
        // If running, check if there's a scheduled stop
        if (response.isRunning && response.scheduledStopTime) {
          updateScheduleStatusDisplay(response.scheduledStopTime);
        } else {
          scheduleStatus.textContent = '';
        }
      });
    });
  }
  
  // Update UI based on automation status
  function updateStatus(isRunning) {
    if (isRunning) {
      statusDiv.textContent = 'Status: Running';
      statusDiv.className = 'status running';
      startBtn.disabled = true;
      stopBtn.disabled = false;
      
      // Disable all controls except Stop button
      clickProbabilitySlider.disabled = true;
      movementIntervalSlider.disabled = true;
      movementStepsSlider.disabled = true;
      scheduleNone.disabled = true;
      scheduleDuration.disabled = true;
      scheduleTime.disabled = true;
      durationMinutes.disabled = true;
      stopTime.disabled = true;
      runInBackgroundCheckbox.disabled = true;
      showTitleIndicatorCheckbox.disabled = true;
      
      // Add visual indication of disabled state
      document.querySelectorAll('.settings input, .schedule-container input, .checkbox-container input').forEach(input => {
        input.classList.add('disabled-control');
      });
      
      // Add visual indication to labels and text
      document.querySelectorAll('.setting-row label, .schedule-option label, .range-values span, .value-display, .schedule-title, .checkbox-container label').forEach(el => {
        el.classList.add('disabled-text');
      });
      
    } else {
      statusDiv.textContent = 'Status: Stopped';
      statusDiv.className = 'status stopped';
      startBtn.disabled = false;
      stopBtn.disabled = true;
      scheduleStatus.textContent = '';
      
      // Re-enable all controls
      clickProbabilitySlider.disabled = false;
      movementIntervalSlider.disabled = false;
      movementStepsSlider.disabled = false;
      scheduleNone.disabled = false;
      scheduleDuration.disabled = false;
      scheduleTime.disabled = false;
      durationMinutes.disabled = false;
      stopTime.disabled = false;
      runInBackgroundCheckbox.disabled = false;
      showTitleIndicatorCheckbox.disabled = false;
      
      // Remove visual indication of disabled state
      document.querySelectorAll('.settings input, .schedule-container input, .checkbox-container input').forEach(input => {
        input.classList.remove('disabled-control');
      });
      
      // Remove visual indication from labels and text
      document.querySelectorAll('.setting-row label, .schedule-option label, .range-values span, .value-display, .schedule-title, .checkbox-container label').forEach(el => {
        el.classList.remove('disabled-text');
      });
      
      // Clear any existing schedule timer
      if (scheduledStopTimer) {
        clearTimeout(scheduledStopTimer);
        scheduledStopTimer = null;
      }
    }
  }
  
  // Update the schedule status display
  function updateScheduleStatusDisplay(scheduledTime) {
    if (!scheduledTime) {
      scheduleStatus.textContent = '';
      return;
    }
    
    const stopDate = new Date(scheduledTime);
    const now = new Date();
    const diffMs = stopDate - now;
    
    if (diffMs <= 0) {
      scheduleStatus.textContent = 'Scheduled stop time has passed';
      return;
    }
    
    // Format remaining time in HH:MM:SS
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    // Build timer string, omitting parts that are zero
    let timerStr = '';
    if (hours > 0) {
      timerStr += `${hours}h `;
    }
    if (minutes > 0 || hours > 0) {
      timerStr += `${minutes}m `;
    }
    timerStr += `${seconds}s`;
    
    scheduleStatus.textContent = `Stopping in ${timerStr}`;
    
    // Update the status every second
    setTimeout(() => {
      if (statusDiv.className.includes('running')) {
        updateScheduleStatusDisplay(scheduledTime);
      }
    }, 1000);
  }
  
  // Set up scheduled stop
  function setupScheduledStop() {
    if (config.scheduleType === 'none') {
      return null;
    }
    
    let scheduledStopTime;
    
    if (config.scheduleType === 'duration') {
      // Calculate stop time based on duration
      const durationMs = parseInt(config.durationMinutes) * 60 * 1000;
      scheduledStopTime = new Date(Date.now() + durationMs);
      
      // Set up the timer
      scheduledStopTimer = setTimeout(() => {
        stopAutomation();
      }, durationMs);
      
    } else if (config.scheduleType === 'time') {
      // Parse the time string
      const [hours, minutes] = config.stopTime.split(':').map(Number);
      scheduledStopTime = new Date();
      scheduledStopTime.setHours(hours, minutes, 0, 0);
      
      // If the time is in the past, add a day
      if (scheduledStopTime < new Date()) {
        scheduledStopTime.setDate(scheduledStopTime.getDate() + 1);
      }
      
      // Calculate ms until stop time
      const timeUntilStop = scheduledStopTime - new Date();
      
      // Set up the timer
      scheduledStopTimer = setTimeout(() => {
        stopAutomation();
      }, timeUntilStop);
    }
    
    // Return the scheduled stop time for background script
    return scheduledStopTime ? scheduledStopTime.getTime() : null;
  }
  
  // Function to stop automation
  function stopAutomation() {
    // Send stop message to the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          type: 'stopAutomation',
          tabId: tabs[0].id
        });
        
        // Also send message to background script
        chrome.runtime.sendMessage(
          { 
            type: 'stopAutomation',
            tabId: tabs[0].id
          },
          function(response) {
            if (response && response.success) {
              updateStatus(false);
            }
          }
        );
      }
    });
  }
  
  // Start automation
  startBtn.addEventListener('click', function() {
    // Set up scheduled stop if configured
    const scheduledStopTime = setupScheduledStop();
    
    // Update the UI with scheduled stop info
    if (scheduledStopTime) {
      updateScheduleStatusDisplay(scheduledStopTime);
    }
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length > 0) {
        const activeTabId = tabs[0].id;
        
        // Make sure config is updated before sending
        updateConfigFromUI();
        
        chrome.tabs.sendMessage(
          activeTabId,
          { 
            type: 'startAutomation', 
            config: config,
            scheduledStopTime: scheduledStopTime 
          }
        );
        
        // Also send to background script
        chrome.runtime.sendMessage(
          { 
            type: 'startAutomation', 
            config: config,
            scheduledStopTime: scheduledStopTime,
            tabId: activeTabId
          },
          function(response) {
            if (response && response.success) {
              updateStatus(true);
            } else if (response) {
              statusDiv.textContent = `Error: ${response.error}`;
            }
          }
        );
      }
    });
  });
  
  // Stop automation
  stopBtn.addEventListener('click', function() {
    // Send stop message to the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length > 0) {
        const activeTabId = tabs[0].id;
        chrome.tabs.sendMessage(activeTabId, { 
          type: 'stopAutomation',
          tabId: activeTabId
        });
        
        // Also send message to background script
        chrome.runtime.sendMessage(
          { 
            type: 'stopAutomation',
            tabId: activeTabId
          },
          function(response) {
            if (response && response.success) {
              updateStatus(false);
            }
          }
        );
      }
    });
  });
  
  // Listen for status updates from content script or background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only handle messages for the current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length === 0) return;
      const activeTabId = tabs[0].id;
      
      // If the message has a tabId and it's not for this tab, ignore it
      if (message.tabId && message.tabId !== activeTabId) {
        return;
      }
      
      if (message.type === 'automationStarted') {
        updateStatus(true);
        
        // Update schedule status if there's a scheduled stop time
        if (message.scheduledStopTime) {
          updateScheduleStatusDisplay(message.scheduledStopTime);
        }
      }
      
      if (message.type === 'automationStopped') {
        updateStatus(false);
      }
    });
  });
  
  // Check status when popup opens
  checkStatus();
});