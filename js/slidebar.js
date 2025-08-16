// Sidebar Navigation and Communication Script
document.addEventListener('DOMContentLoaded', () => {
    console.log('Sidebar script loaded');

    // ====================================================================
    // NAVIGATION HANDLING
    // ====================================================================
    
    // Handle tab navigation within sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const pageId = item.dataset.page;
            
            // Remove active class from all nav items and pages
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
            
            // Add active class to clicked nav item and corresponding page
            item.classList.add('active');
            const targetPage = document.getElementById(pageId);
            if (targetPage) {
                targetPage.classList.add('active');
                console.log('Switched to page:', pageId);
            }
        });
    });

    // ====================================================================
    // COMMUNICATION WITH PARENT PAGE
    // ====================================================================
    
    // Function to send commands from sidebar to parent content script
    window.sendToParent = function(action, data = {}) {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                source: 'automation-sidebar',
                action: action,
                data: data
            }, '*');
            console.log('Sent to parent:', action, data);
        } else {
            console.warn('No parent window found');
        }
    };

    // Function to execute automation steps on the parent page
    window.runStepOnPage = function(step) {
        return new Promise((resolve, reject) => {
            // Generate unique ID for this request
            const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // Store the promise handlers
            window.pendingRequests = window.pendingRequests || {};
            window.pendingRequests[requestId] = { resolve, reject };
            
            // Send message to background script
            chrome.runtime.sendMessage({ 
                action: 'executeStep', 
                step: step,
                requestId: requestId
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                if (response && response.success) {
                    resolve(response.result);
                } else {
                    reject(new Error(response?.error || 'Step execution failed'));
                }
                
                // Clean up
                if (window.pendingRequests) {
                    delete window.pendingRequests[requestId];
                }
            });
        });
    };

    // Function to get page information
    window.getPageInfo = function() {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'getPageInfo' }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                if (response && response.success) {
                    resolve(response.result);
                } else {
                    reject(new Error(response?.error || 'Failed to get page info'));
                }
            });
        });
    };

    // ====================================================================
    // MESSAGE HANDLING FROM PARENT
    // ====================================================================
    
    // Listen for messages from parent content script
    window.addEventListener('message', (event) => {
        // Only accept messages from parent window
        if (event.source !== window.parent) return;
        
        const { action, data } = event.data;
        console.log('Sidebar received message:', action, data);
        
        // Dispatch custom events that other scripts can listen to
        const customEvent = new CustomEvent('parentMessage', {
            detail: { action, data }
        });
        document.dispatchEvent(customEvent);
    });

    // ====================================================================
    // UTILITY FUNCTIONS
    // ====================================================================
    
    // Show notification within sidebar
    window.showSidebarNotification = function(message, type = 'info', duration = 3000) {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.sidebar-notification');
        existingNotifications.forEach(notif => notif.remove());
        
        const notification = document.createElement('div');
        notification.className = `sidebar-notification sidebar-notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
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
            max-width: 250px;
            word-wrap: break-word;
            animation: slideInRight 0.3s ease;
        `;
        
        // Add animation CSS if not exists
        if (!document.querySelector('#sidebar-animations')) {
            const style = document.createElement('style');
            style.id = 'sidebar-animations';
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
        
        document.body.appendChild(notification);
        
        // Auto remove
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, duration);
    };

    // Confirm dialog for sidebar
    window.confirmSidebar = function(message) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'confirm-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
            `;
            
            const content = document.createElement('div');
            content.style.cssText = `
                background: white;
                padding: 20px;
                border-radius: 8px;
                max-width: 300px;
                text-align: center;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            `;
            
            content.innerHTML = `
                <p style="margin-bottom: 16px; font-size: 14px; color: #333;">${message}</p>
                <div style="display: flex; gap: 8px; justify-content: center;">
                    <button id="confirmYes" style="padding: 8px 16px; background: #4f46e5; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Có</button>
                    <button id="confirmNo" style="padding: 8px 16px; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 4px; cursor: pointer; font-size: 12px;">Không</button>
                </div>
            `;
            
            modal.appendChild(content);
            document.body.appendChild(modal);
            
            content.querySelector('#confirmYes').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(true);
            });
            
            content.querySelector('#confirmNo').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(false);
            });
            
            // Click outside to cancel
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    resolve(false);
                }
            });
        });
    };

    // ====================================================================
    // GLOBAL FUNCTIONS FOR OTHER SCRIPTS
    // ====================================================================
    
    // Make functions globally available for other sidebar scripts
    window.SidebarUtils = {
        sendToParent: window.sendToParent,
        runStepOnPage: window.runStepOnPage,
        getPageInfo: window.getPageInfo,
        showNotification: window.showSidebarNotification,
        confirm: window.confirmSidebar
    };

    // ====================================================================
    // KEYBOARD SHORTCUTS
    // ====================================================================
    
    document.addEventListener('keydown', (event) => {
        // Ctrl/Cmd + number keys to switch tabs
        if ((event.ctrlKey || event.metaKey) && event.key >= '1' && event.key <= '4') {
            event.preventDefault();
            const navItems = document.querySelectorAll('.nav-item');
            const index = parseInt(event.key) - 1;
            if (navItems[index]) {
                navItems[index].click();
            }
        }
        
        // Escape to close modals
        if (event.key === 'Escape') {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                if (modal.style.display === 'block') {
                    modal.style.display = 'none';
                }
            });
        }
    });

    // ====================================================================
    // INITIALIZATION COMPLETE
    // ====================================================================
    
    console.log('Sidebar navigation and communication initialized');
    
    // Notify other scripts that sidebar is ready
    const readyEvent = new CustomEvent('sidebarReady', {
        detail: { timestamp: Date.now() }
    });
    document.dispatchEvent(readyEvent);
});