// content.js

// Global variables
let isRunning = false;
let cursorElement = null;
let forceStop = false;
let config = {
  clickProbability: 0.3,
  minInterval: 500,
  maxInterval: 3000,
  minMoveSteps: 5,
  maxMoveSteps: 15,
  showTitleIndicator: true,
  runInBackground: true
};

// Function to add the cursor element using the SVG file
function addCursorElement() {
  // Remove existing cursor if it exists
  if (cursorElement) {
    cursorElement.remove();
    cursorElement = null;
  }
  
  cursorElement = document.createElement('div');
  cursorElement.id = 'rainbow-mouse-cursor';
  cursorElement.style.cssText = `
    position: fixed;
    width: 50px;
    height: 50px;
    pointer-events: none;
    z-index: 9999;
    top: 0;
    left: 0;
    transform: translate(-50%, -50%);
    will-change: left, top;
  `;
  
  // Get the URL for the SVG file
  const svgUrl = chrome.runtime.getURL('assets/cursor.svg');
  
  // Load the SVG content
  fetch(svgUrl)
    .then(response => response.text())
    .then(svgContent => {
      if (cursorElement) {
        cursorElement.innerHTML = svgContent;
      }
    })
    .catch(error => {
      // Fallback to a simple cursor if SVG fails to load
      if (cursorElement) {
        cursorElement.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
        cursorElement.style.borderRadius = '50%';
      }
    });
  
  document.body.appendChild(cursorElement);
  return { element: cursorElement };
}

// Function to generate a random point within the viewport
function getRandomPoint() {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  
  // Use 90% of the viewport to avoid edge elements
  const x = Math.random() * (viewportWidth * 0.9) + (viewportWidth * 0.05);
  const y = Math.random() * (viewportHeight * 0.9) + (viewportHeight * 0.05);
  
  return { x: Math.round(x), y: Math.round(y) };
}

// Function to smoothly move the mouse cursor with human-like behavior
function smoothMouseMove(startX, startY, endX, endY, steps, callback) {
  if (!cursorElement) {
    const { element } = addCursorElement();
    cursorElement = element;
  }
  
  // Create a bezier curve path for more natural movement
  // Add a control point that's slightly off the direct path
  const angles = [Math.PI/6, Math.PI/4, Math.PI/3, -Math.PI/6, -Math.PI/4, -Math.PI/3];
  const angle = angles[Math.floor(Math.random() * angles.length)];
  
  const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  
  // Control point offset (perpendicular to direction)
  const offsetMultiplier = Math.random() * 0.5 + 0.1; // Between 0.1 and 0.6
  const controlX = midX + Math.cos(angle) * distance * offsetMultiplier;
  const controlY = midY + Math.sin(angle) * distance * offsetMultiplier;
  
  // Occasionally add a slight overshoot
  let targetX = endX;
  let targetY = endY;
  const shouldOvershoot = Math.random() < 0.3; // 30% chance to overshoot
  
  if (shouldOvershoot && distance > 100) {
    const overshootDistance = Math.random() * 20 + 10; // 10-30px overshoot
    const dx = endX - startX;
    const dy = endY - startY;
    const normalizedDx = dx / distance;
    const normalizedDy = dy / distance;
    
    targetX = endX + normalizedDx * overshootDistance;
    targetY = endY + normalizedDy * overshootDistance;
    
    // Add extra steps for overshoot and return
    steps += 5;
  }
  
  let currentStep = 0;
  
  // Function to compute point on a quadratic bezier curve
  function bezierPoint(t, p0, p1, p2) {
    const mt = 1 - t;
    return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
  }
  
  // Variable speed: slower at start and end, faster in the middle
  function getStepDelay(step) {
    // Base delay between 15-25ms for smoother movement
    const baseDelay = Math.random() * 10 + 15;
    
    // Normalized position in the movement (0 to 1)
    const t = step / steps;
    
    // Slower at beginning and end (ease in/out)
    if (t < 0.2 || t > 0.8) {
      return baseDelay * 1.5;
    } else {
      return baseDelay;
    }
  }
  
  function moveStep() {
    if (currentStep <= steps && isRunning) {
      // Calculate t value (0 to 1)
      let t;
      
      if (shouldOvershoot && currentStep > steps - 5) {
        // For overshoot correction, move back to the actual target
        const correctionStep = currentStep - (steps - 5);
        t = correctionStep / 5;
        
        // Linear movement back to target
        const x = targetX + (endX - targetX) * t;
        const y = targetY + (endY - targetY) * t;
        
        if (cursorElement) {
          cursorElement.style.left = x + 'px';
          cursorElement.style.top = y + 'px';
        }
      } else {
        // Normal bezier movement
        t = currentStep / (shouldOvershoot ? (steps - 5) : steps);
        
        // Calculate position along bezier curve
        const x = bezierPoint(t, startX, controlX, shouldOvershoot ? targetX : endX);
        const y = bezierPoint(t, startY, controlY, shouldOvershoot ? targetY : endY);
        
        // Add small "hand tremor" effect
        const tremor = Math.random() < 0.3 ? Math.random() * 2 - 1 : 0; // Occasional small tremor
        
        // Move the cursor element
        if (cursorElement) {
          cursorElement.style.left = (x + tremor) + 'px';
          cursorElement.style.top = (y + tremor) + 'px';
        }
        
        // Update debug display
        if (document.getElementById('automation-debug')) {
          document.getElementById('automation-debug').textContent = 
            `Position: ${Math.round(x)},${Math.round(y)} | Step: ${currentStep}/${steps}`;
        }
        
        // Dispatch events
        const element = document.elementFromPoint(x, y);
        if (element) {
          const mousemoveEvent = new MouseEvent('mousemove', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y
          });
          
          element.dispatchEvent(mousemoveEvent);
          
          // Dispatch mouseenter/mouseleave events as needed
          if (currentStep > 0) {
            // Previous position calculation omitted for brevity
            // This would need logic similar to the bezier calculation above
          }
        }
      }
      
      currentStep++;
      // Variable delay for more natural movement
      setTimeout(moveStep, getStepDelay(currentStep));
    } else if (callback && isRunning) {
      callback(endX, endY);
    }
  }
  
  moveStep();
}

