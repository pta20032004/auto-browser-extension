// Enhanced Web Automation Suite - Background Script v4.1
let clickIntervals = new Map(); // Map tabId -> interval
let runningStates = new Map(); // Map tabId -> { isRunning, clickCount, maxClicks }
let tabCoordinates = new Map(); // Map tabId -> { x, y }
let tabViewportInfo = new Map(); // Map tabId -> viewport info
let tabScrollState = new Map(); // Map tabId -> scroll state for enhanced scroll

// ====================================================================
// TAB STATE MANAGEMENT - ENHANCED
// ====================================================================
function getTabState(tabId) {
    if (!runningStates.has(tabId)) {
        runningStates.set(tabId, {
            isRunning: false,
            clickCount: 0,
            maxClicks: 100
        });
    }
    return runningStates.get(tabId);
}

function setTabState(tabId, state) {
    runningStates.set(tabId, { ...getTabState(tabId), ...state });
}

function getTabCoords(tabId) {
    return tabCoordinates.get(tabId) || null;
}

function setTabCoords(tabId, coords) {
    tabCoordinates.set(tabId, coords);
    // Also save to storage for persistence
    chrome.storage.local.set({ [`coords_${tabId}`]: coords });
}

function getTabViewport(tabId) {
    return tabViewportInfo.get(tabId) || null;
}

function setTabViewport(tabId, viewport) {
    tabViewportInfo.set(tabId, viewport);
    // Store timestamp for freshness tracking
    viewport.lastUpdated = Date.now();
    console.log(`Viewport updated for tab ${tabId}:`, viewport);
}

function getTabScrollState(tabId) {
    return tabScrollState.get(tabId) || { x: 0, y: 0, lastScrollTime: 0 };
}

function setTabScrollState(tabId, scrollState) {
    tabScrollState.set(tabId, { ...scrollState, lastScrollTime: Date.now() });
}

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    stopAutoClickForTab(tabId);
    runningStates.delete(tabId);
    tabCoordinates.delete(tabId);
    tabViewportInfo.delete(tabId);
    tabScrollState.delete(tabId);
    chrome.storage.local.remove([`coords_${tabId}`]);
    console.log(`Cleaned up state for closed tab: ${tabId}`);
});

// ====================================================================
// EXTENSION ICON CLICK HANDLER
// ====================================================================
chrome.action.onClicked.addListener((tab) => {
    // Check if URL is valid for injection
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('about:') ||
        tab.url.startsWith('moz-extension://')) {
        
        console.log('Cannot inject into system page:', tab.url);
        showNotification('Không thể hoạt động', 'Extension không thể chạy trên trang hệ thống này.');
        return;
    }

    // Send message to content script to toggle sidebar
    chrome.tabs.sendMessage(tab.id, { 
        action: "toggle_sidebar",
        tabId: tab.id 
    }, (response) => {
        if (chrome.runtime.lastError) {
            // Content script not found, inject it
            console.log('Content script not found, injecting...');
            injectContentScript(tab.id, () => {
                // After injection, try again
                setTimeout(() => {
                    chrome.tabs.sendMessage(tab.id, { 
                        action: "toggle_sidebar",
                        tabId: tab.id 
                    });
                }, 500);
            });
        } else {
            console.log('Sidebar toggled for tab:', tab.id, response);
        }
    });
});

