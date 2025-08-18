// Enhanced Web Automation Suite - Content Script with Full Step Support

// ====================================================================
// TAB IDENTIFICATION & STATE
// ====================================================================
let currentTabId = null;
let sidebarFrame = null;
const SIDEBAR_ID = 'automation-suite-sidebar';

// Get current tab ID
function getCurrentTabId() {
    if (!currentTabId) {
        // Try to get from various sources or generate a unique one
        currentTabId = Math.random().toString(36).substr(2, 9);
    }
    return currentTabId;
}

// ====================================================================
// SIDEBAR MANAGEMENT (PER TAB)
// ====================================================================
function createSidebar() {
    // Check if sidebar already exists for this tab
    if (document.getElementById(SIDEBAR_ID)) {
        sidebarFrame = document.getElementById(SIDEBAR_ID);
        return;
    }

    // Create unique sidebar iframe for this tab
    sidebarFrame = document.createElement('iframe');
    sidebarFrame.id = SIDEBAR_ID;
    sidebarFrame.src = chrome.runtime.getURL('ui/sidebar.html');
    sidebarFrame.setAttribute('frameborder', '0');
    sidebarFrame.setAttribute('scrolling', 'no');
    sidebarFrame.dataset.tabId = getCurrentTabId();
    
    // Initially hidden
    sidebarFrame.classList.remove('visible');
    
    document.body.appendChild(sidebarFrame);
    
    // Create close button
    createCloseButton();
    
    console.log(`Sidebar created for tab: ${getCurrentTabId()}`);
}

function createCloseButton() {
    // Remove existing close button
    const existingButton = document.getElementById('automation-close-btn');
    if (existingButton) {
        existingButton.remove();
    }

    const closeButton = document.createElement('button');
    closeButton.id = 'automation-close-btn';
    closeButton.className = 'sidebar-close-button';
    closeButton.innerHTML = '×';
    closeButton.title = 'Đóng Automation Sidebar';
    closeButton.style.display = 'none'; // Initially hidden
    
    closeButton.addEventListener('click', () => {
        hideSidebar();
    });
    
    document.body.appendChild(closeButton);
}

function showSidebar() {
    if (!sidebarFrame) {
        createSidebar();
    }
    sidebarFrame.classList.add('visible');
    document.body.classList.add('automation-sidebar-open');
    
    // Show close button
    const closeButton = document.getElementById('automation-close-btn');
    if (closeButton) {
        closeButton.style.display = 'flex';
    }
    
    // Load tab-specific state into sidebar
    setTimeout(() => {
        loadTabStateIntoSidebar();
    }, 500);
    
    console.log(`Sidebar shown for tab: ${getCurrentTabId()}`);
}

function hideSidebar() {
    if (sidebarFrame) {
        sidebarFrame.classList.remove('visible');
        document.body.classList.remove('automation-sidebar-open');
        
        // Hide close button
        const closeButton = document.getElementById('automation-close-btn');
        if (closeButton) {
            closeButton.style.display = 'none';
        }
        
        console.log(`Sidebar hidden for tab: ${getCurrentTabId()}`);
    }
}