// More robust simulateMouseClick function
function simulateMouseClick(x, y, element) {
  return;
  try {
    // Check if the element is a link, button, or other interactive element we want to avoid
    if (!element) {
      element = document.elementFromPoint(x, y);
    }
    
    let shouldClick = true;
    
    if (element) {
      try {
        // Check if this is an element we should avoid clicking
        if (hasClickHandler(element)) {
          shouldClick = false;
        }
        
        // Also check parent elements to avoid clicking on nested elements within interactive elements
        if (shouldClick) {
          let parent = element.parentElement;
          let level = 0;
          while (parent && level < 5) { // Check more parent levels
            if (hasClickHandler(parent)) {
              shouldClick = false;
              break;
            }
            parent = parent.parentElement;
            level++;
          }
        }
      } catch (error) {
        // Continue with the click anyway if there's an error in this section
        shouldClick = true;
      }
    }
    
    // Create a visible click effect
    try {
      const clickEffect = document.createElement('div');
      clickEffect.id = 'click-effect-' + Date.now();
      clickEffect.style.cssText = `
        position: fixed;
        top: ${y}px;
        left: ${x}px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: rgba(255, 0, 0, 0.7);
        transform: translate(-50%, -50%) scale(0);
        z-index: 10000;
        pointer-events: none;
        animation: clickAnimation 0.5s ease-out forwards;
      `;
      
      // Add the keyframe animation if it doesn't exist
      if (!document.getElementById('click-animation-style')) {
        const style = document.createElement('style');
        style.id = 'click-animation-style';
        style.textContent = `
          @keyframes clickAnimation {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
            50% { transform: translate(-50%, -50%) scale(1.5); opacity: 0.7; }
            100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }
      
      document.body.appendChild(clickEffect);
      
      // Remove the effect after animation completes
      setTimeout(() => {
        if (clickEffect && clickEffect.parentNode) {
          clickEffect.parentNode.removeChild(clickEffect);
        }
      }, 500);
    } catch (error) {
      // Continue even if click effect fails
    }
    
    // Also try the SVG animation if available
    try {
      if (cursorElement) {
        // Add a visible pulse to the cursor itself
        cursorElement.style.transition = 'transform 0.1s ease';
        cursorElement.style.transform = 'translate(-50%, -50%) scale(1.3)';
        setTimeout(() => {
          if (cursorElement) {
            cursorElement.style.transform = 'translate(-50%, -50%) scale(1)';
          }
        }, 100);
        
        // Try the SVG animation too if available
        const clickTrigger = cursorElement.querySelector('#click-trigger');
        if (clickTrigger) {
          try {
            clickTrigger.beginElement();
          } catch (e) {
            // Continue even if animation fails
          }
        }
      }
    } catch (error) {
      // Continue even if animation fails
    }
    
    // If we decided to skip the click, return here
    if (!shouldClick || !element) {
      return false;
    }
    
    try {
      // Create mouse events for hover
      const mouseoverEvent = new MouseEvent('mouseover', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y
      });
      
      // Mouse down event
      const mousedownEvent = new MouseEvent('mousedown', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: 0
      });
      
      // Mouse up event
      const mouseupEvent = new MouseEvent('mouseup', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: 0
      });
      
      // Click event
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: 0
      });
      
      // Dispatch the events in sequence
      element.dispatchEvent(mouseoverEvent);
      element.dispatchEvent(mousedownEvent);
      element.dispatchEvent(mouseupEvent);
      element.dispatchEvent(clickEvent);
      
      return true;
    } catch (error) {
      return false;
    }
  } catch (outerError) {
    // Catch any error that might have slipped through
    return false;
  }
}

// Function to perform a random mouse action
function performRandomMouseAction() {
  if (!isRunning) {
    return;
  }
  
  // Get current mouse position or use a default
  const currentX = window.lastMouseX || window.innerWidth / 2;
  const currentY = window.lastMouseY || window.innerHeight / 2;
  
  // Get a random point
  const point = getRandomPoint();
  const nextPosition = {
    element: document.elementFromPoint(point.x, point.y),
    x: point.x,
    y: point.y
  };
  
  // Random number of steps for smooth movement
  const distance = Math.sqrt(
    Math.pow(nextPosition.x - currentX, 2) + 
    Math.pow(nextPosition.y - currentY, 2)
  );
  const baseSteps = Math.floor(distance / 10) + 5; // More steps for longer distances
  const steps = Math.max(
    config.minMoveSteps,
    Math.min(
      config.maxMoveSteps,
      baseSteps + Math.floor(Math.random() * 10)
    )
  );
  
  // Move the mouse
  smoothMouseMove(
    currentX, 
    currentY, 
    nextPosition.x, 
    nextPosition.y, 
    steps,
    function(x, y) {
      // Save the last position
      window.lastMouseX = x;
      window.lastMouseY = y;
      
      // Decide whether to click
      if (Math.random() < config.clickProbability) {
        simulateMouseClick(x, y, nextPosition.element);
      } 
      
      // Update in performRandomMouseAction where it schedules the next action
      if (isRunning) {
        const nextInterval = Math.floor(Math.random() * 
          (config.maxInterval - config.minInterval + 1)) + config.minInterval;
        
        // Store the timeout ID so we can cancel it if needed
        window.pendingAutomationTimeout = setTimeout(performRandomMouseAction, nextInterval);
      } 
    }
  );
}

// Store active state in storage to handle tab switching
function updateAutomationState(isActive) {
  // Get the current tab ID
  chrome.runtime.sendMessage({ type: 'getTabId' }, function(response) {
    if (response && response.tabId) {
      const tabId = response.tabId;
      // Store state with tab ID as part of the key
      chrome.storage.local.set({ 
        [`automationActive_${tabId}`]: isActive,
        // Store additional info if active
        ...(isActive ? {
          [`automationConfig_${tabId}`]: config,
          [`automationStopTime_${tabId}`]: window.scheduledStopTime
        } : {})
      });
    }
  });
}

// Start the automation
function startAutomation(customConfig = null) {
  if (isRunning) return; // Don't start if already running
  
  // Use provided config or default global config
  config = customConfig || getDefaultConfig();
  
  // Set up the automation elements
  const cursorResult = addCursorElement();
  cursorElement = cursorResult.element;
  
  // Store initial position
  window.lastMouseX = window.innerWidth / 2;
  window.lastMouseY = window.innerHeight / 2;
  
  isRunning = true;
  
  // Calculate and store the stop time if duration is set
  if (config.durationMinutes > 0) {
    const stopTimeMs = Date.now() + (config.durationMinutes * 60 * 1000);
    window.scheduledStopTime = new Date(stopTimeMs).toISOString();
    
    // Set up the timer UI
    const timerElement = document.createElement('div');
    timerElement.id = 'automation-timer';
    timerElement.style.cssText = `
      position: fixed;
      top: 25px;
      right: 0;
      background: rgba(0, 0, 0, 0.5);
      color: white;
      padding: 5px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 12px;
      border-radius: 0 0 0 5px;
      pointer-events: none;
    `;
    document.body.appendChild(timerElement);
    updateTimerDisplay();
    
    // Schedule a call to stop automation
    window.scheduledStopTimeout = setTimeout(() => {
      stopAutomation();
    }, config.durationMinutes * 60 * 1000);
  }
  
  // Add status indicator
  const indicator = document.createElement('div');
  indicator.id = 'automation-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    background: rgba(255, 0, 0, 0.4);
    color: white;
    padding: 5px;
    z-index: 10000;
    font-family: Arial, sans-serif;
    font-size: 14px;
    border-radius: 0 0 0 5px;
    pointer-events: none;
  `;
  indicator.textContent = 'Automation Running';
  document.body.appendChild(indicator);
  
  // Add debug display
  const debugElement = document.createElement('div');
  debugElement.id = 'automation-debug';
  debugElement.style.cssText = `
    position: fixed;
    bottom: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.3);
    color: rgba(255, 255, 255, 0.8);
    padding: 5px;
    z-index: 10000;
    font-family: monospace;
    font-size: 11px;
    border-radius: 5px 0 0 0;
    pointer-events: none;
  `;
  document.body.appendChild(debugElement);
  
  // Optional: Add title indicator
  if (config.showTitleIndicator) {
    updatePageTitle(true);
  }
  
  // Save the automation state
  updateAutomationState(true);
  
  // Start the movement loop
  performRandomMouseAction();
}

// Stop the automated mouse movement
function stopAutomation() {
  if (!isRunning) return; // Don't stop if not running
  
  isRunning = false;
  
  // Clear any pending timeout for the next movement
  if (window.pendingAutomationTimeout) {
    clearTimeout(window.pendingAutomationTimeout);
    window.pendingAutomationTimeout = null;
  }
  
  // Clear the scheduled stop timeout
  if (window.scheduledStopTimeout) {
    clearTimeout(window.scheduledStopTimeout);
    window.scheduledStopTimeout = null;
  }
  
  // Remove the cursor element
  if (cursorElement && document.getElementById('rainbow-mouse-cursor')) {
    document.body.removeChild(cursorElement);
    cursorElement = null;
  }
  
  // Remove the status indicator
  const indicator = document.getElementById('automation-indicator');
  if (indicator) {
    document.body.removeChild(indicator);
  }
  
  // Remove the timer
  const timer = document.getElementById('automation-timer');
  if (timer) {
    document.body.removeChild(timer);
  }
  
  // Remove the debug display
  const debug = document.getElementById('automation-debug');
  if (debug) {
    document.body.removeChild(debug);
  }
  
  // Reset the scheduled stop time
  window.scheduledStopTime = null;
  
  // Reset the page title
  if (config.showTitleIndicator) {
    updatePageTitle(false);
  }
  
  // Update the automation state in storage
  updateAutomationState(false);
}

// Perform a random mouse action based on configuration
function performRandomMouseAction() {
  if (!isRunning) return;
  
  const action = getRandomAction();
  
  switch (action) {
    case 'move':
      performRandomMouseMove();
      break;
    case 'scroll':
      performRandomScroll();
      break;
    case 'click':
      performRandomClick();
      break;
  }
  
  // Update the debug information
  updateDebugInfo(action);
  
  // Schedule the next action
  const delay = getRandomDelay();
  window.pendingAutomationTimeout = setTimeout(performRandomMouseAction, delay);
}

// Helper function to select a random action based on probability
function getRandomAction() {
  const r = Math.random();
  
  if (r < config.clickProbability) {
    return 'click';
  } else if (r < config.clickProbability + config.scrollProbability) {
    return 'scroll';
  } else {
    return 'move';
  }
}

// Perform a random mouse movement
function performRandomMouseMove() {
  if (!cursorElement) return;
  
  // Get current position
  let currentX = parseFloat(cursorElement.style.left) || window.innerWidth / 2;
  let currentY = parseFloat(cursorElement.style.top) || window.innerHeight / 2;
  
  // Calculate bounds with padding to keep cursor visible
  const padding = 50;
  const minX = padding;
  const minY = padding;
  const maxX = window.innerWidth - padding;
  const maxY = window.innerHeight - padding;
  
  // Calculate a new position with bounded randomness
  const maxDistance = config.moveDistance;
  const deltaX = (Math.random() * 2 - 1) * maxDistance;
  const deltaY = (Math.random() * 2 - 1) * maxDistance;
  
  // Apply the movement, keeping within bounds
  let newX = Math.max(minX, Math.min(maxX, currentX + deltaX));
  let newY = Math.max(minY, Math.min(maxY, currentY + deltaY));
  
  // Apply easing for smooth movement
  animateCursorMovement(currentX, currentY, newX, newY);
}

// Perform a random scroll action
function performRandomScroll() {
  // Calculate a random scroll amount
  const maxScrollAmount = config.scrollAmount;
  const scrollAmount = (Math.random() * 2 - 1) * maxScrollAmount;
  
  // Perform the scroll
  window.scrollBy({
    top: scrollAmount,
    behavior: 'smooth'
  });
}

// Perform a random click action
function performRandomClick() {
  if (!cursorElement) return;
  
  // Add click animation to cursor
  cursorElement.classList.add('clicking');
  setTimeout(() => {
    cursorElement.classList.remove('clicking');
  }, 300);
  
  // Check if cursor is over any clickable element
  const currentX = parseFloat(cursorElement.style.left) || window.innerWidth / 2;
  const currentY = parseFloat(cursorElement.style.top) || window.innerHeight / 2;
  
  // Get element at cursor position
  const element = document.elementFromPoint(currentX, currentY);
  
  // Only click if it's a safe clickable element
  if (element && isSafeToClick(element)) {
    // Create and dispatch a click event
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: currentX,
      clientY: currentY
    });
    element.dispatchEvent(clickEvent);
  }
}

// Helper function to determine if it's safe to click an element
function isSafeToClick(element) {
  // Get the tag name in lowercase
  const tagName = element.tagName.toLowerCase();
  
  // List of safe clickable elements
  const safeElements = ['button', 'a', 'input', 'select', 'option', 'label', 'details', 'summary'];
  
  // Blacklist of classes/ids that should never be clicked
  const blacklist = ['logout', 'sign-out', 'delete', 'remove', 'cancel', 'close'];
  
  // Check if the element is in our safe list
  if (safeElements.includes(tagName)) {
    // Don't click if it has a blacklisted keyword
    if (blacklist.some(word => 
      element.id.toLowerCase().includes(word) || 
      element.className.toLowerCase().includes(word) ||
      (element.innerText && element.innerText.toLowerCase().includes(word))
    )) {
      return false;
    }
    
    return true;
  }
  
  // For non-explicitly safe elements, only click if they have a click handler
  const clickKeys = ['onclick', 'onClick', 'click', 'Click'];
  for (const key of clickKeys) {
    if (element[key] || element.hasAttribute(key)) {
      return true;
    }
  }
  
  return false;
}

// Helper function to update the debug information
function updateDebugInfo(lastAction) {
  const debug = document.getElementById('automation-debug');
  if (!debug) return;
  
  const cursorX = cursorElement ? parseFloat(cursorElement.style.left) : 0;
  const cursorY = cursorElement ? parseFloat(cursorElement.style.top) : 0;
  
  const configSummary = {
    moveDistance: config.moveDistance,
    clickProb: config.clickProbability,
    scrollProb: config.scrollProbability,
    minDelay: config.minDelay,
    maxDelay: config.maxDelay
  };
  
  debug.innerHTML = `
    Mode: ${config.mode}<br>
    Last action: ${lastAction}<br>
    Position: ${Math.round(cursorX)}, ${Math.round(cursorY)}<br>
    Config: ${JSON.stringify(configSummary)}
  `;
}

// Helper function to update the timer display
function updateTimerDisplay() {
  const timer = document.getElementById('automation-timer');
  if (!timer || !window.scheduledStopTime) return;
  
  // Calculate time remaining
  const stopTime = new Date(window.scheduledStopTime);
  const now = new Date();
  const timeLeft = Math.max(0, stopTime - now);
  
  // Format as mm:ss
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  timer.textContent = `Time Left: ${formattedTime}`;
  
  // Only update if time left
  if (timeLeft > 0) {
    setTimeout(updateTimerDisplay, 1000);
  }
}

// Smoothly animate the cursor movement for more natural movement
function animateCursorMovement(startX, startY, endX, endY) {
  const duration = 300; // ms
  const startTime = performance.now();
  
  function animate(currentTime) {
    const elapsedTime = currentTime - startTime;
    const progress = Math.min(elapsedTime / duration, 1);
    
    // Easing function - ease-in-out quad
    const easedProgress = progress < 0.5 
      ? 2 * progress * progress 
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    
    // Calculate current position
    const x = startX + (endX - startX) * easedProgress;
    const y = startY + (endY - startY) * easedProgress;
    
    // Update cursor position
    cursorElement.style.left = x + 'px';
    cursorElement.style.top = y + 'px';
    
    // Store the position for future reference
    window.lastMouseX = x;
    window.lastMouseY = y;
    
    // Continue animation if not finished
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }
  
  requestAnimationFrame(animate);
}

// Helper function to get a random delay between actions
function getRandomDelay() {
  const min = config.minDelay;
  const max = config.maxDelay;
  return Math.floor(min + Math.random() * (max - min));
}

// Helper function to update the page title with automation status
function updatePageTitle(isRunning) {
  const originalTitle = document.defaultTitle || document.title.replace(/^\[AUTOMATION\] /, '');
  
  if (!document.defaultTitle) {
    document.defaultTitle = originalTitle;
  }
  
  if (isRunning) {
    document.title = `[AUTOMATION] ${originalTitle}`;
  } else {
    document.title = originalTitle;
  }
}

// Store the configuration for use across all tabs
function storeConfigInStorage(tabConfig) {
  // Get the current tab ID
  chrome.runtime.sendMessage({ type: 'getTabId' }, function(response) {
    if (response && response.tabId) {
      const tabId = response.tabId;
      // Store tab-specific config
      chrome.storage.local.set({ [`tabConfig_${tabId}`]: tabConfig });
    }
  });
}

// Retrieve the tab-specific configuration
function getTabConfig(tabId, callback) {
  chrome.storage.local.get([`tabConfig_${tabId}`], function(result) {
    if (result[`tabConfig_${tabId}`]) {
      callback(result[`tabConfig_${tabId}`]);
    } else {
      callback(null);
    }
  });
}

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // First check if message is specifically for this tab
  chrome.runtime.sendMessage({ type: 'getTabId' }, function(response) {
    const thisTabId = response?.tabId;
    
    // If message includes a tabId that doesn't match this tab, ignore it
    if (message.tabId && thisTabId && message.tabId !== thisTabId) {
      return;
    }
    
    // Process messages for this tab
    if (message.type === 'startAutomation') {
      // Store the global configuration for use by other tabs
      if (message.config) {
        storeConfigInStorage(message.config);
      }
      
      // Store scheduled stop time if provided
      if (message.scheduledStopTime) {
        window.scheduledStopTime = message.scheduledStopTime;
        
        // Calculate ms until stop time
        const timeUntilStop = message.scheduledStopTime - Date.now();
        
        if (timeUntilStop > 0) {
          // Set a timer to stop the automation at the scheduled time
          setTimeout(() => {
            stopAutomation();
          }, timeUntilStop);
        }
      }
      
      startAutomation(message.config);
      sendResponse({ success: true });
    }
    
    if (message.type === 'stopAutomation') {
      stopAutomation();
      sendResponse({ success: true });
    }
    
    if (message.type === 'getStatus') {
      sendResponse({ 
        isRunning: isRunning,
        scheduledStopTime: window.scheduledStopTime,
        tabId: thisTabId
      });
    }
  });
  
  // Required for async processing
  return true;
});

