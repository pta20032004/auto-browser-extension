// Web Automation Suite - Background Script
let clickInterval = null;
let isRunning = false;
let clickCount = 0;
let maxClicks = 100;

// Message listener
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
                
            case "getPageInfo":
                getPageInfo()
                    .then(result => sendResponse({ success: true, result }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true;
                
            default:
                sendResponse({ success: false, error: "Unknown action" });
        }
    } catch (error) {
        console.error('Background error:', error);
        sendResponse({ success: false, error: error.message });
    }
    
    return true;
});

// Auto-click functions
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

// Script execution
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

// Page info
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

// Utility functions
function injectContentScript(tabId, callback) {
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
}

// <<< SỬA LỖI Ở HÀM NÀY
function showNotification(title, message) {
    chrome.notifications.create({
        type: 'basic',
        // Dùng chrome.runtime.getURL để tạo đường dẫn tuyệt đối và đầy đủ
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

// Extension lifecycle
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