function toggleSidebar() {
    if (!sidebarFrame) {
        createSidebar();
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

// Load this tab's state into sidebar
function loadTabStateIntoSidebar() {
    if (sidebarFrame && sidebarFrame.contentWindow) {
        chrome.runtime.sendMessage({ 
            action: "getTabState",
            tabId: getCurrentTabId() 
        }, (response) => {
            if (response?.success && response.state) {
                sendMessageToSidebar('tabStateLoaded', {
                    state: response.state,
                    tabId: getCurrentTabId()
                });
            }
        });
    }
}

// ====================================================================
// TAB-SPECIFIC COMMUNICATION WITH SIDEBAR
// ====================================================================

// Listen for messages from sidebar iframe
window.addEventListener('message', (event) => {
    // Verify source is our sidebar
    if (!event.data || event.data.source !== 'automation-sidebar') {
        return;
    }

    const { action } = event.data;
    const tabId = getCurrentTabId();
    
    switch (action) {
        case 'startPicking':
            startLocationPicking();
            break;
        case 'cancelPicking':
            cancelLocationPicking();
            break;
        case 'startRecording':
            startRecording();
            break;
        case 'stopRecording':
            const actions = stopRecording();
            sendMessageToSidebar('recordingStopped', { actions, tabId });
            break;
        case 'getTabId':
            sendMessageToSidebar('tabIdResponse', { tabId });
            break;
        case 'getLocationInfo':
            sendMessageToSidebar('locationInfoResponse', { 
                hostname: window.location.hostname,
                href: window.location.href
            });
            break;
        case 'getViewportInfo':
            sendMessageToSidebar('viewportInfoResponse', getViewportInfo());
            break;
        case 'reloadPage':
            window.location.reload();
            break;
        default:
            console.log('Unknown sidebar message:', event.data);
    }
});

function sendMessageToSidebar(action, data = {}) {
    if (sidebarFrame && sidebarFrame.contentWindow) {
        sidebarFrame.contentWindow.postMessage({
            action,
            data: { ...data, tabId: getCurrentTabId() }
        }, '*');
    }
}

// ====================================================================
// VIEWPORT INFO FUNCTIONS
// ====================================================================
function getViewportInfo() {
    return {
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight
        },
        screen: {
            width: window.screen.width,
            height: window.screen.height
        },
        scroll: {
            x: window.pageXOffset || document.documentElement.scrollLeft,
            y: window.pageYOffset || document.documentElement.scrollTop
        },
        document: {
            width: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight
        },
        devicePixelRatio: window.devicePixelRatio || 1,
        tabId: getCurrentTabId()
    };
}

// ====================================================================
// MESSAGE LISTENER (TAB-SPECIFIC)
// ====================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const requestTabId = request.tabId || getCurrentTabId();
    console.log(`Content script received (Tab ${requestTabId}):`, request);
    
    try {
        switch (request.action) {
            case "toggle_sidebar":
                // Set current tab ID from request if provided
                if (request.tabId) {
                    currentTabId = request.tabId;
                }
                toggleSidebar();
                sendResponse({ status: 'Sidebar toggled', tabId: getCurrentTabId() });
                break;

            case "coordsUpdated":
                // Only handle if this is for our tab
                if (request.tabId === getCurrentTabId()) {
                    sendMessageToSidebar('coordsUpdated', request);
                }
                sendResponse({ success: true, tabId: getCurrentTabId() });
                break;

            case "startPicking":
                startLocationPicking();
                sendResponse({ success: true, message: "Location picking started", tabId: getCurrentTabId() });
                break;
                
            case "executeClick":
                if (request.tabId && request.tabId !== getCurrentTabId()) {
                    sendResponse({ success: false, error: "Wrong tab", tabId: getCurrentTabId() });
                    break;
                }
                executeClick(request.x, request.y);
                sendResponse({ success: true, message: "Click executed", tabId: getCurrentTabId() });
                break;
                
            case "executeStep":
                if (request.tabId && request.tabId !== getCurrentTabId()) {
                    sendResponse({ success: false, error: "Wrong tab", tabId: getCurrentTabId() });
                    return true;
                }
                executeAutomationStep(request.step)
                    .then(result => sendResponse({ success: true, result, tabId: getCurrentTabId() }))
                    .catch(error => sendResponse({ success: false, error: error.message, tabId: getCurrentTabId() }));
                return true;
                
            case "executeAutomationStep":
                if (request.tabId && request.tabId !== getCurrentTabId()) {
                    sendResponse({ success: false, error: "Wrong tab", tabId: getCurrentTabId() });
                    return true;
                }
                executeAutomationStep(request.step)
                    .then(result => sendResponse({ success: true, result, tabId: getCurrentTabId() }))
                    .catch(error => sendResponse({ success: false, error: error.message, tabId: getCurrentTabId() }));
                return true;
                
            case "startRecording":
                startRecording();
                sendResponse({ success: true, message: "Recording started", tabId: getCurrentTabId() });
                break;
                
            case "stopRecording":
                const actions = stopRecording();
                sendResponse({ success: true, message: "Recording stopped", actions: actions, tabId: getCurrentTabId() });
                break;
                
            case "getPageInfo":
                const pageInfo = getPageInfo();
                sendResponse({ success: true, result: pageInfo, tabId: getCurrentTabId() });
                break;

            case "getViewportInfo":
                const viewportInfo = getViewportInfo();
                sendResponse({ success: true, result: viewportInfo, tabId: getCurrentTabId() });
                break;
                
            case "analyzePage":
                const analysis = analyzePage();
                sendResponse({ success: true, result: analysis, tabId: getCurrentTabId() });
                break;
                
            // Cookie operations
            case "getAllCookies":
                const cookies = getAllCookiesFromDocument();
                sendResponse({ success: true, cookies: cookies, tabId: getCurrentTabId() });
                break;
                
            case "setCookies":
                try {
                    applyCookiesToDocument(request.cookies);
                    sendResponse({ success: true, message: "Cookies applied", tabId: getCurrentTabId() });
                } catch (error) {
                    sendResponse({ success: false, error: error.message, tabId: getCurrentTabId() });
                }
                break;
                
            case "clearCookies":
                try {
                    clearDocumentCookies();
                    sendResponse({ success: true, message: "Cookies cleared", tabId: getCurrentTabId() });
                } catch (error) {
                    sendResponse({ success: false, error: error.message, tabId: getCurrentTabId() });
                }
                break;

            // File operations for setInputFiles
            case "getFileFromIndexedDB":
                getFileFromIndexedDB(request.filePath)
                    .then(fileBlob => sendResponse({ success: true, fileBlob, tabId: getCurrentTabId() }))
                    .catch(error => sendResponse({ success: false, error: error.message, tabId: getCurrentTabId() }));
                return true;

            case "listFilesInIndexedDB":
                listFilesInIndexedDB()
                    .then(files => sendResponse({ success: true, files, tabId: getCurrentTabId() }))
                    .catch(error => sendResponse({ success: false, error: error.message, tabId: getCurrentTabId() }));
                return true;
                
            default:
                sendResponse({ success: false, error: "Unknown action", tabId: getCurrentTabId() });
        }
    } catch (error) {
        console.error('Content script error:', error);
        sendResponse({ success: false, error: error.message, tabId: getCurrentTabId() });
    }
    
    return true;
});

