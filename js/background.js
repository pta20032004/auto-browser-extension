// Enhanced Web Automation Suite - Background Script with Tab Independence
let clickIntervals = new Map(); // Map tabId -> interval
let runningStates = new Map(); // Map tabId -> { isRunning, clickCount, maxClicks }
let tabCoordinates = new Map(); // Map tabId -> { x, y }

// ====================================================================
// TAB STATE MANAGEMENT
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

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    stopAutoClickForTab(tabId);
    runningStates.delete(tabId);
    tabCoordinates.delete(tabId);
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
// MESSAGE LISTENER
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
                sendResponse({ 
                    success: true, 
                    state: { ...state, coords },
                    tabId 
                });
                break;
                
            case "setTabCoords":
                setTabCoords(tabId, request.coords);
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
                
            // Cookie operations
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
// TAB-SPECIFIC SCRIPT EXECUTION
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
                                resolve(retryResponse.result);
                            } else {
                                reject(new Error(retryResponse?.error || 'Step execution failed'));
                            }
                        });
                    });
                    return;
                }
                
                if (response?.success) {
                    resolve(response.result);
                } else {
                    reject(new Error(response?.error || 'Step execution failed'));
                }
            });
        });
    });
}

// ====================================================================
// PAGE INFO FOR SPECIFIC TAB
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

// ====================================================================
// COOKIE MANAGEMENT FOR SPECIFIC TAB
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

        const cookies = await new Promise((resolve, reject) => {
            chrome.cookies.getAll({ domain: domain }, (cookies) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(cookies);
                }
            });
        });

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
        const targetDomain = new URL(targetUrl).hostname;

        for (const cookie of cookies) {
            try {
                const cookieDetails = {
                    url: targetUrl,
                    name: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain || targetDomain,
                    path: cookie.path || '/',
                    secure: cookie.secure || false,
                    httpOnly: cookie.httpOnly || false,
                    sameSite: cookie.sameSite || 'lax'
                };

                if (cookie.expirationDate) {
                    cookieDetails.expirationDate = cookie.expirationDate;
                }

                await new Promise((resolve, reject) => {
                    chrome.cookies.set(cookieDetails, (cookie) => {
                        if (chrome.runtime.lastError) {
                            console.warn('Failed to set cookie:', cookie?.name, chrome.runtime.lastError.message);
                            resolve(); // Continue with other cookies
                        } else {
                            resolve(cookie);
                        }
                    });
                });
            } catch (error) {
                console.warn('Error setting cookie:', cookie.name, error);
            }
        }

        console.log(`Cookies applied for tab ${tabId}`);
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
            chrome.cookies.getAll({ domain: targetDomain }, (cookies) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(cookies);
                }
            });
        });

        // Remove each cookie
        for (const cookie of cookies) {
            try {
                await new Promise((resolve, reject) => {
                    chrome.cookies.remove({
                        url: targetUrl,
                        name: cookie.name
                    }, (details) => {
                        if (chrome.runtime.lastError) {
                            console.warn('Failed to remove cookie:', cookie.name, chrome.runtime.lastError.message);
                        }
                        resolve();
                    });
                });
            } catch (error) {
                console.warn('Error removing cookie:', cookie.name, error);
            }
        }

        console.log(`Cookies cleared for tab ${tabId}`);
    } catch (error) {
        console.error('Failed to clear cookies for tab:', tabId, error);
        throw error;
    }
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
// INITIALIZATION & CLEANUP
// ====================================================================

// Restore tab states on startup
chrome.runtime.onStartup.addListener(async () => {
    console.log('Web Automation Suite started - restoring tab states');
    
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
            'Nhấn vào icon của extension để bắt đầu.'
        );
    }
});

chrome.runtime.onSuspend.addListener(() => {
    // Stop all auto-click processes
    for (const [tabId, intervalId] of clickIntervals.entries()) {
        clearInterval(intervalId);
    }
    clickIntervals.clear();
    console.log('Extension suspended - all auto-click stopped');
});

// Handle tab updates (URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && changeInfo.url) {
        // Stop auto-click if tab navigated to system page
        if (tab.url.startsWith('chrome://') || 
            tab.url.startsWith('chrome-extension://') ||
            tab.url.startsWith('edge://') ||
            tab.url.startsWith('about:')) {
            stopAutoClickForTab(tabId);
        }
    }
});

console.log('Enhanced Background script loaded with tab independence and cookie management');