// ====================================================================
// MESSAGE LISTENER - ENHANCED WITH ALL STEP TYPES
// ====================================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const tabId = sender.tab?.id || request.tabId;
    console.log('Background received:', request, 'from tab:', tabId);
    
    try {
        switch (request.action) {
            case "start":
                startAutoClickForTab(tabId, request.interval, request.maxClicks);
                sendResponse({ success: true, message: "Auto-click started", tabId });
                break;
                
            case "stop":
                stopAutoClickForTab(tabId);
                sendResponse({ success: true, message: "Auto-click stopped", tabId });
                break;
                
            case "getTabState":
                const state = getTabState(tabId);
                const coords = getTabCoords(tabId);
                const viewport = getTabViewport(tabId);
                const scrollState = getTabScrollState(tabId);
                sendResponse({ 
                    success: true, 
                    state: { ...state, coords, viewport, scrollState },
                    tabId 
                });
                break;
                
            case "setTabCoords":
                setTabCoords(tabId, request.coords);
                sendResponse({ success: true, tabId });
                break;

            case "setTabViewport":
                setTabViewport(tabId, request.viewport);
                sendResponse({ success: true, tabId });
                break;

            case "setTabScrollState":
                setTabScrollState(tabId, request.scrollState);
                sendResponse({ success: true, tabId });
                break;
                
            case "executeScript":
                executeAutomationScriptForTab(tabId, request.script)
                    .then(result => sendResponse({ success: true, result, tabId }))
                    .catch(error => sendResponse({ success: false, error: error.message, tabId }));
                return true; // Async response
                
            case "executeStep":
                executeStepForTab(tabId, request.step)
                    .then(result => sendResponse({ success: true, result, tabId }))
                    .catch(error => sendResponse({ success: false, error: error.message, tabId }));
                return true; // Async response
                
            case "getPageInfo":
                getPageInfoForTab(tabId)
                    .then(result => sendResponse({ success: true, result, tabId }))
                    .catch(error => sendResponse({ success: false, error: error.message, tabId }));
                return true;

            case "getViewportInfo":
                getViewportInfoForTab(tabId)
                    .then(result => sendResponse({ success: true, result, tabId }))
                    .catch(error => sendResponse({ success: false, error: error.message, tabId }));
                return true;
                
            // ENHANCED COOKIE OPERATIONS
            case "getAllCookies":
                getAllCookiesForTab(tabId)
                    .then(cookies => sendResponse({ success: true, cookies, tabId }))
                    .catch(error => sendResponse({ success: false, error: error.message, tabId }));
                return true;
                
            case "setCookies":
                setCookiesForTab(tabId, request.cookies, request.url)
                    .then(() => sendResponse({ success: true, message: "Cookies set", tabId }))
                    .catch(error => sendResponse({ success: false, error: error.message, tabId }));
                return true;
                
            case "clearCookies":
                clearCookiesForTab(tabId, request.url)
                    .then(() => sendResponse({ success: true, message: "Cookies cleared", tabId }))
                    .catch(error => sendResponse({ success: false, error: error.message, tabId }));
                return true;
                
            // Coordinates update from specific tab
            case "updateCoords":
                setTabCoords(tabId, request.coords);
                // Only notify the same tab (no broadcast)
                chrome.tabs.sendMessage(tabId, {
                    action: "coordsUpdated",
                    coords: request.coords,
                    tabId: tabId
                }, () => {
                    if (chrome.runtime.lastError) {
                        console.log('Could not notify tab:', tabId);
                    }
                });
                sendResponse({ success: true, tabId });
                break;

            // Enhanced scroll operations
            case "updateScrollState":
                setTabScrollState(tabId, request.scrollState);
                sendResponse({ success: true, tabId });
                break;

            // FILE OPERATIONS FOR SETINPUTFILES
            case "getFileFromIndexedDB":
                getFileFromIndexedDBForTab(tabId, request.filePath)
                    .then(fileBlob => sendResponse({ success: true, fileBlob, tabId }))
                    .catch(error => sendResponse({ success: false, error: error.message, tabId }));
                return true;

            case "listFilesInIndexedDB":
                listFilesInIndexedDBForTab(tabId)
                    .then(files => sendResponse({ success: true, files, tabId }))
                    .catch(error => sendResponse({ success: false, error: error.message, tabId }));
                return true;
                
            default:
                sendResponse({ success: false, error: "Unknown action", tabId });
        }
    } catch (error) {
        console.error('Background error:', error);
        sendResponse({ success: false, error: error.message, tabId });
    }
    
    return true;
});