// ====================================================================
// TAB-SPECIFIC LOCATION PICKING
// ====================================================================

let isPickingLocation = false;

function startLocationPicking() {
    if (isPickingLocation) return;
    
    isPickingLocation = true;
    document.body.style.cursor = 'crosshair';
    
    // Hide sidebar temporarily during picking - use CSS class instead
    if (sidebarFrame) {
        sidebarFrame.classList.add('picking-coords');
    }
    
    const overlay = createPickingOverlay();
    document.body.appendChild(overlay);
    
    document.addEventListener('click', handleLocationPick, true);
    document.addEventListener('keydown', handleLocationPickingKeydown, true);
}

function cancelLocationPicking() {
    if (!isPickingLocation) return;
    
    isPickingLocation = false;
    document.body.style.cursor = 'default';
    document.removeEventListener('click', handleLocationPick, true);
    document.removeEventListener('keydown', handleLocationPickingKeydown, true);
    
    // Restore sidebar visibility
    if (sidebarFrame) {
        sidebarFrame.classList.remove('picking-coords');
    }
    
    // Remove overlay and instruction
    const overlay = document.getElementById('automation-overlay');
    if (overlay) overlay.remove();
    
    const instruction = document.querySelector('[data-automation-instruction]');
    if (instruction) instruction.remove();
    
    // Notify sidebar that picking was canceled
    sendMessageToSidebar('pickingCanceled', {
        tabId: getCurrentTabId()
    });
    
    console.log(`Location picking canceled for tab ${getCurrentTabId()}`);
}

function handleLocationPickingKeydown(event) {
    if (event.key === 'Escape') {
        event.preventDefault();
        cancelLocationPicking();
    }
}

function handleLocationPick(event) {
    if (!isPickingLocation) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const coords = { 
        x: event.clientX, 
        y: event.clientY,
        tabId: getCurrentTabId(),
        timestamp: Date.now()
    };
    
    // Save coordinates for this specific tab
    chrome.runtime.sendMessage({ 
        action: "setTabCoords", 
        coords: coords,
        tabId: getCurrentTabId()
    });
    
    // Notify background to update coordinates
    chrome.runtime.sendMessage({ 
        action: "updateCoords", 
        coords: coords,
        tabId: getCurrentTabId()
    });
    
    // Send to this tab's sidebar
    sendMessageToSidebar('coordsUpdated', { coords });
    
    // Cleanup
    isPickingLocation = false;
    document.body.style.cursor = 'default';
    document.removeEventListener('click', handleLocationPick, true);
    document.removeEventListener('keydown', handleLocationPickingKeydown, true);
    
    // Restore sidebar visibility
    if (sidebarFrame) {
        sidebarFrame.classList.remove('picking-coords');
    }
    
    const overlay = document.getElementById('automation-overlay');
    if (overlay) overlay.remove();
    
    showClickFeedback(coords.x, coords.y, '#4f46e5');
    
    console.log(`Location picked for tab ${getCurrentTabId()}:`, coords);
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
    instruction.setAttribute('data-automation-instruction', 'true');
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
    instruction.textContent = `🎯 Tab ${getCurrentTabId()}: Click để thiết lập vị trí auto-click (ESC để hủy)`;
    
    document.body.appendChild(instruction);
    
    // Auto cleanup after 10 seconds
    setTimeout(() => {
        if (overlay.parentNode) overlay.remove();
        if (instruction.parentNode) instruction.remove();
        if (isPickingLocation) {
            isPickingLocation = false;
            document.body.style.cursor = 'default';
            document.removeEventListener('click', handleLocationPick, true);
            document.removeEventListener('keydown', handleLocationPickingKeydown, true);
            // Restore sidebar
            if (sidebarFrame) {
                sidebarFrame.classList.remove('picking-coords');
            }
        }
    }, 10000);
    
    return overlay;
}