// Also listen for messages from the window (background script injection)
window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== 'random-mouse-automation-background') return;
  
  // Check if message is for a specific tab
  if (event.data.tabId) {
    // Get our tab ID
    chrome.runtime.sendMessage({ type: 'getTabId' }, function(response) {
      const thisTabId = response?.tabId;
      
      // If message includes a tabId that doesn't match this tab, ignore it
      if (thisTabId && event.data.tabId !== thisTabId) {
        return;
      }
      
      // Process the message for this tab
      processWindowMessage(event.data);
    });
  } else {
    // No tab ID specified, process for all tabs
    processWindowMessage(event.data);
  }
});

// Process a window message
function processWindowMessage(data) {
  // Handle the same message types as the Chrome message listener
  if (data.type === 'startAutomation') {
    // Store the configuration
    if (data.config) {
      storeConfigInStorage(data.config);
    }
    
    // Store scheduled stop time if provided
    if (data.scheduledStopTime) {
      window.scheduledStopTime = data.scheduledStopTime;
    }
    
    // Start the automation with the provided config
    startAutomation(data.config);
  }
  
  if (data.type === 'stopAutomation') {
    stopAutomation();
  }
}

// Check on document load
document.addEventListener('DOMContentLoaded', function() {
  checkTabAutomationState();
  
  // Also check for global automation config
  getTabConfig(window.currentTabId, function(tabConfig) {
    if (tabConfig && tabConfig.runInBackground) {
      startAutomation(tabConfig);
    }
  });
});