// ====================================================================
// TAB-SPECIFIC AUTO-CLICK FUNCTIONS
// ====================================================================
function startAutoClickForTab(tabId, interval, maxClicksCount = 100) {
    if (clickIntervals.has(tabId)) {
        clearInterval(clickIntervals.get(tabId));
    }
    
    const state = getTabState(tabId);
    if (state.isRunning) {
        console.log(`Auto-click already running for tab: ${tabId}`);
        return;
    }
    
    const coords = getTabCoords(tabId);
    if (!coords) {
        showNotification('Lỗi', `Tab ${tabId}: Chưa có tọa độ. Vui lòng chọn vị trí trước.`);
        return;
    }
    
    const { x, y } = coords;
    setTabState(tabId, {
        isRunning: true,
        clickCount: 0,
        maxClicks: maxClicksCount
    });
    
    const intervalId = setInterval(() => {
        const currentState = getTabState(tabId);
        
        if (currentState.clickCount >= currentState.maxClicks) {
            stopAutoClickForTab(tabId);
            showNotification('Hoàn tất Auto-Click', `Tab ${tabId}: Đã thực hiện ${currentState.clickCount} clicks`);
            return;
        }
        
        // Check if tab still exists
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError || !tab) {
                stopAutoClickForTab(tabId);
                return;
            }
            
            if (tab.url.startsWith('chrome://') || 
                tab.url.startsWith('chrome-extension://') ||
                tab.url.startsWith('edge://') ||
                tab.url.startsWith('about:')) {
                stopAutoClickForTab(tabId);
                showNotification('Lỗi', `Tab ${tabId}: Không thể click trên các trang hệ thống.`);
                return;
            }
            
            chrome.tabs.sendMessage(tabId, { 
                action: "executeClick", 
                x, 
                y,
                tabId: tabId
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error(`Click error for tab ${tabId}:`, chrome.runtime.lastError.message);
                    injectContentScript(tabId);
                    return;
                }
                
                if (response?.success) {
                    const newState = getTabState(tabId);
                    setTabState(tabId, { clickCount: newState.clickCount + 1 });
                    console.log(`Tab ${tabId}: Click ${newState.clickCount + 1}/${newState.maxClicks}`);
                }
            });
        });
    }, interval);
    
    clickIntervals.set(tabId, intervalId);
    console.log(`Started Auto-click for tab ${tabId}: delay ${interval}ms, max ${maxClicksCount} clicks`);
}

function stopAutoClickForTab(tabId) {
    if (clickIntervals.has(tabId)) {
        clearInterval(clickIntervals.get(tabId));
        clickIntervals.delete(tabId);
    }
    
    setTabState(tabId, { 
        isRunning: false, 
        clickCount: 0 
    });
    
    console.log(`Stopped Auto-click for tab: ${tabId}`);
}

// ====================================================================
// TAB-SPECIFIC SCRIPT EXECUTION - ENHANCED WITH ALL STEP TYPES
// ====================================================================
async function executeAutomationScriptForTab(tabId, script) {
    const steps = script.steps || script;
    const results = [];
    
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        console.log(`Tab ${tabId}: Executing step ${i + 1}:`, step);
        
        try {
            const result = await executeStepForTab(tabId, step);
            results.push({ step: i + 1, success: true, result, tabId });
            await sleep(500);
        } catch (error) {
            console.error(`Tab ${tabId}: Step ${i + 1} failed:`, error);
            results.push({ step: i + 1, success: false, error: error.message, tabId });
            throw error;
        }
    }
    
    return { completed: true, results, tabId };
}

function executeStepForTab(tabId, step) {
    return new Promise((resolve, reject) => {
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError || !tab) {
                reject(new Error(`Tab ${tabId} không tồn tại`));
                return;
            }
            
            // Validate step type before execution
            const supportedStepTypes = [
                // Classic actions
                'click', 'clickElement', 'type', 'wait', 'scroll', 'hover', 'press', 
                'goto', 'selectOption', 'check', 'getText', 'getAttribute', 
                'waitForElement', 'reload',
                // Playwright-style locators  
                'getByRole', 'getByText', 'getByPlaceholder',
                // Playwright-style actions
                'fill', 'setInputFiles',
                // Data extraction
                'innerText', 'textContent', 'inputValue'
            ];

            if (!supportedStepTypes.includes(step.type)) {
                reject(new Error(`Unsupported step type: ${step.type}. Supported types: ${supportedStepTypes.join(', ')}`));
                return;
            }

            chrome.tabs.sendMessage(tabId, {
                action: "executeStep",
                step: step,
                tabId: tabId
            }, (response) => {
                if (chrome.runtime.lastError) {
                    injectContentScript(tabId, () => {
                        chrome.tabs.sendMessage(tabId, {
                            action: "executeStep",
                            step: step,
                            tabId: tabId
                        }, (retryResponse) => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                                return;
                            }
                            
                            if (retryResponse?.success) {
                                // Update scroll state if this was a scroll step
                                if (step.type === 'scroll' && retryResponse.result) {
                                    const scrollResult = retryResponse.result;
                                    if (scrollResult.to) {
                                        setTabScrollState(tabId, scrollResult.to);
                                    }
                                }
                                resolve(retryResponse.result);
                            } else {
                                reject(new Error(retryResponse?.error || 'Step execution failed'));
                            }
                        });
                    });
                    return;
                }
                
                if (response?.success) {
                    // Update scroll state if this was a scroll step
                    if (step.type === 'scroll' && response.result) {
                        const scrollResult = response.result;
                        if (scrollResult.to) {
                            setTabScrollState(tabId, scrollResult.to);
                        }
                    }
                    resolve(response.result);
                } else {
                    reject(new Error(response?.error || 'Step execution failed'));
                }
            });
        });
    });
}