// ====================================================================
// CLICK EXECUTION (TAB-SPECIFIC)
// ====================================================================

function executeClick(x, y) {
    const element = document.elementFromPoint(x, y);
    if (!element) {
        throw new Error(`Tab ${getCurrentTabId()}: Không tìm thấy element tại (${x}, ${y})`);
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
    console.log(`Tab ${getCurrentTabId()}: Click executed at (${x}, ${y}) on element:`, element);
}

// ====================================================================
// VISUAL FEEDBACK (TAB-SPECIFIC)
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
    if (!document.querySelector(`#automation-animations-${getCurrentTabId()}`)) {
        const style = document.createElement('style');
        style.id = `automation-animations-${getCurrentTabId()}`;
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
// TAB-SPECIFIC RECORDING
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
    
    console.log(`Recording started for tab: ${getCurrentTabId()}`);
}

function stopRecording() {
    if (!isRecording) return recordedActions;
    
    isRecording = false;
    
    // Remove event listeners
    document.removeEventListener('click', recordClick, true);
    document.removeEventListener('input', recordInput, true);
    document.removeEventListener('keydown', recordKeydown, true);
    
    console.log(`Recording stopped for tab ${getCurrentTabId()}. Actions:`, recordedActions);
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
        timestamp: Date.now(),
        tabId: getCurrentTabId()
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
        timestamp: Date.now(),
        tabId: getCurrentTabId()
    });
}

function recordKeydown(event) {
    if (!isRecording) return;
    
    // Only record special keys
    if (['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        recordedActions.push({
            type: 'press',
            key: event.key,
            timestamp: Date.now(),
            tabId: getCurrentTabId()
        });
    }
}

// ====================================================================
// AUTOMATION STEP EXECUTION - COMPLETE WITH ALL STEP TYPES
// ====================================================================

async function executeAutomationStep(step) {
    console.log(`Tab ${getCurrentTabId()}: Executing step:`, step);
    
    switch (step.type) {
        // ===== CLASSIC ACTIONS =====
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

        // ===== PLAYWRIGHT-STYLE LOCATORS =====
        case 'getByRole':
            return await executeGetByRoleStep(step);
        case 'getByText':
            return await executeGetByTextStep(step);
        case 'getByPlaceholder':
            return await executeGetByPlaceholderStep(step);

        // ===== PLAYWRIGHT-STYLE ACTIONS =====
        case 'fill':
            return await executeFillStep(step);
        case 'setInputFiles':
            return await executeSetInputFilesStep(step);

        // ===== DATA EXTRACTION =====
        case 'innerText':
            return await executeInnerTextStep(step);
        case 'textContent':
            return await executeTextContentStep(step);
        case 'inputValue':
            return await executeInputValueStep(step);

        default:
            throw new Error(`Loại bước không được hỗ trợ: ${step.type}`);
    }
}

// ====================================================================
// CLASSIC STEP EXECUTION FUNCTIONS - ENHANCED
// ====================================================================

