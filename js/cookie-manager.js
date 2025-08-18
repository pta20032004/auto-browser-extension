// Fixed Cookie Manager for Auto Clicker Extension
class CookieManager {
    constructor() {
        this.initializeEventListeners();
        this.loadCookiesList();
        this.updateCurrentPageInfo();
    }

    initializeEventListeners() {
        // Export cookies button
        document.getElementById('exportCookiesBtn').addEventListener('click', () => {
            this.exportCurrentCookies();
        });

        // Import cookies button
        document.getElementById('importCookiesBtn').addEventListener('click', () => {
            this.selectCookieFile();
        });

        // Clear all cookies button
        document.getElementById('clearAllCookiesBtn').addEventListener('click', () => {
            this.clearAllCookies();
        });

        // Cookie file input change
        document.getElementById('cookieFileInput').addEventListener('change', (e) => {
            this.handleCookieFileSelection(e);
        });
    }

    async updateCurrentPageInfo() {
        try {
            // Get current page info from parent window
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                    source: 'automation-sidebar',
                    action: 'getLocationInfo'
                }, '*');
            }
        } catch (error) {
            console.warn('Could not get page info:', error);
        }
    }

    async exportCurrentCookies() {
        try {
            const exportBtn = document.getElementById('exportCookiesBtn');
            const originalText = exportBtn.textContent;
            exportBtn.textContent = 'Đang xuất...';
            exportBtn.disabled = true;

            // Get cookies via background script
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ 
                    action: 'getAllCookies'
                }, (response) => {
                    resolve(response);
                });
            });

            if (!response || !response.success) {
                throw new Error(response?.error || 'Không thể lấy cookies từ background script');
            }

            const allCookies = response.cookies;
            console.log('Retrieved cookies:', allCookies);

            if (!allCookies || allCookies.length === 0) {
                this.showAlert('Không tìm thấy cookies nào cho domain này.', 'warning');
                return;
            }

            // Get current domain info
            const currentDomainInput = document.getElementById('currentDomain');
            const currentUrlInput = document.getElementById('currentUrl');
            const currentDomain = currentDomainInput?.value || 'unknown';
            const currentUrl = currentUrlInput?.value || 'unknown';

            // Filter cookies for current domain if we have it
            let domainCookies = allCookies;
            if (currentDomain !== 'unknown') {
                domainCookies = allCookies.filter(cookie => 
                    cookie.domain === currentDomain || 
                    cookie.domain === `.${currentDomain}` ||
                    currentDomain.endsWith(cookie.domain.replace('.', ''))
                );
            }

            if (domainCookies.length === 0) {
                this.showAlert('Không tìm thấy cookies nào cho domain này.', 'warning');
                return;
            }

            // Create cookie data object
            const cookieData = {
                domain: currentDomain,
                url: currentUrl,
                exportDate: new Date().toISOString(),
                userAgent: navigator.userAgent,
                cookies: domainCookies
            };

            // Save to IndexedDB
            const cookieFileName = `cookies_${currentDomain}_${Date.now()}.json`;
            await this.saveCookieData(cookieFileName, cookieData);

            // Also download file
            this.downloadCookieFile(cookieFileName, cookieData);

            this.loadCookiesList();
            this.showAlert(`Đã xuất ${domainCookies.length} cookies thành công!`, 'success');

        } catch (error) {
            console.error('Export cookies failed:', error);
            this.showAlert('Không thể xuất cookies: ' + error.message, 'error');
        } finally {
            const exportBtn = document.getElementById('exportCookiesBtn');
            exportBtn.textContent = 'Xuất Cookies';
            exportBtn.disabled = false;
        }
    }

    async getAllCookies() {
        return new Promise((resolve, reject) => {
            // Always use background script for reliable cookie access
            chrome.runtime.sendMessage({ 
                action: 'getAllCookies' 
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                if (response && response.success) {
                    resolve(response.cookies);
                } else {
                    reject(new Error(response?.error || 'Failed to get cookies'));
                }
            });
        });
    }

    async saveCookieData(fileName, cookieData) {
        // Convert to file-like object
        const jsonString = JSON.stringify(cookieData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        
        // Create file object
        const file = new File([blob], fileName, { type: 'application/json' });
        
        // Save using existing file manager
        return await window.dbHelper.saveFile(file, 'cookies');
    }

    downloadCookieFile(fileName, cookieData) {
        const jsonString = JSON.stringify(cookieData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    selectCookieFile() {
        const fileInput = document.getElementById('cookieFileInput');
        fileInput.accept = '.json';
        fileInput.multiple = false;
        fileInput.click();
    }

    async handleCookieFileSelection(event) {
        const file = event.target.files[0];
        if (!file) return;

        const importBtn = document.getElementById('importCookiesBtn');
        const originalText = importBtn.textContent;
        importBtn.textContent = 'Đang nhập...';
        importBtn.disabled = true;

        try {
            const fileContent = await this.readFileAsText(file);
            const cookieData = JSON.parse(fileContent);

            if (!cookieData.cookies || !Array.isArray(cookieData.cookies)) {
                throw new Error('Định dạng file cookies không hợp lệ');
            }

            // Apply cookies via background script
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ 
                    action: 'setCookies', 
                    cookies: cookieData.cookies
                }, (response) => {
                    resolve(response);
                });
            });

            if (!response || !response.success) {
                throw new Error(response?.error || 'Failed to set cookies');
            }

            // Save imported cookie file to our storage
            const savedFileName = `imported_${file.name}`;
            await this.saveCookieData(savedFileName, cookieData);

            this.loadCookiesList();
            this.showAlert(`Đã nhập ${cookieData.cookies.length} cookies thành công!`, 'success');

            // Suggest page reload
            if (this.confirmAlert('Cookies đã được áp dụng. Bạn có muốn reload trang để đăng nhập?')) {
                // Send reload message to parent
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({
                        source: 'automation-sidebar',
                        action: 'reloadPage'
                    }, '*');
                }
            }

        } catch (error) {
            console.error('Import cookies failed:', error);
            this.showAlert('Không thể nhập cookies: ' + error.message, 'error');
        } finally {
            importBtn.textContent = originalText;
            importBtn.disabled = false;
            event.target.value = ''; // Reset file input
        }
    }

    async clearAllCookies() {
        if (!this.confirmAlert('Bạn có chắc muốn xóa tất cả cookies của domain này?')) {
            return;
        }

        try {
            // Clear via background script
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ 
                    action: 'clearCookies'
                }, (response) => {
                    resolve(response);
                });
            });

            if (response && response.success) {
                this.showAlert('Đã xóa cookies thành công!', 'success');
            } else {
                throw new Error(response?.error || 'Failed to clear cookies');
            }

            if (this.confirmAlert('Bạn có muốn reload trang để áp dụng thay đổi?')) {
                // Send reload message to parent
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({
                        source: 'automation-sidebar',
                        action: 'reloadPage'
                    }, '*');
                }
            }

        } catch (error) {
            console.error('Clear cookies failed:', error);
            this.showAlert('Không thể xóa cookies: ' + error.message, 'error');
        }
    }

    async loadCookiesList() {
        try {
            // Get all files from cookies folder
            const files = await window.dbHelper.getFilesByFolder('cookies');
            const container = document.getElementById('cookiesList');
            container.innerHTML = '';

            if (files.length === 0) {
                container.innerHTML = '<div class="empty-state">Chưa có file cookies nào được lưu.</div>';
                return;
            }

            files.forEach(file => {
                this.renderCookieFileItem(container, file);
            });

        } catch (error) {
            console.error('Failed to load cookies list:', error);
        }
    }

    renderCookieFileItem(container, file) {
        const fileElement = document.createElement('div');
        fileElement.className = 'cookie-file-item';
        fileElement.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            margin-bottom: 8px;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
        `;

        const fileInfo = document.createElement('div');
        fileInfo.style.flex = '1';

        const fileName = document.createElement('div');
        fileName.style.cssText = 'font-size: 12px; font-weight: 500; color: #1e293b; margin-bottom: 4px;';
        fileName.textContent = file.name;

        const fileMeta = document.createElement('div');
        fileMeta.style.cssText = 'font-size: 10px; color: #64748b;';
        fileMeta.textContent = `${this.formatFileSize(file.size)} • ${this.formatDate(file.uploadDate)}`;

        fileInfo.appendChild(fileName);
        fileInfo.appendChild(fileMeta);

        const fileControls = document.createElement('div');
        fileControls.style.cssText = 'display: flex; gap: 4px;';

        // Apply button
        const applyBtn = document.createElement('button');
        applyBtn.textContent = 'Áp dụng';
        applyBtn.style.cssText = 'padding: 4px 8px; font-size: 10px; background: #4f46e5; color: white; border: none; border-radius: 4px; cursor: pointer;';
        applyBtn.onclick = () => this.applyCookieFile(file);
        fileControls.appendChild(applyBtn);

        // Download button
        const downloadBtn = document.createElement('button');
        downloadBtn.textContent = 'Tải';
        downloadBtn.style.cssText = 'padding: 4px 8px; font-size: 10px; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 4px; cursor: pointer;';
        downloadBtn.onclick = () => window.dbHelper.downloadFile(file);
        fileControls.appendChild(downloadBtn);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Xóa';
        deleteBtn.style.cssText = 'padding: 4px 8px; font-size: 10px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;';
        deleteBtn.onclick = () => this.deleteCookieFile(file.id, file.name);
        fileControls.appendChild(deleteBtn);

        fileElement.appendChild(fileInfo);
        fileElement.appendChild(fileControls);
        container.appendChild(fileElement);
    }

    async applyCookieFile(file) {
        try {
            const fileData = await window.dbHelper.getFile(file.id);
            const cookieDataString = await this.dataURLToText(fileData.data);
            const cookieData = JSON.parse(cookieDataString);

            if (!cookieData.cookies || !Array.isArray(cookieData.cookies)) {
                throw new Error('Định dạng file cookies không hợp lệ');
            }

            // Apply via background script
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ 
                    action: 'setCookies', 
                    cookies: cookieData.cookies
                }, (response) => {
                    resolve(response);
                });
            });

            if (!response || !response.success) {
                throw new Error(response?.error || 'Failed to apply cookies');
            }

            this.showAlert(`Đã áp dụng ${cookieData.cookies.length} cookies từ file ${file.name}!`, 'success');

            if (this.confirmAlert('Cookies đã được áp dụng. Bạn có muốn reload trang?')) {
                // Send reload message to parent
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({
                        source: 'automation-sidebar',
                        action: 'reloadPage'
                    }, '*');
                }
            }

        } catch (error) {
            console.error('Apply cookie file failed:', error);
            this.showAlert('Không thể áp dụng cookies: ' + error.message, 'error');
        }
    }

    async deleteCookieFile(fileId, fileName) {
        if (this.confirmAlert(`Bạn có chắc muốn xóa file "${fileName}"?`)) {
            try {
                await window.dbHelper.deleteFile(fileId);
                this.loadCookiesList();
                this.showAlert('Đã xóa file cookies thành công!', 'success');
            } catch (error) {
                console.error('Failed to delete cookie file:', error);
                this.showAlert('Không thể xóa file. Vui lòng thử lại.', 'error');
            }
        }
    }

    // Utility methods
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Không thể đọc file'));
            reader.readAsText(file);
        });
    }

    async dataURLToText(dataURL) {
        const response = await fetch(dataURL);
        return await response.text();
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    showAlert(message, type = 'info') {
        // Use the existing alert system from file manager
        if (window.SidebarUtils && window.SidebarUtils.showNotification) {
            window.SidebarUtils.showNotification(message, type);
        } else {
            // Fallback notification
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
            
            document.body.appendChild(alertDiv);
            
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.parentNode.removeChild(alertDiv);
                }
            }, 4000);
        }
    }

    confirmAlert(message) {
        return confirm(message);
    }
}

// Initialize cookie manager when page loads
let cookieManager;
document.addEventListener('DOMContentLoaded', () => {
    cookieManager = new CookieManager();
    
    // Listen for location info from parent
    window.addEventListener('message', (event) => {
        if (event.source !== window.parent) return;
        
        const { action, data } = event.data;
        
        if (action === 'locationInfoResponse') {
            const currentDomainInput = document.getElementById('currentDomain');
            const currentUrlInput = document.getElementById('currentUrl');
            
            if (currentDomainInput) currentDomainInput.value = data.hostname;
            if (currentUrlInput) currentUrlInput.value = data.href;
        }
    });
    
    // Make cookie manager utilities globally available
    window.CookieManagerUtils = {
        exportCookies: () => cookieManager.exportCurrentCookies(),
        importCookies: (cookieData) => cookieManager.applyCookies(cookieData.cookies),
        clearCookies: () => cookieManager.clearAllCookies()
    };
});