// Listen for visibility change to handle tab switching
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible') {
    checkTabAutomationState();
  } else if (document.visibilityState === 'hidden') {
    // Only pause automation if runInBackground is disabled
    if (isRunning && config.runInBackground === false) {
      pauseAutomation();
    }
  }
});

// Pause the automation movement loop without stopping automation
function pauseAutomation() {
  if (!isRunning) return;
  
  // Clear any pending timeout for the next movement
  if (window.pendingAutomationTimeout) {
    clearTimeout(window.pendingAutomationTimeout);
    window.pendingAutomationTimeout = null;
  }
}

// Resume the automation movement loop if it's supposed to be running
function resumeAutomation() {
  if (!isRunning) return;
  
  // Only start the movement loop if it's not already running
  if (!window.pendingAutomationTimeout) {
    performRandomMouseAction();
  }
}

// When the page loads or regains visibility, check this specific tab's state
function checkTabAutomationState() {
  chrome.runtime.sendMessage({ type: 'getTabId' }, function(response) {
    if (response && response.tabId) {
      const tabId = response.tabId;
      chrome.storage.local.get([
        `automationActive_${tabId}`,
        `automationConfig_${tabId}`,
        `automationStopTime_${tabId}`
      ], function(result) {
        const shouldBeActive = result[`automationActive_${tabId}`];
        const storedConfig = result[`automationConfig_${tabId}`];
        const storedStopTime = result[`automationStopTime_${tabId}`];

        // If we think it's stopped but storage says it should be running
        if (!isRunning && shouldBeActive) {
          // Restore the stored stop time
          if (storedStopTime) {
            window.scheduledStopTime = storedStopTime;
          }
          
          // Check if the stop time has already passed
          if (window.scheduledStopTime && new Date(window.scheduledStopTime) <= new Date()) {
            stopAutomation();
            return;
          }
          
          // Start with the stored config or default
          if (storedConfig) {
            startAutomation(storedConfig);
          } else {
            startAutomation();
          }
        }
        // If we think it's running but storage says it should be stopped
        else if (isRunning && !shouldBeActive) {
          stopAutomation();
        }
        // If we're running and should be running, check visual elements and resume movement
        else if (isRunning && shouldBeActive) {
          ensureVisualElementsExist(tabId);
          resumeAutomation();
        }
      });
    }
  });
}