async function executeClickStep(step) {
    const x = parseInt(step.x);
    const y = parseInt(step.y);
    executeClick(x, y);
    return { x, y, clicked: true, tabId: getCurrentTabId() };
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
    
    return { selector: step.selector, clicked: true, x, y, tabId: getCurrentTabId() };
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
        
        element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.value += char;
        } else {
            element.textContent += char;
        }
        
        element.dispatchEvent(new InputEvent('input', { data: char, bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
        
        await sleep(50);
    }
    
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return { selector: step.selector, text: text, tabId: getCurrentTabId() };
}

async function executeWaitStep(step) {
    const duration = parseInt(step.duration) || 1000;
    await sleep(duration);
    return { waited: duration, tabId: getCurrentTabId() };
}

async function executeScrollStep(step) {
    const currentScroll = {
        x: window.pageXOffset || document.documentElement.scrollLeft,
        y: window.pageYOffset || document.documentElement.scrollTop
    };
    
    let targetX, targetY;
    
    // Handle percentage scrolling
    if (step.percentageY !== undefined) {
        const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
        targetY = (step.percentageY / 100) * documentHeight;
        targetX = step.x || currentScroll.x;
    }
    // Handle delta scrolling (relative)
    else if (step.delta !== undefined) {
        targetX = currentScroll.x;
        targetY = currentScroll.y + step.delta;
    }
    // Handle relative scrolling
    else if (step.relative === true) {
        targetX = currentScroll.x + (step.x || 0);
        targetY = currentScroll.y + (step.y || 0);
    }
    // Handle absolute scrolling (default)
    else {
        targetX = parseInt(step.x) || 0;
        targetY = parseInt(step.y) || 0;
    }
    
    // Ensure scroll position is within bounds
    const maxScrollX = document.documentElement.scrollWidth - window.innerWidth;
    const maxScrollY = document.documentElement.scrollHeight - window.innerHeight;
    
    targetX = Math.max(0, Math.min(targetX, maxScrollX));
    targetY = Math.max(0, Math.min(targetY, maxScrollY));
    
    const smooth = step.smooth !== false;
    
    if (smooth) {
        window.scrollTo({ left: targetX, top: targetY, behavior: 'smooth' });
        // Wait for smooth scroll to complete
        await sleep(1000);
    } else {
        window.scrollTo(targetX, targetY);
    }
    
    return { 
        scrolled: true, 
        from: currentScroll, 
        to: { x: targetX, y: targetY }, 
        smooth, 
        tabId: getCurrentTabId() 
    };
}

async function executeHoverStep(step) {
    const element = await waitForSelector(step.selector, step.timeout || 5000);
    
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    
    const hoverEvent = new MouseEvent('mouseenter', {
        view: window, bubbles: true, cancelable: true, clientX: x, clientY: y
    });
    
    element.dispatchEvent(hoverEvent);
    
    return { selector: step.selector, hovered: true, x, y, tabId: getCurrentTabId() };
}

async function executePressStep(step) {
    const key = step.key;
    const modifiers = step.modifiers || [];
    
    const keyEvent = new KeyboardEvent('keydown', {
        key: key,
        code: key,
        ctrlKey: modifiers.includes('ctrl'),
        shiftKey: modifiers.includes('shift'),
        altKey: modifiers.includes('alt'),
        metaKey: modifiers.includes('meta'),
        bubbles: true
    });
    
    document.dispatchEvent(keyEvent);
    
    // Also dispatch keyup
    const keyUpEvent = new KeyboardEvent('keyup', {
        key: key,
        code: key,
        ctrlKey: modifiers.includes('ctrl'),
        shiftKey: modifiers.includes('shift'),
        altKey: modifiers.includes('alt'),
        metaKey: modifiers.includes('meta'),
        bubbles: true
    });
    
    document.dispatchEvent(keyUpEvent);
    
    return { key, modifiers, pressed: true, tabId: getCurrentTabId() };
}

async function executeGotoStep(step) {
    const url = step.url;
    window.location.href = url;
    return { url, navigated: true, tabId: getCurrentTabId() };
}

async function executeSelectOptionStep(step) {
    const selectElement = await waitForSelector(step.selector, step.timeout || 5000);
    const value = step.value;
    
    selectElement.value = value;
    selectElement.dispatchEvent(new Event('change', { bubbles: true }));
    
    return { selector: step.selector, value, selected: true, tabId: getCurrentTabId() };
}

async function executeCheckStep(step) {
    const element = await waitForSelector(step.selector, step.timeout || 5000);
    const checked = step.checked !== false;
    
    element.checked = checked;
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    return { selector: step.selector, checked, tabId: getCurrentTabId() };
}

async function executeGetTextStep(step) {
    const element = await waitForSelector(step.selector, step.timeout || 5000);
    const text = element.textContent || element.value;
    
    return { selector: step.selector, text, tabId: getCurrentTabId() };
}

async function executeGetAttributeStep(step) {
    const element = await waitForSelector(step.selector, step.timeout || 5000);
    const attribute = step.attribute;
    const value = element.getAttribute(attribute);
    
    return { selector: step.selector, attribute, value, tabId: getCurrentTabId() };
}

async function executeWaitForElementStep(step) {
    const element = await waitForSelector(step.selector, step.timeout || 30000);
    
    if (step.visible !== false) {
        // Wait for element to be visible
        await waitForVisible(element, step.timeout || 30000);
    }
    
    return { selector: step.selector, found: true, tabId: getCurrentTabId() };
}

async function executeReloadStep(step) {
    window.location.reload();
    return { reloaded: true, tabId: getCurrentTabId() };
}

// ====================================================================
// PLAYWRIGHT-STYLE LOCATOR FUNCTIONS
// ====================================================================

async function executeGetByRoleStep(step) {
    const element = await findElementByRole(step.role, step.name, step.timeout || 5000);
    
    if (step.action === 'click') {
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
        const clickEvent = new MouseEvent('click', {
            view: window, bubbles: true, cancelable: true, clientX: x, clientY: y
        });
        
        element.dispatchEvent(clickEvent);
        showClickFeedback(x, y, '#10b981');
        
        return { role: step.role, name: step.name, action: 'click', clicked: true, tabId: getCurrentTabId() };
    } else if (step.action === 'hover') {
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
        const hoverEvent = new MouseEvent('mouseenter', {
            view: window, bubbles: true, cancelable: true, clientX: x, clientY: y
        });
        
        element.dispatchEvent(hoverEvent);
        
        return { role: step.role, name: step.name, action: 'hover', hovered: true, tabId: getCurrentTabId() };
    }
    
    return { role: step.role, name: step.name, found: true, tabId: getCurrentTabId() };
}

async function executeGetByTextStep(step) {
    const element = await findElementByText(step.text, step.timeout || 5000);
    
    if (step.action === 'click') {
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
        const clickEvent = new MouseEvent('click', {
            view: window, bubbles: true, cancelable: true, clientX: x, clientY: y
        });
        
        element.dispatchEvent(clickEvent);
        showClickFeedback(x, y, '#10b981');
        
        return { text: step.text, action: 'click', clicked: true, tabId: getCurrentTabId() };
    } else if (step.action === 'hover') {
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
        const hoverEvent = new MouseEvent('mouseenter', {
            view: window, bubbles: true, cancelable: true, clientX: x, clientY: y
        });
        
        element.dispatchEvent(hoverEvent);
        
        return { text: step.text, action: 'hover', hovered: true, tabId: getCurrentTabId() };
    }
    
    return { text: step.text, found: true, tabId: getCurrentTabId() };
}

async function executeGetByPlaceholderStep(step) {
    const element = await findElementByPlaceholder(step.placeholder, step.timeout || 5000);
    
    if (step.action === 'fill' && step.value) {
        element.focus();
        element.value = '';
        element.value = step.value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        return { placeholder: step.placeholder, action: 'fill', value: step.value, filled: true, tabId: getCurrentTabId() };
    } else if (step.action === 'click') {
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
        const clickEvent = new MouseEvent('click', {
            view: window, bubbles: true, cancelable: true, clientX: x, clientY: y
        });
        
        element.dispatchEvent(clickEvent);
        showClickFeedback(x, y, '#10b981');
        
        return { placeholder: step.placeholder, action: 'click', clicked: true, tabId: getCurrentTabId() };
    }
    
    return { placeholder: step.placeholder, found: true, tabId: getCurrentTabId() };
}

// ====================================================================
// PLAYWRIGHT-STYLE ACTION FUNCTIONS
// ====================================================================

async function executeFillStep(step) {
    const element = await waitForSelector(step.selector, step.timeout || 5000);
    element.focus();
    
    // Clear existing content
    element.value = '';
    element.textContent = '';
    
    // Fill with new content
    const text = step.text || '';
    element.value = text;
    element.textContent = text;
    
    // Dispatch events
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    return { selector: step.selector, text: text, filled: true, tabId: getCurrentTabId() };
}

async function executeSetInputFilesStep(step) {
    const element = await waitForSelector(step.selector, step.timeout || 5000);
    
    if (element.type !== 'file') {
        throw new Error(`Element ${step.selector} is not a file input`);
    }
    
    const filePaths = Array.isArray(step.filePaths) ? step.filePaths : [step.filePaths];
    
    // Get files from IndexedDB
    const fileBlobs = [];
    for (const filePath of filePaths) {
        try {
            const fileBlob = await getFileFromIndexedDB(filePath);
            fileBlobs.push(fileBlob);
        } catch (error) {
            console.warn(`Could not load file ${filePath}:`, error);
        }
    }
    
    if (fileBlobs.length === 0) {
        throw new Error('No valid files found to upload');
    }
    
    // Create DataTransfer object to simulate file selection
    const dataTransfer = new DataTransfer();
    fileBlobs.forEach(blob => {
        dataTransfer.items.add(blob);
    });
    
    // Set files on input element
    element.files = dataTransfer.files;
    
    // Dispatch change event
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    return { 
        selector: step.selector, 
        fileCount: fileBlobs.length, 
        filePaths: filePaths, 
        uploaded: true, 
        tabId: getCurrentTabId() 
    };
}

// ====================================================================
// DATA EXTRACTION FUNCTIONS
// ====================================================================

async function executeInnerTextStep(step) {
    const element = await waitForSelector(step.selector, step.timeout || 5000);
    const text = element.innerText;
    
    return { selector: step.selector, innerText: text, tabId: getCurrentTabId() };
}

async function executeTextContentStep(step) {
    const element = await waitForSelector(step.selector, step.timeout || 5000);
    const text = element.textContent;
    
    return { selector: step.selector, textContent: text, tabId: getCurrentTabId() };
}

async function executeInputValueStep(step) {
    const element = await waitForSelector(step.selector, step.timeout || 5000);
    const value = element.value;
    
    return { selector: step.selector, inputValue: value, tabId: getCurrentTabId() };
}

// ====================================================================
// PLAYWRIGHT-STYLE HELPER FUNCTIONS
// ====================================================================

function findElementByRole(role, name, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const findElement = () => {
            // Common role to element mappings
            const roleSelectors = {
                'button': 'button, input[type="button"], input[type="submit"], [role="button"]',
                'link': 'a, [role="link"]',
                'textbox': 'input[type="text"], input[type="email"], input[type="password"], textarea, [role="textbox"]',
                'checkbox': 'input[type="checkbox"], [role="checkbox"]',
                'radio': 'input[type="radio"], [role="radio"]',
                'menuitem': '[role="menuitem"]',
                'tab': '[role="tab"]',
                'option': 'option, [role="option"]'
            };
            
            const selector = roleSelectors[role] || `[role="${role}"]`;
            const elements = document.querySelectorAll(selector);
            
            for (const element of elements) {
                const elementText = element.textContent || element.value || element.getAttribute('aria-label') || element.getAttribute('title');
                if (elementText && elementText.trim().toLowerCase().includes(name.toLowerCase())) {
                    return element;
                }
            }
            
            return null;
        };
        
        const element = findElement();
        if (element) {
            resolve(element);
            return;
        }
        
        const observer = new MutationObserver(() => {
            const element = findElement();
            if (element) {
                observer.disconnect();
                resolve(element);
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Tab ${getCurrentTabId()}: Element with role "${role}" and name "${name}" not found within ${timeout}ms`));
        }, timeout);
    });
}

function findElementByText(text, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const findElement = () => {
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );
            
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.trim().toLowerCase().includes(text.toLowerCase())) {
                    let element = node.parentElement;
                    // Find the closest clickable element
                    while (element && element !== document.body) {
                        if (element.tagName === 'BUTTON' || 
                            element.tagName === 'A' || 
                            element.onclick || 
                            element.getAttribute('role') === 'button' ||
                            getComputedStyle(element).cursor === 'pointer') {
                            return element;
                        }
                        element = element.parentElement;
                    }
                    // If no clickable parent found, return the text node's parent
                    return node.parentElement;
                }
            }
            
            return null;
        };
        
        const element = findElement();
        if (element) {
            resolve(element);
            return;
        }
        
        const observer = new MutationObserver(() => {
            const element = findElement();
            if (element) {
                observer.disconnect();
                resolve(element);
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Tab ${getCurrentTabId()}: Element with text "${text}" not found within ${timeout}ms`));
        }, timeout);
    });
}

