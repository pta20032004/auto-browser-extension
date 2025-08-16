// Enhanced Auto Clicker for Sidebar UI - Tab Independent
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're in the sidebar iframe
    if (window.self === window.top) {
        return; // Exit if not in sidebar
    }

    console.log('Enhanced Auto Clicker sidebar script loaded');

    // ====================================================================
    // TAB STATE MANAGEMENT
    // ====================================================================
    
    let currentTabId = null;
    let tabState = {
        coords: null,
        isRunning: false,
        isRecording: false,
        clickCount: 0,
        maxClicks: 100,
        isPicking: false
    };

    // Get current tab ID from parent
    function getCurrentTabId() {
        if (!currentTabId) {
            sendMessageToParent({ action: "getTabId" });
        }
        return currentTabId;
    }

    // ====================================================================
    // DOM ELEMENTS
    // ====================================================================
    
    const startSelectionBtn = document.getElementById('startSelection');
    const startClickingBtn = document.getElementById('startClicking');
    const stopClickingBtn = document.getElementById('stopClicking');
    const recordActionBtn = document.getElementById('recordAction');
    const delayInput = document.getElementById('delay');
    const maxClicksInput = document.getElementById('maxClicks');
    const coordsDisplay = document.getElementById('coordsDisplay');
    const xCoordEl = document.getElementById('xCoord');
    const yCoordEl = document.getElementById('yCoord');

    // ====================================================================
    // EVENT LISTENERS
    // ====================================================================

    // Start location picking
    if (startSelectionBtn) {
        startSelectionBtn.addEventListener('click', () => {
            if (!currentTabId) {
                showAlert('Đang khởi tạo tab...', 'warning');
                getCurrentTabId();
                setTimeout(() => {
                    if (currentTabId) {
                        startLocationPicking();
                    } else {
                        showAlert('Không thể xác định tab. Vui lòng thử lại.', 'error');
                        resetSelectionButton();
                    }
                }, 1000);
                return;
            }
            
            if (tabState.isPicking) {
                // If already picking, cancel it
                cancelLocationPicking();
            } else {
                startLocationPicking();
            }
        });
    }

    // Start auto clicking  
    if (startClickingBtn) {
        startClickingBtn.addEventListener('click', () => {
            if (!currentTabId) {
                showAlert('Chưa xác định được tab. Vui lòng thử lại.', 'error');
                return;
            }

            if (!tabState.coords) {
                showAlert('Vui lòng chọn vị trí trước khi bắt đầu.', 'warning');
                return;
            }

            const delay = parseInt(delayInput?.value) || 1000;
            const maxClicks = parseInt(maxClicksInput?.value) || 100;

            // Send to background script with tab ID
            chrome.runtime.sendMessage({
                action: "start",
                interval: delay,
                maxClicks: maxClicks,
                tabId: currentTabId
            }, (response) => {
                if (response?.success) {
                    updateClickingUI(true);
                    showAlert(`Tab ${currentTabId}: Auto-click đã bắt đầu!`, 'success');
                    updateTabState({ isRunning: true, clickCount: 0, maxClicks });
                } else {
                    showAlert('Không thể bắt đầu auto-click: ' + (response?.error || 'Unknown error'), 'error');
                }
            });
        });
    }

    // Stop auto clicking
    if (stopClickingBtn) {
        stopClickingBtn.addEventListener('click', () => {
            if (!currentTabId) {
                showAlert('Chưa xác định được tab.', 'error');
                return;
            }

            chrome.runtime.sendMessage({ 
                action: "stop",
                tabId: currentTabId 
            }, (response) => {
                if (response?.success) {
                    updateClickingUI(false);
                    showAlert(`Tab ${currentTabId}: Auto-click đã dừng!`, 'success');
                    updateTabState({ isRunning: false, clickCount: 0 });
                } else {
                    showAlert('Không thể dừng auto-click: ' + (response?.error || 'Unknown error'), 'error');
                }
            });
        });
    }

    // Record actions
    if (recordActionBtn) {
        recordActionBtn.addEventListener('click', () => {
            if (!tabState.isRecording) {
                startRecording();
            } else {
                stopRecording();
            }
        });
    }

    // ====================================================================
    // TAB-SPECIFIC FUNCTIONS
    // ====================================================================

    function startLocationPicking() {
        if (tabState.isPicking) return;
        
        updateTabState({ isPicking: true });
        sendMessageToParent({ action: "startPicking" });
        
        // Update UI to show picking state
        if (startSelectionBtn) {
            startSelectionBtn.classList.add('btn-secondary');
            startSelectionBtn.querySelector('.title').textContent = 'Đang chọn...';
            startSelectionBtn.querySelector('.desc').textContent = 'Click để hủy';
        }
        
        showAlert(`Tab ${currentTabId}: Click vào vị trí muốn auto-click...`, 'info');
        
        // Auto-cancel after 30 seconds
        setTimeout(() => {
            if (tabState.isPicking) {
                cancelLocationPicking();
                showAlert('Đã hủy chọn tọa độ (timeout)', 'warning');
            }
        }, 30000);
    }

    function cancelLocationPicking() {
        updateTabState({ isPicking: false });
        sendMessageToParent({ action: "cancelPicking" });
        resetSelectionButton();
        showAlert(`Tab ${currentTabId}: Đã hủy chọn tọa độ`, 'info');
    }

    function resetSelectionButton() {
        if (startSelectionBtn) {
            startSelectionBtn.classList.remove('btn-secondary');
            startSelectionBtn.querySelector('.title').textContent = 'Chọn vị trí';
            startSelectionBtn.querySelector('.desc').textContent = 'Click để chọn tọa độ';
        }
    }

    function startRecording() {
        if (!currentTabId) {
            showAlert('Chưa xác định được tab.', 'error');
            return;
        }

        updateTabState({ isRecording: true });
        sendMessageToParent({ action: "startRecording" });
        
        // Update UI
        if (recordActionBtn) {
            recordActionBtn.classList.add('btn-danger');
            recordActionBtn.querySelector('.title').textContent = 'Đang ghi...';
            recordActionBtn.querySelector('.desc').textContent = 'Click để dừng';
        }
        
        showAlert(`Tab ${currentTabId}: Đã bắt đầu ghi lại hành động!`, 'success');
    }

    function stopRecording() {
        updateTabState({ isRecording: false });
        sendMessageToParent({ action: "stopRecording" });
        
        // Update UI
        if (recordActionBtn) {
            recordActionBtn.classList.remove('btn-danger');
            recordActionBtn.querySelector('.title').textContent = 'Ghi lại';
            recordActionBtn.querySelector('.desc').textContent = 'Record actions';
        }
        
        showAlert(`Tab ${currentTabId}: Đã dừng ghi lại!`, 'success');
    }

    // ====================================================================
    // STATE MANAGEMENT
    // ====================================================================

    function updateTabState(newState) {
        tabState = { ...tabState, ...newState };
        console.log(`Tab ${currentTabId} state updated:`, tabState);
    }

    function loadTabState(state) {
        tabState = { ...tabState, ...state };
        
        // Update UI based on loaded state
        if (state.coords) {
            updateCoordsDisplay(state.coords);
        }
        
        if (state.isRunning) {
            updateClickingUI(true);
        }

        if (state.isRecording && recordActionBtn) {
            recordActionBtn.classList.add('btn-danger');
            recordActionBtn.querySelector('.title').textContent = 'Đang ghi...';
        }
        
        console.log(`Tab ${currentTabId} state loaded:`, tabState);
    }

    // ====================================================================
    // MESSAGE HANDLING
    // ====================================================================

    // Listen for messages from parent content script
    window.addEventListener('message', (event) => {
        if (event.source !== window.parent) return;
        
        const { action, data } = event.data;
        
        switch (action) {
            case 'coordsUpdated':
                if (data.coords && data.coords.tabId === currentTabId) {
                    updateCoordsDisplay(data.coords);
                    updateTabState({ coords: data.coords, isPicking: false });
                    resetSelectionButton();
                    console.log(`Tab ${currentTabId}: Coordinates updated:`, data.coords);
                }
                break;
                
            case 'recordingStopped':
                if (data.tabId === currentTabId && tabState.isRecording) {
                    stopRecording();
                    console.log(`Tab ${currentTabId} recorded actions:`, data.actions);
                }
                break;
                
            case 'tabIdResponse':
                currentTabId = data.tabId;
                console.log('Current tab ID set to:', currentTabId);
                loadSavedState();
                break;
                
            case 'tabStateLoaded':
                if (data.tabId === currentTabId) {
                    loadTabState(data.state);
                }
                break;
                
            case 'pickingCanceled':
                if (data.tabId === currentTabId) {
                    updateTabState({ isPicking: false });
                    resetSelectionButton();
                }
                break;
                
            case 'locationInfoResponse':
                // Handle location info for cookie tab
                if (data.hostname && data.href) {
                    const currentDomainInput = document.getElementById('currentDomain');
                    const currentUrlInput = document.getElementById('currentUrl');
                    
                    if (currentDomainInput) currentDomainInput.value = data.hostname;
                    if (currentUrlInput) currentUrlInput.value = data.href;
                }
                break;
        }
    });

    // Listen for custom events from sidebar communication
    document.addEventListener('parentMessage', (event) => {
        const { action, data } = event.detail;
        
        switch (action) {
            case 'coordsUpdated':
                if (data.coords && data.coords.tabId === currentTabId) {
                    updateCoordsDisplay(data.coords);
                    updateTabState({ coords: data.coords, isPicking: false });
                    resetSelectionButton();
                }
                break;
        }
    });

    // ====================================================================
    // UI UPDATE FUNCTIONS
    // ====================================================================

    function updateCoordsDisplay(coords) {
        tabState.coords = coords;
        
        if (xCoordEl && yCoordEl && coordsDisplay) {
            xCoordEl.textContent = coords.x;
            yCoordEl.textContent = coords.y;
            coordsDisplay.style.display = 'block';
        }

        // Reset selection button if picking was in progress
        if (tabState.isPicking) {
            resetSelectionButton();
            updateTabState({ isPicking: false });
        }

        showAlert(`Tab ${currentTabId}: Đã chọn tọa độ (${coords.x}, ${coords.y})`, 'success');
    }

    function updateClickingUI(isRunning) {
        if (startClickingBtn && stopClickingBtn) {
            if (isRunning) {
                startClickingBtn.classList.add('btn-secondary');
                startClickingBtn.querySelector('.title').textContent = 'Đang chạy...';
                startClickingBtn.disabled = true;
                
                stopClickingBtn.classList.remove('btn-secondary');
                stopClickingBtn.classList.add('btn-danger');
                stopClickingBtn.disabled = false;
            } else {
                startClickingBtn.classList.remove('btn-secondary');
                startClickingBtn.querySelector('.title').textContent = 'Bắt đầu';
                startClickingBtn.disabled = false;
                
                stopClickingBtn.classList.remove('btn-danger');
                stopClickingBtn.classList.add('btn-secondary');
                stopClickingBtn.disabled = true;
            }
        }
    }

    // ====================================================================
    // UTILITY FUNCTIONS
    // ====================================================================

    function sendMessageToParent(message) {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                source: 'automation-sidebar',
                ...message
            }, '*');
        }
    }

    function showAlert(message, type = 'info') {
        // Create enhanced alert system for the sidebar
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        alertDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : type === 'warning' ? '#fff3cd' : '#d1ecf1'};
            color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : type === 'warning' ? '#856404' : '#0c5460'};
            border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : type === 'warning' ? '#ffeaa7' : '#bee5eb'};
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 11px;
            z-index: 10000;
            max-width: 280px;
            word-wrap: break-word;
            animation: slideInRight 0.3s ease;
        `;
        
        // Add animation CSS if not exists
        if (!document.querySelector('#sidebar-alert-animations')) {
            const style = document.createElement('style');
            style.id = 'sidebar-alert-animations';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(alertDiv);
        
        // Auto remove after 4 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (alertDiv.parentNode) {
                        alertDiv.parentNode.removeChild(alertDiv);
                    }
                }, 300);
            }
        }, 4000);
    }

    // ====================================================================
    // SETTINGS MANAGEMENT (TAB-SPECIFIC)
    // ====================================================================

    function loadSavedState() {
        if (!currentTabId) return;
        
        // Load tab-specific settings
        chrome.storage.local.get([
            `coords_${currentTabId}`,
            'defaultDelay', 
            'defaultMaxClicks'
        ], (result) => {
            // Load coordinates for this tab
            if (result[`coords_${currentTabId}`]) {
                updateCoordsDisplay(result[`coords_${currentTabId}`]);
            }
            
            // Load default settings
            if (delayInput && result.defaultDelay) {
                delayInput.value = result.defaultDelay;
            }
            if (maxClicksInput && result.defaultMaxClicks) {
                maxClicksInput.value = result.defaultMaxClicks;
            }
        });

        // Get current state from background
        chrome.runtime.sendMessage({ 
            action: "getTabState",
            tabId: currentTabId 
        }, (response) => {
            if (response?.success && response.state) {
                loadTabState(response.state);
            }
        });
    }

    // Save settings when changed (global settings)
    if (delayInput) {
        delayInput.addEventListener('change', () => {
            chrome.storage.local.set({ defaultDelay: parseInt(delayInput.value) });
        });
    }

    if (maxClicksInput) {
        maxClicksInput.addEventListener('change', () => {
            chrome.storage.local.set({ defaultMaxClicks: parseInt(maxClicksInput.value) });
        });
    }

    // ====================================================================
    // INITIALIZATION
    // ====================================================================

    // Get current tab ID first
    getCurrentTabId();
    
    // Load default settings
    chrome.storage.local.get(['defaultDelay', 'defaultMaxClicks'], (result) => {
        if (delayInput && result.defaultDelay) {
            delayInput.value = result.defaultDelay;
        }
        if (maxClicksInput && result.defaultMaxClicks) {
            maxClicksInput.value = result.defaultMaxClicks;
        }
    });

    console.log('Enhanced Auto Clicker sidebar initialized');
});