// ====================================================================
// PAGE INFO FOR SPECIFIC TAB - ENHANCED WITH VIEWPORT
// ====================================================================
async function getPageInfoForTab(tabId) {
    return new Promise((resolve, reject) => {
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError || !tab) {
                reject(new Error(`Tab ${tabId} không tồn tại`));
                return;
            }
            
            chrome.tabs.sendMessage(tabId, {
                action: "getPageInfo",
                tabId: tabId
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                if (response?.success) {
                    resolve({ ...response.result, tabId });
                } else {
                    reject(new Error(response?.error || 'Failed to get page info'));
                }
            });
        });
    });
}

async function getViewportInfoForTab(tabId) {
    return new Promise((resolve, reject) => {
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError || !tab) {
                reject(new Error(`Tab ${tabId} không tồn tại`));
                return;
            }
            
            chrome.tabs.sendMessage(tabId, {
                action: "getViewportInfo",
                tabId: tabId
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                if (response?.success) {
                    // Cache viewport info with enhanced data
                    const enhancedViewport = {
                        ...response.result,
                        tabId,
                        lastUpdated: Date.now(),
                        userAgent: tab.userAgent || 'unknown'
                    };
                    setTabViewport(tabId, enhancedViewport);
                    resolve(enhancedViewport);
                } else {
                    reject(new Error(response?.error || 'Failed to get viewport info'));
                }
            });
        });
    });
}

// ====================================================================
// ENHANCED COOKIE MANAGEMENT FOR SPECIFIC TAB
// ====================================================================

async function getAllCookiesForTab(tabId) {
    try {
        const tab = await new Promise((resolve, reject) => {
            chrome.tabs.get(tabId, (tab) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(tab);
                }
            });
        });

        if (!tab) {
            throw new Error(`Tab ${tabId} không tồn tại`);
        }

        const url = new URL(tab.url);
        const domain = url.hostname;

        // Get cookies for all related domains
        const cookies = await new Promise((resolve, reject) => {
            chrome.cookies.getAll({}, (allCookies) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    // Filter cookies for current domain and subdomains
                    const relevantCookies = allCookies.filter(cookie => {
                        return cookie.domain === domain || 
                               cookie.domain === `.${domain}` ||
                               domain.endsWith(cookie.domain.replace('.', '')) ||
                               cookie.domain.endsWith(domain);
                    });
                    resolve(relevantCookies);
                }
            });
        });

        console.log(`Retrieved ${cookies.length} cookies for tab ${tabId} (${domain})`);
        return cookies;
    } catch (error) {
        console.error('Failed to get cookies for tab:', tabId, error);
        throw error;
    }
}

async function setCookiesForTab(tabId, cookies, url) {
    try {
        const tab = await new Promise((resolve, reject) => {
            chrome.tabs.get(tabId, (tab) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(tab);
                }
            });
        });

        if (!tab) {
            throw new Error(`Tab ${tabId} không tồn tại`);
        }

        const targetUrl = url || tab.url;
        const parsedUrl = new URL(targetUrl);
        const targetDomain = parsedUrl.hostname;

        let successCount = 0;
        let errorCount = 0;

        for (const cookie of cookies) {
            try {
                const cookieDetails = {
                    url: targetUrl,
                    name: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain || targetDomain,
                    path: cookie.path || '/',
                    secure: cookie.secure !== undefined ? cookie.secure : parsedUrl.protocol === 'https:',
                    httpOnly: cookie.httpOnly || false,
                    sameSite: cookie.sameSite || 'lax'
                };

                if (cookie.expirationDate) {
                    cookieDetails.expirationDate = cookie.expirationDate;
                }

                await new Promise((resolve, reject) => {
                    chrome.cookies.set(cookieDetails, (result) => {
                        if (chrome.runtime.lastError) {
                            console.warn(`Failed to set cookie ${cookie.name}:`, chrome.runtime.lastError.message);
                            errorCount++;
                            resolve(); // Continue with other cookies
                        } else {
                            successCount++;
                            resolve(result);
                        }
                    });
                });
            } catch (error) {
                console.warn('Error setting cookie:', cookie.name, error);
                errorCount++;
            }
        }

        console.log(`Cookies applied for tab ${tabId}: ${successCount} success, ${errorCount} errors`);
        
        if (successCount === 0 && errorCount > 0) {
            throw new Error(`Failed to set any cookies (${errorCount} errors)`);
        }
        
    } catch (error) {
        console.error('Failed to set cookies for tab:', tabId, error);
        throw error;
    }
}