function findElementByPlaceholder(placeholder, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const findElement = () => {
            const elements = document.querySelectorAll('input, textarea');
            for (const element of elements) {
                const placeholderText = element.getAttribute('placeholder');
                if (placeholderText && placeholderText.toLowerCase().includes(placeholder.toLowerCase())) {
                    return element;
                }
            }
            return null;
        };
        
        const element = findElement();
        if (element) {
            resolve(element);
            return;
        }
        
        const observer = new MutationObserver(() => {
            const element = findElement();
            if (element) {
                observer.disconnect();
                resolve(element);
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Tab ${getCurrentTabId()}: Element with placeholder "${placeholder}" not found within ${timeout}ms`));
        }, timeout);
    });
}

// ====================================================================
// FILE OPERATIONS FOR SETINPUTFILES
// ====================================================================

async function getFileFromIndexedDB(filePath) {
    return new Promise((resolve, reject) => {
        // Check if we have access to IndexedDB helper
        if (!window.dbHelper) {
            reject(new Error('IndexedDB helper not available'));
            return;
        }
        
        // Parse file path (folder/filename or just filename)
        const pathParts = filePath.split('/');
        const fileName = pathParts[pathParts.length - 1];
        const folderPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';
        
        window.dbHelper.getAllFiles().then(files => {
            const file = files.find(f => 
                f.name === fileName && (f.folderPath || '') === folderPath
            );
            
            if (!file) {
                reject(new Error(`File not found: ${filePath}`));
                return;
            }
            
            // Convert data URL to blob
            fetch(file.data)
                .then(response => response.blob())
                .then(blob => {
                    // Create File object with original name and type
                    const fileObject = new File([blob], file.name, { type: file.type });
                    resolve(fileObject);
                })
                .catch(error => reject(error));
                
        }).catch(error => reject(error));
    });
}

async function listFilesInIndexedDB() {
    if (!window.dbHelper) {
        throw new Error('IndexedDB helper not available');
    }
    
    const files = await window.dbHelper.getAllFiles();
    return files.map(file => ({
        name: file.name,
        path: file.folderPath ? `${file.folderPath}/${file.name}` : file.name,
        size: file.size,
        type: file.type,
        uploadDate: file.uploadDate
    }));
}

// ====================================================================
// UTILITY FUNCTIONS (ENHANCED WITH TAB LOGGING)
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
            reject(new Error(`Tab ${getCurrentTabId()}: Element ${selector} không tìm thấy trong ${timeout}ms`));
        }, timeout);
    });
}

function waitForVisible(element, timeout = 5000) {
    return new Promise((resolve, reject) => {
        if (element.offsetParent !== null) {
            resolve(element);
            return;
        }
        
        const observer = new MutationObserver((mutations, obs) => {
            if (element.offsetParent !== null) {
                obs.disconnect();
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
            reject(new Error(`Tab ${getCurrentTabId()}: Element không hiển thị trong ${timeout}ms`));
        }, timeout);
    });
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

// ====================================================================
// COOKIE HELPER FUNCTIONS
// ====================================================================

function getAllCookiesFromDocument() {
    const cookies = [];
    const cookieString = document.cookie;
    
    if (cookieString) {
        const cookiePairs = cookieString.split(';');
        cookiePairs.forEach(pair => {
            const [name, value] = pair.trim().split('=');
            if (name && value) {
                cookies.push({
                    name: name,
                    value: decodeURIComponent(value),
                    domain: window.location.hostname,
                    path: '/',
                    secure: window.location.protocol === 'https:',
                    httpOnly: false,
                    sameSite: 'Lax'
                });
            }
        });
    }
    
    return cookies;
}

function applyCookiesToDocument(cookies) {
    cookies.forEach(cookie => {
        if (!cookie.httpOnly) { // Can only set non-httpOnly cookies via document.cookie
            let cookieString = `${cookie.name}=${encodeURIComponent(cookie.value)}`;
            
            if (cookie.path) cookieString += `; Path=${cookie.path}`;
            if (cookie.domain) cookieString += `; Domain=${cookie.domain}`;
            if (cookie.secure) cookieString += `; Secure`;
            if (cookie.sameSite) cookieString += `; SameSite=${cookie.sameSite}`;
            
            if (cookie.expirationDate) {
                const expireDate = new Date(cookie.expirationDate * 1000);
                cookieString += `; Expires=${expireDate.toUTCString()}`;
            }

            document.cookie = cookieString;
        }
    });
}

function clearDocumentCookies() {
    const cookies = document.cookie.split(';');
    cookies.forEach(cookie => {
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        if (name) {
            // Set expiration date to past
            document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
            document.cookie = `${name}=; Path=/; Domain=${window.location.hostname}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
            document.cookie = `${name}=; Path=/; Domain=.${window.location.hostname}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        }
    });
}

// ====================================================================
// INITIALIZATION FOR THIS TAB
// ====================================================================

// Create sidebar when content script loads but keep it hidden
createSidebar();

// Prevent multiple initialization
if (!window.automationSuiteInitialized) {
    window.automationSuiteInitialized = true;
    currentTabId = Math.random().toString(36).substr(2, 9);
    console.log(`Enhanced content script initialized for tab: ${getCurrentTabId()}`);
} else {
    console.log(`Content script already initialized for tab: ${getCurrentTabId()}`);
}

// Handle page unload - cleanup
window.addEventListener('beforeunload', () => {
    if (isRecording) {
        stopRecording();
    }
    console.log(`Tab ${getCurrentTabId()} is being unloaded`);
});