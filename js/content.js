// Web Automation Suite - Content Script (Sidebar Version)

// ====================================================================
// 1. LOGIC ĐIỀU KHIỂN SIDEBAR
// ====================================================================

let sidebarFrame = null;
const SIDEBAR_ID = 'automation-suite-sidebar';

function createSidebar() {
    // Check if sidebar already exists
    if (document.getElementById(SIDEBAR_ID)) {
        sidebarFrame = document.getElementById(SIDEBAR_ID);
        return;
    }

    // Create sidebar iframe
    sidebarFrame = document.createElement('iframe');
    sidebarFrame.id = SIDEBAR_ID;
    sidebarFrame.src = chrome.runtime.getURL('ui/sidebar.html');
    sidebarFrame.setAttribute('frameborder', '0');
    sidebarFrame.setAttribute('scrolling', 'no');
    
    // Ensure sidebar is initially hidden
    sidebarFrame.classList.remove('visible');
    
    document.body.appendChild(sidebarFrame);
    
    console.log('Sidebar created and injected');
}

function showSidebar() {
    if (!sidebarFrame) {
        createSidebar();
    }
    sidebarFrame.classList.add('visible');
    document.body.classList.add('automation-sidebar-open');
    console.log('Sidebar shown');
}

function hideSidebar() {
    if (sidebarFrame) {
        sidebarFrame.classList.remove('visible');
        document.body.classList.remove('automation-sidebar-open');
        console.log('Sidebar hidden');
    }
}

function toggleSidebar() {
    if (!sidebarFrame) {
        createSidebar();
        // Small delay to ensure iframe loads before showing
        setTimeout(() => {
            showSidebar();
        }, 100);
    } else {
        if (sidebarFrame.classList.contains('visible')) {
            hideSidebar();
        } else {
            showSidebar();
        }
    }
}

// ====================================================================
// 2. COMMUNICATION WITH SIDEBAR
// ====================================================================

// Listen for messages from sidebar iframe
window.addEventListener('message', (event) => {
    // Verify source is our sidebar
    if (!event.data || event.data.source !== 'automation-sidebar') {
        return;
    }

    const { action } = event.data;
    
    switch (action) {
        case 'startPicking':
            startLocationPicking();
            break;
        case 'startRecording':
            startRecording();
            break;
        case 'stopRecording':
            const actions = stopRecording();
            // Send recorded actions back to sidebar
            sendMessageToSidebar('recordingStopped', { actions });
            break;
        default:
            console.log('Unknown sidebar message:', event.data);
    }
});

function sendMessageToSidebar(action, data = {}) {
    if (sidebarFrame && sidebarFrame.contentWindow) {
        sidebarFrame.contentWindow.postMessage({
            action,
            data
        }, '*');
    }
}

