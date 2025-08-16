// Web Automation Suite - Background Script
let clickInterval = null;
let isRunning = false;
let clickCount = 0;
let maxClicks = 100;

// ====================================================================
// XỬ LÝ NHẤN VÀO EXTENSION ICON
// ====================================================================
chrome.action.onClicked.addListener((tab) => {
    // Kiểm tra URL trước khi inject - không inject vào trang hệ thống
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('about:') ||
        tab.url.startsWith('moz-extension://')) {
        
        console.log('Cannot inject into system page:', tab.url);
        showNotification('Không thể hoạt động', 'Extension không thể chạy trên trang hệ thống này.');
        return;
    }

    // Gửi message đến content script để toggle sidebar
    chrome.tabs.sendMessage(tab.id, { 
        action: "toggle_sidebar" 
    }, (response) => {
        if (chrome.runtime.lastError) {
            // Nếu content script chưa được inject, inject nó
            console.log('Content script not found, injecting...');
            injectContentScript(tab.id, () => {
                // Sau khi inject thành công, gửi lại message
                setTimeout(() => {
                    chrome.tabs.sendMessage(tab.id, { 
                        action: "toggle_sidebar" 
                    });
                }, 500);
            });
        } else {
            console.log('Sidebar toggled:', response);
        }
    });
});

// ====================================================================
// MESSAGE LISTENER
// ====================================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received:', request);
    
    try {
        switch (request.action) {
            case "start":
                startAutoClick(request.interval, request.maxClicks);
                sendResponse({ success: true, message: "Auto-click started" });
                break;
                
            case "stop":
                stopAutoClick();
                sendResponse({ success: true, message: "Auto-click stopped" });
                break;
                
            case "executeScript":
                executeAutomationScript(request.script)
                    .then(result => sendResponse({ success: true, result }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true; // Async response
                
            case "executeStep":
                executeStep(request.step)
                    .then(result => sendResponse({ success: true, result }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true; // Async response
                
            case "getPageInfo":
                getPageInfo()
                    .then(result => sendResponse({ success: true, result }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true;
                
            // Chuyển tiếp message cập nhật tọa độ đến tất cả các tab
            case "updateCoords":
                // Broadcast đến tất cả tabs đang mở extension
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, {
                            action: "coordsUpdated",
                            coords: request.coords
                        }, () => {
                            // Ignore errors for tabs without content script
                            if (chrome.runtime.lastError) {
                                console.log('Tab không có content script:', tab.id);
                            }
                        });
                    });
                });
                sendResponse({ success: true });
                break;
                
            default:
                sendResponse({ success: false, error: "Unknown action" });
        }
    } catch (error) {
        console.error('Background error:', error);
        sendResponse({ success: false, error: error.message });
    }
    
    return true;
});

// ====================================================================
// AUTO-CLICK FUNCTIONS
// ====================================================================
function startAutoClick(interval, maxClicksCount = 100) {
    if (clickInterval) {
        clearInterval(clickInterval);
    }
    
    if (isRunning) {
        console.log("Auto-click already running");
        return;
    }
    
    chrome.storage.local.get(['coords'], (result) => {
        if (!result.coords) {
            showNotification('Lỗi', 'Chưa có tọa độ. Vui lòng chọn vị trí trước.');
            return;
        }
        
        const { x, y } = result.coords;
        isRunning = true;
        clickCount = 0;
        maxClicks = maxClicksCount;
        
        clickInterval = setInterval(() => {
            if (clickCount >= maxClicks) {
                stopAutoClick();
                showNotification('Hoàn tất Auto-Click', `Đã thực hiện ${clickCount} clicks`);
                return;
            }
            
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length === 0) {
                    stopAutoClick();
                    return;
                }
                
                const tab = tabs[0];
                
                if (tab.url.startsWith('chrome://') || 
                    tab.url.startsWith('chrome-extension://') ||
                    tab.url.startsWith('edge://') ||
                    tab.url.startsWith('about:')) {
                    stopAutoClick();
                    showNotification('Lỗi', 'Không thể click trên các trang hệ thống.');
                    return;
                }
                
                chrome.tabs.sendMessage(tab.id, { 
                    action: "executeClick", 
                    x, 
                    y 
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Lỗi Click:", chrome.runtime.lastError.message);
                        injectContentScript(tab.id);
                        return;
                    }
                    
                    if (response?.success) {
                        clickCount++;
                        console.log(`Click ${clickCount}/${maxClicks} thành công`);
                    }
                });
            });
        }, interval);
        
        console.log(`Bắt đầu Auto-click: delay ${interval}ms, tối đa ${maxClicks} clicks`);
    });
}

