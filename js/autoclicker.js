// Auto Clicker for Sidebar UI
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're in the sidebar iframe
    if (window.self === window.top) {
        return; // Exit if not in sidebar
    }

    console.log('Auto Clicker sidebar script loaded');

    // Get DOM elements
    const startSelectionBtn = document.getElementById('startSelection');
    const startClickingBtn = document.getElementById('startClicking');
    const stopClickingBtn = document.getElementById('stopClicking');
    const recordActionBtn = document.getElementById('recordAction');
    const delayInput = document.getElementById('delay');
    const maxClicksInput = document.getElementById('maxClicks');
    const coordsDisplay = document.getElementById('coordsDisplay');
    const xCoordEl = document.getElementById('xCoord');
    const yCoordEl = document.getElementById('yCoord');

    // State variables (độc lập cho mỗi tab)
    let currentCoords = null;
    let isRecording = false;

    // ====================================================================
    // EVENT LISTENERS
    // ====================================================================

    // Start location picking
    if (startSelectionBtn) {
        startSelectionBtn.addEventListener('click', () => {
            // Send message to content script on parent page
            sendMessageToParent({ action: "startPicking" });
            
            // Visual feedback
            startSelectionBtn.classList.add('btn-secondary');
            startSelectionBtn.querySelector('.title').textContent = 'Đang chọn...';
        });
    }

    // Start auto clicking
    if (startClickingBtn) {
        startClickingBtn.addEventListener('click', () => {
            if (!currentCoords) {
                showAlert('Vui lòng chọn vị trí trước khi bắt đầu.');
                return;
            }

            const delay = parseInt(delayInput?.value) || 1000;
            const maxClicks = parseInt(maxClicksInput?.value) || 100;

            // Send to background script
            chrome.runtime.sendMessage({
                action: "start",
                interval: delay,
                maxClicks: maxClicks
            }, (response) => {
                if (response?.success) {
                    updateClickingUI(true);
                    showAlert('Auto-click đã bắt đầu!', 'success');
                } else {
                    showAlert('Không thể bắt đầu auto-click: ' + (response?.error || 'Unknown error'));
                }
            });
        });
    }

    // Stop auto clicking
    if (stopClickingBtn) {
        stopClickingBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: "stop" }, (response) => {
                if (response?.success) {
                    updateClickingUI(false);
                    showAlert('Auto-click đã dừng!', 'success');
                } else {
                    showAlert('Không thể dừng auto-click: ' + (response?.error || 'Unknown error'));
                }
            });
        });
    }

    // Record actions
    if (recordActionBtn) {
        recordActionBtn.addEventListener('click', () => {
            if (!isRecording) {
                startRecording();
            } else {
                stopRecording();
            }
        });
    }

    // ====================================================================
    // RECORDING FUNCTIONS
    // ====================================================================

    function startRecording() {
        isRecording = true;
        sendMessageToParent({ action: "startRecording" });
        
        // Update UI
        recordActionBtn.classList.add('btn-danger');
        recordActionBtn.querySelector('.title').textContent = 'Đang ghi...';
        recordActionBtn.querySelector('.desc').textContent = 'Click để dừng';
        
        showAlert('Đã bắt đầu ghi lại hành động!', 'success');
    }

    function stopRecording() {
        isRecording = false;
        sendMessageToParent({ action: "stopRecording" });
        
        // Update UI
        recordActionBtn.classList.remove('btn-danger');
        recordActionBtn.querySelector('.title').textContent = 'Ghi lại';
        recordActionBtn.querySelector('.desc').textContent = 'Record actions';
        
        showAlert('Đã dừng ghi lại!', 'success');
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
                updateCoords(data.coords);
                break;
            case 'recordingStopped':
                if (isRecording) {
                    stopRecording();
                    // You could show recorded actions here
                    console.log('Recorded actions:', data.actions);
                }
                break;
        }
    });

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

    function updateCoords(coords) {
        currentCoords = coords;
        
        if (xCoordEl && yCoordEl && coordsDisplay) {
            xCoordEl.textContent = coords.x;
            yCoordEl.textContent = coords.y;
            coordsDisplay.style.display = 'block';
        }

        // Reset selection button
        if (startSelectionBtn) {
            startSelectionBtn.classList.remove('btn-secondary');
            startSelectionBtn.querySelector('.title').textContent = 'Chọn vị trí';
        }

        // Save coordinates to storage (per tab using tab ID)
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                const tabId = tabs[0].id;
                const storageKey = `coords_${tabId}`;
                chrome.storage.local.set({ [storageKey]: coords });
                
                // Also save global coords for backward compatibility
                chrome.storage.local.set({ coords: coords });
            }
        });

        showAlert('Đã chọn tọa độ: (' + coords.x + ', ' + coords.y + ')', 'success');
    }

    function updateClickingUI(isRunning) {
        if (startClickingBtn && stopClickingBtn) {
            if (isRunning) {
                startClickingBtn.classList.add('btn-secondary');
                startClickingBtn.querySelector('.title').textContent = 'Đang chạy...';
                stopClickingBtn.classList.remove('btn-secondary');
                stopClickingBtn.classList.add('btn-danger');
            } else {
                startClickingBtn.classList.remove('btn-secondary');
                startClickingBtn.querySelector('.title').textContent = 'Bắt đầu';
                stopClickingBtn.classList.remove('btn-danger');
                stopClickingBtn.classList.add('btn-secondary');
            }
        }
    }

    function showAlert(message, type = 'info') {
        // Create a simple alert system for the sidebar
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        alertDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
            color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460'};
            border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#bee5eb'};
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10000;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        document.body.appendChild(alertDiv);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 3000);
    }

    // ====================================================================
    // INITIALIZATION
    // ====================================================================

    // Load saved coordinates for current tab
    function loadSavedCoords() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                const tabId = tabs[0].id;
                const storageKey = `coords_${tabId}`;
                
                chrome.storage.local.get([storageKey, 'coords'], (result) => {
                    // Prefer tab-specific coords, fallback to global coords
                    const coords = result[storageKey] || result.coords;
                    if (coords) {
                        updateCoords(coords);
                    }
                });
            }
        });
    }

    // Load settings
    function loadSettings() {
        chrome.storage.local.get(['defaultDelay', 'defaultMaxClicks'], (result) => {
            if (delayInput && result.defaultDelay) {
                delayInput.value = result.defaultDelay;
            }
            if (maxClicksInput && result.defaultMaxClicks) {
                maxClicksInput.value = result.defaultMaxClicks;
            }
        });
    }

    // Save settings when changed
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

    // Initialize
    loadSavedCoords();
    loadSettings();

    console.log('Auto Clicker sidebar initialized');
});