// ====================================================================
// 3. BỘ LẮNG NGHE TIN NHẮN (MESSAGE LISTENER)
// ====================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received:', request);
    
    try {
        switch (request.action) {
            // Lệnh từ background để bật/tắt sidebar
            case "toggle_sidebar":
                toggleSidebar();
                sendResponse({ status: 'Sidebar toggled' });
                break;

            // Coordinates updated from other tabs
            case "coordsUpdated":
                sendMessageToSidebar('coordsUpdated', request);
                sendResponse({ success: true });
                break;

            // Các lệnh từ sidebar để tương tác với trang
            case "startPicking":
                startLocationPicking();
                sendResponse({ success: true, message: "Location picking started" });
                break;
                
            case "executeClick":
                executeClick(request.x, request.y);
                sendResponse({ success: true, message: "Click executed" });
                break;
                
            case "executeStep":
                executeAutomationStep(request.step)
                    .then(result => sendResponse({ success: true, result }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true; // Bắt buộc cho phản hồi bất đồng bộ
                
            case "executeAutomationStep":
                executeAutomationStep(request.step)
                    .then(result => sendResponse({ success: true, result }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true;
                
            case "startRecording":
                startRecording();
                sendResponse({ success: true, message: "Recording started" });
                break;
                
            case "stopRecording":
                const actions = stopRecording();
                sendResponse({ success: true, message: "Recording stopped", actions: actions });
                break;
                
            case "getPageInfo":
                const pageInfo = getPageInfo();
                sendResponse({ success: true, result: pageInfo });
                break;
                
            case "analyzePage":
                const analysis = analyzePage();
                sendResponse({ success: true, result: analysis });
                break;
                
            default:
                sendResponse({ success: false, error: "Unknown action" });
        }
    } catch (error) {
        console.error('Content script error:', error);
        sendResponse({ success: false, error: error.message });
    }
    
    return true;
});

// ====================================================================
// 4. LOCATION PICKING (PER TAB)
// ====================================================================

let isPickingLocation = false;

function startLocationPicking() {
    if (isPickingLocation) return;
    
    isPickingLocation = true;
    document.body.style.cursor = 'crosshair';
    
    const overlay = createPickingOverlay();
    document.body.appendChild(overlay);
    
    // Use capture phase to ensure we catch the click first
    document.addEventListener('click', handleLocationPick, true);
}

function handleLocationPick(event) {
    if (!isPickingLocation) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const coords = { 
        x: event.clientX, 
        y: event.clientY,
        tabId: getCurrentTabId()
    };
    
    // Save to per-tab storage
    chrome.storage.local.set({ 
        coords: coords,
        [`coords_${getCurrentTabId()}`]: coords 
    });
    
    // Notify background script to update all tabs
    chrome.runtime.sendMessage({ 
        action: "updateCoords", 
        coords: coords 
    });
    
    // Send to sidebar
    sendMessageToSidebar('coordsUpdated', { coords });
    
    // Cleanup
    isPickingLocation = false;
    document.body.style.cursor = 'default';
    document.removeEventListener('click', handleLocationPick, true);
    
    const overlay = document.getElementById('automation-overlay');
    if (overlay) overlay.remove();
    
    showClickFeedback(coords.x, coords.y, '#4f46e5');
    
    console.log('Location picked for tab:', coords);
}

function createPickingOverlay() {
    // Remove existing overlay if any
    const existingOverlay = document.getElementById('automation-overlay');
    if (existingOverlay) existingOverlay.remove();
    
    const overlay = document.createElement('div');
    overlay.id = 'automation-overlay';
    overlay.style.cssText = `
        position: fixed; 
        top: 0; 
        left: 0; 
        right: 0; 
        bottom: 0; 
        background: rgba(79, 70, 229, 0.1); 
        border: 3px dashed #4f46e5; 
        z-index: 999998; 
        pointer-events: none; 
        box-sizing: border-box;
    `;
    
    const instruction = document.createElement('div');
    instruction.style.cssText = `
        position: fixed; 
        top: 20px; 
        left: 50%; 
        transform: translateX(-50%); 
        background: #4f46e5; 
        color: white; 
        padding: 12px 24px; 
        border-radius: 25px; 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
        font-size: 14px; 
        font-weight: 500; 
        z-index: 999999; 
        pointer-events: none; 
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    `;
    instruction.textContent = '🎯 Click để thiết lập vị trí auto-click';
    
    document.body.appendChild(instruction);
    
    // Auto cleanup after 10 seconds
    setTimeout(() => {
        if (overlay.parentNode) overlay.remove();
        if (instruction.parentNode) instruction.remove();
        if (isPickingLocation) {
            isPickingLocation = false;
            document.body.style.cursor = 'default';
            document.removeEventListener('click', handleLocationPick, true);
        }
    }, 10000);
    
    return overlay;
}

// ====================================================================
// 5. CLICK EXECUTION
// ====================================================================

function executeClick(x, y) {
    const element = document.elementFromPoint(x, y);
    if (!element) {
        throw new Error(`Không tìm thấy element tại (${x}, ${y})`);
    }
    
    // Create and dispatch click event
    const clickEvent = new MouseEvent('click', {
        view: window, 
        bubbles: true, 
        cancelable: true, 
        clientX: x, 
        clientY: y
    });
    
    element.dispatchEvent(clickEvent);
    showClickFeedback(x, y, '#10b981');
    console.log(`Click executed at (${x}, ${y}) on element:`, element);
}

// ====================================================================
// 6. VISUAL FEEDBACK
// ====================================================================

function showClickFeedback(x, y, color = '#4f46e5') {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
        position: fixed; 
        left: ${x - 8}px; 
        top: ${y - 8}px; 
        width: 16px; 
        height: 16px; 
        border: 3px solid ${color}; 
        border-radius: 50%; 
        background: rgba(79, 70, 229, 0.2); 
        z-index: 999999; 
        pointer-events: none; 
        animation: clickPulse 0.6s ease-out forwards;
    `;
    
    // Add animation styles if not exists
    if (!document.querySelector('#automation-animations')) {
        const style = document.createElement('style');
        style.id = 'automation-animations';
        style.textContent = `
            @keyframes clickPulse { 
                0% { transform: scale(0.5); opacity: 1; } 
                100% { transform: scale(3); opacity: 0; } 
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(feedback);
    
    setTimeout(() => {
        if (feedback.parentNode) {
            feedback.parentNode.removeChild(feedback);
        }
    }, 600);
}

// ====================================================================
// 7. RECORDING FUNCTIONALITY (PER TAB)
// ====================================================================

let isRecording = false;
let recordedActions = [];

function startRecording() {
    if (isRecording) return;
    
    isRecording = true;
    recordedActions = [];
    
    // Add event listeners for recording
    document.addEventListener('click', recordClick, true);
    document.addEventListener('input', recordInput, true);
    document.addEventListener('keydown', recordKeydown, true);
    
    console.log('Recording started for tab:', getCurrentTabId());
}

function stopRecording() {
    if (!isRecording) return recordedActions;
    
    isRecording = false;
    
    // Remove event listeners
    document.removeEventListener('click', recordClick, true);
    document.removeEventListener('input', recordInput, true);
    document.removeEventListener('keydown', recordKeydown, true);
    
    console.log('Recording stopped. Actions:', recordedActions);
    return recordedActions;
}

function recordClick(event) {
    if (!isRecording) return;
    
    const element = event.target;
    const selector = generateSelector(element);
    const rect = element.getBoundingClientRect();
    
    recordedActions.push({ 
        type: 'clickElement', 
        selector: selector,
        x: event.clientX,
        y: event.clientY,
        elementX: rect.left + rect.width / 2,
        elementY: rect.top + rect.height / 2,
        timestamp: Date.now() 
    });
}

function recordInput(event) {
    if (!isRecording) return;
    
    const element = event.target;
    const selector = generateSelector(element);
    
    recordedActions.push({ 
        type: 'type', 
        selector: selector, 
        text: element.value, 
        timestamp: Date.now() 
    });
}

function recordKeydown(event) {
    if (!isRecording) return;
    
    // Only record special keys
    if (['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        recordedActions.push({
            type: 'press',
            key: event.key,
            timestamp: Date.now()
        });
    }
}

// ====================================================================
// 8. AUTOMATION STEP EXECUTION
// ====================================================================

async function executeAutomationStep(step) {
    console.log('Executing step:', step);
    
    switch (step.type) {
        case 'click':
            return await executeClickStep(step);
        case 'clickElement':
            return await executeClickElementStep(step);
        case 'type':
            return await executeTypeStep(step);
        case 'wait':
            return await executeWaitStep(step);
        case 'scroll':
            return await executeScrollStep(step);
        case 'hover':
            return await executeHoverStep(step);
        case 'press':
            return await executePressStep(step);
        case 'goto':
            return await executeGotoStep(step);
        case 'selectOption':
            return await executeSelectOptionStep(step);
        case 'check':
            return await executeCheckStep(step);
        case 'getText':
            return await executeGetTextStep(step);
        case 'getAttribute':
            return await executeGetAttributeStep(step);
        case 'waitForElement':
            return await executeWaitForElementStep(step);
        case 'reload':
            return await executeReloadStep(step);
        default:
            throw new Error(`Loại bước không được hỗ trợ: ${step.type}`);
    }
}

async function executeClickStep(step) {
    const x = parseInt(step.x);
    const y = parseInt(step.y);
    executeClick(x, y);
    return { x, y, clicked: true };
}

async function executeClickElementStep(step) {
    const element = await waitForSelector(step.selector, step.timeout || 5000);
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(300);
    
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    
    const clickEvent = new MouseEvent('click', {
        view: window, bubbles: true, cancelable: true, clientX: x, clientY: y
    });
    
    element.dispatchEvent(clickEvent);
    showClickFeedback(x, y, '#10b981');
    
    return { selector: step.selector, clicked: true, x, y };
}

async function executeTypeStep(step) {
    const element = await waitForSelector(step.selector, step.timeout || 5000);
    element.focus();
    
    if (step.clear !== false) {
        element.value = '';
        element.textContent = '';
    }
    
    const text = step.text || '';
    
    // Type character by character for more realistic input
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        // Dispatch events
        element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.value += char;
        } else {
            element.textContent += char;
        }
        
        element.dispatchEvent(new InputEvent('input', { data: char, bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
        
        await sleep(50); // Small delay between characters
    }
    
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return { selector: step.selector, text: text };
}

async function executeWaitStep(step) {
    const duration = parseInt(step.duration) || 1000;
    await sleep(duration);
    return { duration: duration };
}

async function executeScrollStep(step) {
    const x = parseInt(step.x) || window.scrollX;
    const y = parseInt(step.y) || 0;
    const behavior = step.smooth ? 'smooth' : 'auto';
    
    window.scrollTo({ left: x, top: y, behavior });
    return { x, y };
}

async function executeHoverStep(step) {
    const element = await waitForSelector(step.selector, step.timeout || 5000);
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    
    const hoverEvent = new MouseEvent('mouseover', {
        view: window, bubbles: true, cancelable: true, clientX: x, clientY: y
    });
    
    element.dispatchEvent(hoverEvent);
    return { selector: step.selector };
}

async function executePressStep(step) {
    const key = step.key || '';
    const modifiers = step.modifiers || [];
    
    const keyEvent = {
        key: key,
        bubbles: true,
        cancelable: true,
        ctrlKey: modifiers.includes('ctrl'),
        shiftKey: modifiers.includes('shift'),
        altKey: modifiers.includes('alt'),
        metaKey: modifiers.includes('meta')
    };
    
    document.dispatchEvent(new KeyboardEvent('keydown', keyEvent));
    await sleep(100);
    document.dispatchEvent(new KeyboardEvent('keyup', keyEvent));
    
    return { key: key, modifiers: modifiers };
}

async function executeGotoStep(step) {
    window.location.href = step.url;
    return { url: step.url };
}

async function executeSelectOptionStep(step) {
    const element = await waitForSelector(step.selector, step.timeout || 5000);
    if (element.tagName !== 'SELECT') {
        throw new Error('Element không phải là select');
    }
    
    element.value = step.value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    return { selector: step.selector, value: step.value };
}

async function executeCheckStep(step) {
    const element = await waitForSelector(step.selector, step.timeout || 5000);
    const shouldCheck = step.checked === true || step.checked === 'true';
    
    if (element.checked !== shouldCheck) {
        element.checked = shouldCheck;
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    return { selector: step.selector, checked: shouldCheck };
}

async function executeGetTextStep(step) {
    const element = await waitForSelector(step.selector, step.timeout || 5000);
    const text = element.textContent || element.innerText || '';
    return { selector: step.selector, text: text };
}

async function executeGetAttributeStep(step) {
    const element = await waitForSelector(step.selector, step.timeout || 5000);
    const value = element.getAttribute(step.attribute);
    return { selector: step.selector, attribute: step.attribute, value: value };
}

async function executeWaitForElementStep(step) {
    const element = await waitForSelector(step.selector, step.timeout || 30000);
    
    if (step.visible) {
        // Wait for element to be visible
        await waitForVisible(element, step.timeout || 30000);
    }
    
    return { selector: step.selector, found: true };
}

async function executeReloadStep(step) {
    window.location.reload();
    return { reloaded: true };
}

// ====================================================================
// 9. UTILITY FUNCTIONS
// ====================================================================

function waitForSelector(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }
        
        const observer = new MutationObserver((mutations, obs) => {
            const element = document.querySelector(selector);
            if (element) {
                obs.disconnect();
                resolve(element);
            }
        });
        
        observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        });
        
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Element ${selector} không tìm thấy trong ${timeout}ms`));
        }, timeout);
    });
}

function waitForVisible(element, timeout = 5000) {
    return new Promise((resolve, reject) => {
        if (isElementVisible(element)) {
            resolve(element);
            return;
        }
        
        const observer = new MutationObserver(() => {
            if (isElementVisible(element)) {
                observer.disconnect();
                resolve(element);
            }
        });
        
        observer.observe(document.body, { 
            attributes: true, 
            childList: true, 
            subtree: true 
        });
        
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Element không hiển thị trong ${timeout}ms`));
        }, timeout);
    });
}

function isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0'
    );
}

function generateSelector(element) {
    // Priority: ID > Class > Tag
    if (element.id) {
        return `#${element.id}`;
    }
    
    if (element.className && typeof element.className === 'string') {
        const classes = element.className.trim().split(/\s+/).filter(cls => 
            cls && !cls.includes(' ') && !cls.includes('.')
        );
        if (classes.length > 0) {
            return `.${classes.join('.')}`;
        }
    }
    
    // Fallback to tag name with nth-child if needed
    const tagName = element.tagName.toLowerCase();
    const siblings = Array.from(element.parentNode?.children || [])
        .filter(el => el.tagName === element.tagName);
    
    if (siblings.length > 1) {
        const index = siblings.indexOf(element) + 1;
        return `${tagName}:nth-child(${index})`;
    }
    
    return tagName;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getPageInfo() {
    return {
        title: document.title,
        url: window.location.href,
        elementCount: document.querySelectorAll('*').length,
        tabId: getCurrentTabId()
    };
}

function analyzePage() {
    return {
        title: document.title,
        url: window.location.href,
        elementCount: document.querySelectorAll('*').length,
        clickableElements: document.querySelectorAll('button, a, input[type="submit"], [onclick]').length,
        inputElements: document.querySelectorAll('input, textarea, select').length,
        formElements: document.querySelectorAll('form').length,
        tabId: getCurrentTabId()
    };
}

function getCurrentTabId() {
    // Try to get tab ID from various sources
    if (window.chrome && chrome.runtime) {
        return Math.random().toString(36).substr(2, 9); // Fallback random ID
    }
    return 'unknown';
}

// ====================================================================
// 10. KHỞI TẠO
// ====================================================================

// Create sidebar when content script loads but keep it hidden
createSidebar();

console.log('Web Automation Suite content script loaded and ready for sidebar.');

// Prevent multiple initialization
if (!window.automationSuiteInitialized) {
    window.automationSuiteInitialized = true;
    console.log('Content script initialized for tab:', getCurrentTabId());
}