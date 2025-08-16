// Cookie Manager for Auto Clicker Extension
class CookieManager {
    constructor() {
        this.initializeEventListeners();
        this.loadCookiesList();
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

    async exportCurrentCookies() {
        try {
            const exportBtn = document.getElementById('exportCookiesBtn');
            const originalText = exportBtn.textContent;
            exportBtn.textContent = 'Đang xuất...';
            exportBtn.disabled = true;

            // Get all cookies for current domain
            const currentDomain = window.location.hostname;
            const allCookies = await this.getAllCookies();
            
            // Filter cookies for current domain and subdomains
            const domainCookies = allCookies.filter(cookie => 
                cookie.domain === currentDomain || 
                cookie.domain === `.${currentDomain}` ||
                currentDomain.endsWith(cookie.domain.substring(1))
            );

            if (domainCookies.length === 0) {
                this.showAlert('Không tìm thấy cookies nào cho domain này.', 'warning');
                return;
            }

            // Create cookie data object
            const cookieData = {
                domain: currentDomain,
                url: window.location.href,
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
            this.showAlert('Không thể xuất cookies. Vui lòng thử lại.', 'error');
        } finally {
            const exportBtn = document.getElementById('exportCookiesBtn');
            exportBtn.textContent = 'Xuất Cookies';
            exportBtn.disabled = false;
        }
    }

    async getAllCookies() {
        return new Promise((resolve) => {
            // Try to get cookies via background script if possible
            chrome.runtime.sendMessage({ action: 'getAllCookies' }, (response) => {
                if (response && response.success) {
                    resolve(response.cookies);
                } else {
                    // Fallback: parse document.cookie
                    const cookies = this.parseCookiesFromDocument();
                    resolve(cookies);
                }
            });
        });
    }

    parseCookiesFromDocument() {
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

            // Apply cookies to current domain
            await this.applyCookies(cookieData.cookies);

            // Save imported cookie file to our storage
            const savedFileName = `imported_${file.name}`;
            await this.saveCookieData(savedFileName, cookieData);

            this.loadCookiesList();
            this.showAlert(`Đã nhập ${cookieData.cookies.length} cookies thành công!`, 'success');

            // Suggest page reload
            if (this.confirmAlert('Cookies đã được áp dụng. Bạn có muốn reload trang để đăng nhập?')) {
                window.location.reload();
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

    async applyCookies(cookies) {
        // Try to apply via background script first
        const backgroundResult = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ 
                action: 'setCookies', 
                cookies: cookies,
                url: window.location.href
            }, (response) => {
                resolve(response);
            });
        });

        if (backgroundResult && backgroundResult.success) {
            console.log('Cookies applied via background script');
            return;
        }

        // Fallback: apply via document.cookie (limited functionality)
        console.log('Applying cookies via document.cookie fallback');
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

    async clearAllCookies() {
        if (!this.confirmAlert('Bạn có chắc muốn xóa tất cả cookies của domain này?')) {
            return;
        }

        try {
            // Try via background script first
            const result = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ 
                    action: 'clearCookies',
                    url: window.location.href
                }, (response) => {
                    resolve(response);
                });
            });

            if (result && result.success) {
                this.showAlert('Đã xóa cookies thành công!', 'success');
            } else {
                // Fallback: clear via document.cookie
                this.clearCookiesViaDocument();
                this.showAlert('Đã xóa cookies (một số cookies có thể cần reload trang).', 'warning');
            }

            if (this.confirmAlert('Bạn có muốn reload trang để áp dụng thay đổi?')) {
                window.location.reload();
            }

        } catch (error) {
            console.error('Clear cookies failed:', error);
            this.showAlert('Không thể xóa cookies. Vui lòng thử lại.', 'error');
        }
    }

    clearCookiesViaDocument() {
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

            await this.applyCookies(cookieData.cookies);
            this.showAlert(`Đã áp dụng ${cookieData.cookies.length} cookies từ file ${file.name}!`, 'success');

            if (this.confirmAlert('Cookies đã được áp dụng. Bạn có muốn reload trang?')) {
                window.location.reload();
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
            console.log(`[${type.toUpperCase()}] ${message}`);
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
    
    // Update current domain and URL info
    if (window.parent && window.parent !== window) {
        try {
            const currentDomainInput = document.getElementById('currentDomain');
            const currentUrlInput = document.getElementById('currentUrl');
            
            if (currentDomainInput) currentDomainInput.value = window.parent.location.hostname;
            if (currentUrlInput) currentUrlInput.value = window.parent.location.href;
        } catch (error) {
            // Cross-origin access denied, use message passing
            window.parent.postMessage({
                source: 'automation-sidebar',
                action: 'getLocationInfo'
            }, '*');
        }
    }
    
    // Make cookie manager utilities globally available
    window.CookieManagerUtils = {
        exportCookies: () => cookieManager.exportCurrentCookies(),
        importCookies: (cookieData) => cookieManager.applyCookies(cookieData.cookies),
        clearCookies: () => cookieManager.clearAllCookies()
    };
});