function stopAutoClick() {
    if (clickInterval) {
        clearInterval(clickInterval);
        clickInterval = null;
    }
    isRunning = false;
    clickCount = 0;
    console.log("Đã dừng Auto-click");
}

// ====================================================================
// SCRIPT EXECUTION
// ====================================================================
async function executeAutomationScript(script) {
    const steps = script.steps || script;
    const results = [];
    
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        console.log(`Thực hiện bước ${i + 1}:`, step);
        
        try {
            const result = await executeStep(step);
            results.push({ step: i + 1, success: true, result });
            await sleep(500);
        } catch (error) {
            console.error(`Bước ${i + 1} thất bại:`, error);
            results.push({ step: i + 1, success: false, error: error.message });
            throw error;
        }
    }
    
    return { completed: true, results };
}

function executeStep(step) {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                reject(new Error('Không tìm thấy tab đang hoạt động'));
                return;
            }
            
            const tab = tabs[0];
            
            chrome.tabs.sendMessage(tab.id, {
                action: "executeStep",
                step: step
            }, (response) => {
                if (chrome.runtime.lastError) {
                    injectContentScript(tab.id, () => {
                        chrome.tabs.sendMessage(tab.id, {
                            action: "executeStep",
                            step: step
                        }, (retryResponse) => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                                return;
                            }
                            
                            if (retryResponse?.success) {
                                resolve(retryResponse.result);
                            } else {
                                reject(new Error(retryResponse?.error || 'Thực thi bước thất bại'));
                            }
                        });
                    });
                    return;
                }
                
                if (response?.success) {
                    resolve(response.result);
                } else {
                    reject(new Error(response?.error || 'Thực thi bước thất bại'));
                }
            });
        });
    });
}

// ====================================================================
// PAGE INFO
// ====================================================================
async function getPageInfo() {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                reject(new Error('Không có tab đang hoạt động'));
                return;
            }
            
            const tab = tabs[0];
            
            chrome.tabs.sendMessage(tab.id, {
                action: "getPageInfo"
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                if (response?.success) {
                    resolve(response.result);
                } else {
                    reject(new Error(response?.error || 'Lấy thông tin trang thất bại'));
                }
            });
        });
    });
}

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================
function injectContentScript(tabId, callback) {
    // Lấy thông tin tab để kiểm tra URL
    chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
            console.error("Không thể lấy thông tin tab:", chrome.runtime.lastError.message);
            return;
        }

        // Kiểm tra URL trước khi inject
        if (tab.url.startsWith('chrome://') || 
            tab.url.startsWith('chrome-extension://') ||
            tab.url.startsWith('edge://') ||
            tab.url.startsWith('about:') ||
            tab.url.startsWith('moz-extension://')) {
            
            console.log('Cannot inject content script into system page:', tab.url);
            return;
        }

        // Tiến hành inject content script
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['js/content.js']
        }, () => {
            if (chrome.runtime.lastError) {
                console.error("Tiêm content script thất bại:", chrome.runtime.lastError.message);
            } else {
                console.log("Tiêm content script thành công");
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
            console.error('Lỗi thông báo:', chrome.runtime.lastError.message);
        }
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ====================================================================
// EXTENSION LIFECYCLE
// ====================================================================
chrome.runtime.onStartup.addListener(() => {
    console.log('Web Automation Suite đã khởi động');
});

chrome.runtime.onInstalled.addListener((details) => {
    console.log('Extension đã được cài đặt/cập nhật:', details.reason);
    
    if (details.reason === 'install') {
        showNotification(
            'Cài đặt thành công!', 
            'Nhấn vào icon của extension để bắt đầu.'
        );
    }
});

chrome.runtime.onSuspend.addListener(() => {
    stopAutoClick();
    console.log('Extension đã bị tạm ngưng');
});

console.log('Background script đã được tải');