async function clearCookiesForTab(tabId, url) {
    try {
        const tab = await new Promise((resolve, reject) => {
            chrome.tabs.get(tabId, (tab) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(tab);
                }
            });
        });

        if (!tab) {
            throw new Error(`Tab ${tabId} không tồn tại`);
        }

        const targetUrl = url || tab.url;
        const targetDomain = new URL(targetUrl).hostname;

        // Get all cookies for this domain
        const cookies = await new Promise((resolve, reject) => {
            chrome.cookies.getAll({}, (allCookies) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    // Filter cookies for current domain
                    const domainCookies = allCookies.filter(cookie => {
                        return cookie.domain === targetDomain || 
                               cookie.domain === `.${targetDomain}` ||
                               targetDomain.endsWith(cookie.domain.replace('.', ''));
                    });
                    resolve(domainCookies);
                }
            });
        });

        // Remove each cookie
        let removedCount = 0;
        for (const cookie of cookies) {
            try {
                await new Promise((resolve, reject) => {
                    const cookieUrl = `${cookie.secure ? 'https' : 'http'}://${cookie.domain}${cookie.path}`;
                    chrome.cookies.remove({
                        url: cookieUrl,
                        name: cookie.name
                    }, (details) => {
                        if (chrome.runtime.lastError) {
                            console.warn('Failed to remove cookie:', cookie.name, chrome.runtime.lastError.message);
                        } else {
                            removedCount++;
                        }
                        resolve();
                    });
                });
            } catch (error) {
                console.warn('Error removing cookie:', cookie.name, error);
            }
        }

        console.log(`Cookies cleared for tab ${tabId}: ${removedCount}/${cookies.length} removed`);
    } catch (error) {
        console.error('Failed to clear cookies for tab:', tabId, error);
        throw error;
    }
}

// ====================================================================
// FILE OPERATIONS FOR SETINPUTFILES STEP
// ====================================================================

async function getFileFromIndexedDBForTab(tabId, filePath) {
    // This would need to interact with the content script's IndexedDB
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
            action: "getFileFromIndexedDB",
            filePath: filePath,
            tabId: tabId
        }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            
            if (response?.success) {
                resolve(response.fileBlob);
            } else {
                reject(new Error(response?.error || 'Failed to get file from IndexedDB'));
            }
        });
    });
}

async function listFilesInIndexedDBForTab(tabId) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
            action: "listFilesInIndexedDB",
            tabId: tabId
        }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            
            if (response?.success) {
                resolve(response.files);
            } else {
                reject(new Error(response?.error || 'Failed to list files from IndexedDB'));
            }
        });
    });
}

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================
function injectContentScript(tabId, callback) {
    chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
            console.error("Cannot get tab info:", chrome.runtime.lastError.message);
            return;
        }

        // Check URL before injection
        if (tab.url.startsWith('chrome://') || 
            tab.url.startsWith('chrome-extension://') ||
            tab.url.startsWith('edge://') ||
            tab.url.startsWith('about:') ||
            tab.url.startsWith('moz-extension://')) {
            
            console.log('Cannot inject content script into system page:', tab.url);
            return;
        }

        // Inject content script
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['js/content.js']
        }, () => {
            if (chrome.runtime.lastError) {
                console.error("Content script injection failed:", chrome.runtime.lastError.message);
            } else {
                console.log(`Content script injected successfully for tab: ${tabId}`);
                if (callback) {
                    setTimeout(callback, 500);
                }
            }
        });
    });
}