// Make sure all visual elements exist when automation is running
function ensureVisualElementsExist(tabId) {
  if (!isRunning) return;
  
  // Check for and create the cursor element if needed
  if (!cursorElement || !document.getElementById('rainbow-mouse-cursor')) {
    const result = addCursorElement();
    cursorElement = result.element;
    
    // Restore last known position or use center
    const x = window.lastMouseX || (window.innerWidth / 2);
    const y = window.lastMouseY || (window.innerHeight / 2);
    cursorElement.style.left = x + 'px';
    cursorElement.style.top = y + 'px';
  }
  
  // Check for and create the status indicator if needed
  if (!document.getElementById('automation-indicator')) {
    const indicator = document.createElement('div');
    indicator.id = 'automation-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      background: rgba(255, 0, 0, 0.4);
      color: white;
      padding: 5px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      border-radius: 0 0 0 5px;
      pointer-events: none;
    `;
    indicator.textContent = 'Automation Running';
    document.body.appendChild(indicator);
  }
  
  // Check for and create the timer if needed
  if (window.scheduledStopTime && !document.getElementById('automation-timer')) {
    const timerElement = document.createElement('div');
    timerElement.id = 'automation-timer';
    timerElement.style.cssText = `
      position: fixed;
      top: 25px;
      right: 0;
      background: rgba(0, 0, 0, 0.5);
      color: white;
      padding: 5px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 12px;
      border-radius: 0 0 0 5px;
      pointer-events: none;
    `;
    document.body.appendChild(timerElement);
    updateTimerDisplay();
  }
  
  // Check for and create the debug element if needed
  if (!document.getElementById('automation-debug')) {
    const debugElement = document.createElement('div');
    debugElement.id = 'automation-debug';
    debugElement.style.cssText = `
      position: fixed;
      bottom: 0;
      right: 0;
      background: rgba(0, 0, 0, 0.3);
      color: rgba(255, 255, 255, 0.8);
      padding: 5px;
      z-index: 10000;
      font-family: monospace;
      font-size: 11px;
      border-radius: 5px 0 0 0;
      pointer-events: none;
    `;
    document.body.appendChild(debugElement);
  }
  
  // Check if title needs to be updated
  if (tabId) {
    getTabConfig(tabId, function(tabConfig) {
      if (tabConfig && tabConfig.showTitleIndicator) {
        updatePageTitle(true);
      }
    });
  }
}

// Process navigation away from the page
window.addEventListener('beforeunload', function() {
  stopAutomation();
});

// Helper function to immediately verify and create visual elements after startup
function verifyAutomationElements() {
  // Delay slightly to ensure DOM is ready
  setTimeout(() => {
    // Check if we're supposed to be running
    chrome.runtime.sendMessage({ type: 'getTabId' }, function(response) {
      if (response && response.tabId) {
        const tabId = response.tabId;
        window.currentTabId = tabId; // Store tab ID
        
        chrome.storage.local.get([`automationActive_${tabId}`], function(result) {
          if (result[`automationActive_${tabId}`]) {
            ensureVisualElementsExist(tabId);
          }
        });
        
        // Also check for tab-specific config
        getTabConfig(tabId, function(tabConfig) {
          if (tabConfig && tabConfig.runInBackground) {
            ensureVisualElementsExist(tabId);
          }
        });
      }
    });
  }, 500);
}

// Run the element verification on page load and when visible
document.addEventListener('DOMContentLoaded', verifyAutomationElements);
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible') {
    verifyAutomationElements();
  }
});
