// Web Automation Suite - Content Script
let isPickingLocation = false;
let isRecording = false;
let recordedActions = [];

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received:', request);
    
    try {
        switch (request.action) {
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
                return true; // Async response
                
            case "startRecording":
                startRecording();
                sendResponse({ success: true, message: "Recording started" });
                break;
                
            case "stopRecording":
                stopRecording();
                sendResponse({ success: true, message: "Recording stopped", actions: recordedActions });
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

// Location picking
function startLocationPicking() {
    if (isPickingLocation) return;
    
    isPickingLocation = true;
    document.body.style.cursor = 'crosshair';
    
    // Add visual overlay
    const overlay = createPickingOverlay();
    document.body.appendChild(overlay);
    
    // Add click handler
    document.addEventListener('click', handleLocationPick, true);
}

function handleLocationPick(event) {
    if (!isPickingLocation) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const coords = { x: event.clientX, y: event.clientY };
    
    // Save coordinates
    chrome.storage.local.set({ coords: coords });
    
    // Send to popup
    chrome.runtime.sendMessage({ 
        action: "updateCoords", 
        coords: coords 
    });
    
    // Clean up
    isPickingLocation = false;
    document.body.style.cursor = 'default';
    document.removeEventListener('click', handleLocationPick, true);
    
    // Remove overlay
    const overlay = document.getElementById('automation-overlay');
    if (overlay) overlay.remove();
    
    // Visual feedback
    showClickFeedback(coords.x, coords.y, '#4f46e5');
    
    console.log('Location picked:', coords);
}

function createPickingOverlay() {
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
    instruction.textContent = '🎯 Click to set auto-click position';
    
    document.body.appendChild(instruction);
    
    // Auto remove after 10 seconds
    setTimeout(() => {
        if (overlay.parentNode) overlay.remove();
        if (instruction.parentNode) instruction.remove();
    }, 10000);
    
    return overlay;
}

// Click execution
function executeClick(x, y) {
    const element = document.elementFromPoint(x, y);
    if (!element) {
        throw new Error(`No element found at (${x}, ${y})`);
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
    
    // Visual feedback
    showClickFeedback(x, y, '#10b981');
    
    console.log(`Click executed at (${x}, ${y})`);
}

// Visual feedback
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
    
    // Add animation CSS if not exists
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

// Automation step execution
async function executeAutomationStep(step) {
    console.log('Executing step:', step);
    
    switch (step.type) {
        case 'click':
            return await executeClickStep(step);
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
        default:
            throw new Error(`Unsupported step type: ${step.type}`);
    }
}

async function executeClickStep(step) {
    const element = await waitForSelector(step.selector, 5000);
    
    // Scroll into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(300);
    
    // Get element position
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    
    // Create click event
    const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y
    });
    
    element.dispatchEvent(clickEvent);
    showClickFeedback(x, y, '#10b981');
    
    return { selector: step.selector, clicked: true };
}

async function executeTypeStep(step) {
    const element = await waitForSelector(step.selector, 5000);
    
    element.focus();
    
    // Clear existing text if needed
    if (step.clear !== false) {
        element.value = '';
        element.textContent = '';
    }
    
    // Type text character by character
    const text = step.text || '';
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
        
        await sleep(50); // Delay between characters
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
    const x = parseInt(step.x) || 0;
    const y = parseInt(step.y) || 0;
    
    window.scrollTo({
        left: x,
        top: y,
        behavior: 'smooth'
    });
    
    return { x: x, y: y };
}

async function executeHoverStep(step) {
    const element = await waitForSelector(step.selector, 5000);
    
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    
    const hoverEvent = new MouseEvent('mouseover', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y
    });
    
    element.dispatchEvent(hoverEvent);
    
    return { selector: step.selector };
}

async function executePressStep(step) {
    const key = step.key || '';
    
    const keyEvent = new KeyboardEvent('keydown', {
        key: key,
        bubbles: true,
        cancelable: true
    });
    
    document.dispatchEvent(keyEvent);
    
    await sleep(100);
    
    const keyUpEvent = new KeyboardEvent('keyup', {
        key: key,
        bubbles: true,
        cancelable: true
    });
    
    document.dispatchEvent(keyUpEvent);
    
    return { key: key };
}

async function executeGotoStep(step) {
    window.location.href = step.url;
    return { url: step.url };
}

// Recording functionality
function startRecording() {
    if (isRecording) return;
    
    isRecording = true;
    recordedActions = [];
    
    // Add event listeners for recording
    document.addEventListener('click', recordClick, true);
    document.addEventListener('input', recordInput, true);
    document.addEventListener('scroll', recordScroll, true);
    
    console.log('Recording started');
}

function stopRecording() {
    if (!isRecording) return;
    
    isRecording = false;
    
    // Remove event listeners
    document.removeEventListener('click', recordClick, true);
    document.removeEventListener('input', recordInput, true);
    document.removeEventListener('scroll', recordScroll, true);
    
    console.log('Recording stopped. Actions:', recordedActions);
    return recordedActions;
}

function recordClick(event) {
    if (!isRecording) return;
    
    const element = event.target;
    const selector = generateSelector(element);
    
    recordedActions.push({
        type: 'click',
        selector: selector,
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

function recordScroll(event) {
    if (!isRecording) return;
    
    recordedActions.push({
        type: 'scroll',
        x: window.scrollX,
        y: window.scrollY,
        timestamp: Date.now()
    });
}

// Utility functions
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
            reject(new Error(`Element ${selector} not found within ${timeout}ms`));
        }, timeout);
    });
}

function generateSelector(element) {
    // Simple selector generation
    if (element.id) {
        return `#${element.id}`;
    }
    
    if (element.className) {
        const classes = element.className.trim().split(/\s+/).join('.');
        return `.${classes}`;
    }
    
    const tagName = element.tagName.toLowerCase();
    const parent = element.parentElement;
    
    if (!parent || parent === document.body) {
        return tagName;
    }
    
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(element);
    
    return `${tagName}:nth-child(${index + 1})`;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getPageInfo() {
    return {
        title: document.title,
        url: window.location.href,
        domain: window.location.hostname,
        elementCount: document.querySelectorAll('*').length,
        hasForm: !!document.querySelector('form'),
        hasInputs: !!document.querySelector('input'),
        hasButtons: !!document.querySelector('button')
    };
}

function analyzePage() {
    const clickableElements = document.querySelectorAll('button, a, input[type="submit"], input[type="button"], [onclick]');
    const inputElements = document.querySelectorAll('input, textarea, select');
    const forms = document.querySelectorAll('form');
    
    return {
        title: document.title,
        url: window.location.href,
        elementCount: document.querySelectorAll('*').length,
        clickableElements: clickableElements.length,
        inputElements: inputElements.length,
        forms: forms.length,
        images: document.querySelectorAll('img').length,
        links: document.querySelectorAll('a').length
    };
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    // Remove any overlays
    const overlay = document.getElementById('automation-overlay');
    if (overlay) overlay.remove();
    
    // Reset cursor
    document.body.style.cursor = 'default';
    
    // Stop recording
    stopRecording();
});

console.log('Web Automation Suite content script loaded');