function showNotification(title, message) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL("icons/icon48.png"),
        title: title,
        message: message
    }, (notificationId) => {
        if (chrome.runtime.lastError) {
            console.error('Notification error:', chrome.runtime.lastError.message);
        }
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ====================================================================
// INITIALIZATION & CLEANUP - ENHANCED
// ====================================================================

// Restore tab states on startup
chrome.runtime.onStartup.addListener(async () => {
    console.log('Web Automation Suite v4.1 started - restoring tab states');
    
    // Get all tabs and restore their coordinates
    chrome.tabs.query({}, async (tabs) => {
        for (const tab of tabs) {
            const result = await chrome.storage.local.get([`coords_${tab.id}`]);
            if (result[`coords_${tab.id}`]) {
                setTabCoords(tab.id, result[`coords_${tab.id}`]);
                console.log(`Restored coordinates for tab ${tab.id}`);
            }
        }
    });
});

chrome.runtime.onInstalled.addListener((details) => {
    console.log('Extension installed/updated:', details.reason);
    
    if (details.reason === 'install') {
        showNotification(
            'Cài đặt thành công!', 
            'Web Automation Suite v4.1 đã sẵn sàng với Enhanced Scroll & Playwright support.'
        );
    } else if (details.reason === 'update') {
        showNotification(
            'Cập nhật thành công!', 
            'v4.1: Enhanced Scroll (4 modes), Real-time Viewport, All Step Types Fixed!'
        );
    }

    // Set default settings with new features
    chrome.storage.local.get([
        'defaultDelay', 'defaultMaxClicks', 'defaultScrollMode', 
        'defaultSmoothScroll', 'autoRefreshViewport', 'viewportRefreshInterval'
    ], (result) => {
        const defaults = {
            defaultDelay: 1000,
            defaultMaxClicks: 100,
            defaultScrollMode: 'absolute',
            defaultSmoothScroll: true,
            autoRefreshViewport: true,
            viewportRefreshInterval: 5
        };

        const updates = {};
        Object.keys(defaults).forEach(key => {
            if (result[key] === undefined) {
                updates[key] = defaults[key];
            }
        });

        if (Object.keys(updates).length > 0) {
            chrome.storage.local.set(updates);
            console.log('Set default settings:', updates);
        }
    });
});

chrome.runtime.onSuspend.addListener(() => {
    // Stop all auto-click processes
    for (const [tabId, intervalId] of clickIntervals.entries()) {
        clearInterval(intervalId);
    }
    clickIntervals.clear();
    console.log('Extension suspended - all auto-click stopped');
});

// Handle tab updates (URL changes) - Enhanced with viewport monitoring
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        // Stop auto-click if tab navigated to system page
        if (tab.url.startsWith('chrome://') || 
            tab.url.startsWith('chrome-extension://') ||
            tab.url.startsWith('edge://') ||
            tab.url.startsWith('about:')) {
            stopAutoClickForTab(tabId);
        }
        
        // Update viewport info when page loads
        setTimeout(() => {
            getViewportInfoForTab(tabId).catch(error => {
                console.log(`Could not get viewport info for tab ${tabId}:`, error.message);
            });
        }, 1000);

        // Reset scroll state for new page
        setTabScrollState(tabId, { x: 0, y: 0 });
    }
});

// Handle tab activation (switching between tabs) - Enhanced
chrome.tabs.onActivated.addListener((activeInfo) => {
    const tabId = activeInfo.tabId;
    
    // Get viewport info for the active tab
    setTimeout(() => {
        getViewportInfoForTab(tabId).catch(error => {
            console.log(`Could not get viewport info for active tab ${tabId}:`, error.message);
        });
    }, 500);
});

// Periodic cleanup of old data - Enhanced
setInterval(() => {
    // Clean up viewport info for non-existent tabs
    chrome.tabs.query({}, (tabs) => {
        const existingTabIds = new Set(tabs.map(tab => tab.id));
        
        for (const tabId of tabViewportInfo.keys()) {
            if (!existingTabIds.has(tabId)) {
                tabViewportInfo.delete(tabId);
                tabScrollState.delete(tabId);
                console.log(`Cleaned up viewport/scroll info for non-existent tab: ${tabId}`);
            }
        }
    });
}, 300000); // Every 5 minutes

// Monitor viewport changes - New feature
setInterval(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            const tabId = tabs[0].id;
            
            // Check if auto-refresh is enabled
            chrome.storage.local.get(['autoRefreshViewport'], (result) => {
                if (result.autoRefreshViewport !== false) {
                    getViewportInfoForTab(tabId).catch(error => {
                        // Silently handle errors for viewport monitoring
                        console.log(`Viewport monitoring failed for tab ${tabId}:`, error.message);
                    });
                }
            });
        }
    });
}, 10000); // Every 10 seconds for active tab

console.log('Enhanced Background script v4.1 loaded with complete step support, enhanced scroll, and real-time viewport monitoring');