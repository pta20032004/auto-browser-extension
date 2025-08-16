// File Manager for Auto Clicker Extension - Enhanced with Clipboard
class FileManager {
    constructor() {
        this.initializeEventListeners();
        this.loadFileList();
        this.updateStorageInfo();
        this.initializeClipboard();
    }

    initializeEventListeners() {
        // Upload folder button
        document.getElementById('uploadFolderBtn').addEventListener('click', () => {
            this.selectFolder();
        });

        // Upload files button
        document.getElementById('uploadFilesBtn').addEventListener('click', () => {
            this.selectFiles();
        });

        // Paste image button
        document.getElementById('pasteImageBtn').addEventListener('click', () => {
            this.pasteImageFromClipboard();
        });

        // Clear all files button
        document.getElementById('clearAllFilesBtn').addEventListener('click', () => {
            this.clearAllFiles();
        });

        // File input change
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileSelection(e);
        });
    }

    initializeClipboard() {
        // Listen for paste events globally within the sidebar
        document.addEventListener('paste', (e) => {
            this.handleClipboardPaste(e);
        });

        // Add visual feedback for paste availability
        this.updatePasteButtonState();
    }

    async updatePasteButtonState() {
        const pasteBtn = document.getElementById('pasteImageBtn');
        if (!pasteBtn) return;

        try {
            // Check if clipboard API is available
            if (!navigator.clipboard || !navigator.clipboard.read) {
                pasteBtn.disabled = true;
                pasteBtn.title = 'Clipboard API không được hỗ trợ';
                return;
            }

            // Check clipboard permissions
            const permission = await navigator.permissions.query({ name: 'clipboard-read' });
            if (permission.state === 'denied') {
                pasteBtn.disabled = true;
                pasteBtn.title = 'Không có quyền truy cập clipboard';
                return;
            }

            pasteBtn.disabled = false;
            pasteBtn.title = 'Dán ảnh từ clipboard (Ctrl+V)';

        } catch (error) {
            console.warn('Clipboard check failed:', error);
            pasteBtn.disabled = false; // Still allow manual trigger
            pasteBtn.title = 'Dán ảnh từ clipboard';
        }
    }

    async handleClipboardPaste(event) {
        // Only handle paste when in files tab
        const filesTab = document.getElementById('files');
        if (!filesTab || !filesTab.classList.contains('active')) {
            return;
        }

        event.preventDefault();
        
        let clipboardItems = [];

        // Try different methods to get clipboard data
        if (event.clipboardData && event.clipboardData.items) {
            // From paste event
            clipboardItems = Array.from(event.clipboardData.items);
        } else if (navigator.clipboard && navigator.clipboard.read) {
            // From clipboard API
            try {
                const items = await navigator.clipboard.read();
                clipboardItems = Array.from(items);
            } catch (error) {
                console.warn('Failed to read clipboard:', error);
                this.showAlert('Không thể đọc clipboard. Vui lòng thử lại.', 'warning');
                return;
            }
        }

        await this.processClipboardItems(clipboardItems);
    }

    async pasteImageFromClipboard() {
        const pasteBtn = document.getElementById('pasteImageBtn');
        const originalText = pasteBtn.textContent;
        pasteBtn.textContent = 'Đang dán...';
        pasteBtn.disabled = true;

        try {
            if (!navigator.clipboard || !navigator.clipboard.read) {
                throw new Error('Clipboard API không được hỗ trợ');
            }

            const clipboardItems = await navigator.clipboard.read();
            await this.processClipboardItems(Array.from(clipboardItems));

        } catch (error) {
            console.error('Paste from clipboard failed:', error);
            this.showAlert('Không thể dán từ clipboard: ' + error.message, 'error');
        } finally {
            pasteBtn.textContent = originalText;
            pasteBtn.disabled = false;
        }
    }

    async processClipboardItems(clipboardItems) {
        let imageFound = false;
        let processedCount = 0;

        for (const item of clipboardItems) {
            try {
                // Handle clipboard item from paste event
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) {
                        await this.saveClipboardImage(file);
                        imageFound = true;
                        processedCount++;
                    }
                }
                // Handle clipboard item from clipboard API
                else if (item.types && item.types.some(type => type.startsWith('image/'))) {
                    const imageType = item.types.find(type => type.startsWith('image/'));
                    const blob = await item.getType(imageType);
                    const file = new File([blob], `clipboard_image_${Date.now()}.${this.getExtensionFromMimeType(imageType)}`, {
                        type: imageType
                    });
                    await this.saveClipboardImage(file);
                    imageFound = true;
                    processedCount++;
                }
            } catch (error) {
                console.warn('Failed to process clipboard item:', error);
            }
        }

        if (imageFound) {
            this.loadFileList();
            this.updateStorageInfo();
            this.showAlert(`Đã dán thành công ${processedCount} ảnh từ clipboard!`, 'success');
        } else {
            this.showAlert('Không tìm thấy ảnh trong clipboard. Hãy copy ảnh trước.', 'warning');
        }
    }

    async saveClipboardImage(file) {
        // Generate filename if not provided
        if (file.name === 'clipboard_image' || !file.name.includes('.')) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const extension = this.getExtensionFromMimeType(file.type) || 'png';
            const newName = `clipboard_${timestamp}.${extension}`;
            
            // Create new file with proper name
            file = new File([file], newName, { type: file.type });
        }

        // Save to clipboard folder
        return await window.dbHelper.saveFile(file, 'clipboard');
    }

    getExtensionFromMimeType(mimeType) {
        const mimeToExt = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/bmp': 'bmp',
            'image/webp': 'webp',
            'image/svg+xml': 'svg'
        };
        return mimeToExt[mimeType] || 'png';
    }

    selectFolder() {
        const fileInput = document.getElementById('fileInput');
        fileInput.webkitdirectory = true;
        fileInput.multiple = true;
        fileInput.click();
    }

    selectFiles() {
        const fileInput = document.getElementById('fileInput');
        fileInput.webkitdirectory = false;
        fileInput.multiple = true;
        fileInput.click();
    }

    async handleFileSelection(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        const uploadBtn = event.target.webkitdirectory ? 
            document.getElementById('uploadFolderBtn') : 
            document.getElementById('uploadFilesBtn');

        const originalText = uploadBtn.textContent;
        uploadBtn.textContent = 'Đang tải lên...';
        uploadBtn.disabled = true;

        try {
            if (event.target.webkitdirectory) {
                await this.uploadFolder(files);
            } else {
                await this.uploadFiles(files);
            }

            this.loadFileList();
            this.updateStorageInfo();
            alert(`Đã tải lên thành công ${files.length} file(s)!`);
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Không thể tải lên files. Vui lòng thử lại.');
        } finally {
            uploadBtn.textContent = originalText;
            uploadBtn.disabled = false;
            // Reset file input
            event.target.value = '';
        }
    }

    async uploadFolder(files) {
        if (files.length === 0) return;

        // Extract folder name from first file path
        const folderPath = files[0].webkitRelativePath;
        const folderName = folderPath.split('/')[0];

        // Group files by folder structure
        const folderFiles = files.filter(file => 
            file.webkitRelativePath.startsWith(folderName + '/')
        );

        // Save folder and files
        await window.dbHelper.saveFolder(folderFiles, folderName);
    }

    async uploadFiles(files) {
        const savePromises = files.map(file => 
            window.dbHelper.saveFile(file, '')
        );

        await Promise.all(savePromises);
    }

    async loadFileList() {
        try {
            const [files, folders] = await Promise.all([
                window.dbHelper.getAllFiles(),
                window.dbHelper.getAllFolders()
            ]);

            const container = document.getElementById('fileList');
            container.innerHTML = '';

            if (files.length === 0 && folders.length === 0) {
                container.innerHTML = '<div class="empty-state">Chưa có file nào được tải lên.</div>';
                return;
            }

            // Group files by folder
            const filesByFolder = this.groupFilesByFolder(files);

            // Render folders first
            folders.forEach(folder => {
                this.renderFolderItem(container, folder, filesByFolder[folder.name] || []);
            });

            // Render files without folder
            const rootFiles = filesByFolder[''] || [];
            if (rootFiles.length > 0) {
                rootFiles.forEach(file => {
                    this.renderFileItem(container, file);
                });
            }

        } catch (error) {
            console.error('Failed to load file list:', error);
        }
    }

    groupFilesByFolder(files) {
        const grouped = {};
        
        files.forEach(file => {
            const folderPath = file.folderPath || '';
            if (!grouped[folderPath]) {
                grouped[folderPath] = [];
            }
            grouped[folderPath].push(file);
        });

        return grouped;
    }

    renderFolderItem(container, folder, files) {
        const folderElement = document.createElement('div');
        folderElement.className = 'file-item folder';

        const folderInfo = document.createElement('div');
        folderInfo.className = 'file-info';

        const folderName = document.createElement('div');
        folderName.className = 'file-name';
        folderName.textContent = `📁 ${folder.name}`;

        const folderDetails = document.createElement('div');
        folderDetails.className = 'file-details';
        folderDetails.textContent = `${files.length} file(s) • Tải lên: ${this.formatDate(folder.uploadDate)}`;

        folderInfo.appendChild(folderName);
        folderInfo.appendChild(folderDetails);

        const folderControls = document.createElement('div');
        folderControls.className = 'file-controls';

        const expandBtn = document.createElement('button');
        expandBtn.textContent = 'Xem';
        expandBtn.className = 'view-btn';
        expandBtn.onclick = () => this.toggleFolderExpansion(folderElement, folder.name, files);
        folderControls.appendChild(expandBtn);

        const downloadBtn = document.createElement('button');
        downloadBtn.textContent = 'Tải';
        downloadBtn.className = 'download-btn';
        downloadBtn.onclick = () => this.downloadFolder(folder.name, files);
        folderControls.appendChild(downloadBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Xóa';
        deleteBtn.className = 'delete-btn';
        deleteBtn.onclick = () => this.deleteFolder(folder.name);
        folderControls.appendChild(deleteBtn);

        folderElement.appendChild(folderInfo);
        folderElement.appendChild(folderControls);
        container.appendChild(folderElement);
    }

    renderFileItem(container, file) {
        const fileElement = document.createElement('div');
        fileElement.className = `file-item ${window.dbHelper.getFileType(file.name)}`;

        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';

        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = file.name;

        const fileDetails = document.createElement('div');
        fileDetails.className = 'file-details';
        fileDetails.textContent = `${window.dbHelper.formatFileSize(file.size)} • ${this.formatDate(file.uploadDate)}`;

        fileInfo.appendChild(fileName);
        fileInfo.appendChild(fileDetails);

        const fileControls = document.createElement('div');
        fileControls.className = 'file-controls';

        if (this.isViewableFile(file)) {
            const viewBtn = document.createElement('button');
            viewBtn.textContent = 'Xem';
            viewBtn.className = 'view-btn';
            viewBtn.onclick = () => this.viewFile(file);
            fileControls.appendChild(viewBtn);
        }

        // Copy image button for images
        if (file.type.startsWith('image/')) {
            const copyBtn = document.createElement('button');
            copyBtn.textContent = '📋';
            copyBtn.className = 'copy-btn';
            copyBtn.title = 'Copy ảnh vào clipboard';
            copyBtn.onclick = () => this.copyImageToClipboard(file);
            fileControls.appendChild(copyBtn);
        }

        const downloadBtn = document.createElement('button');
        downloadBtn.textContent = 'Tải';
        downloadBtn.className = 'download-btn';
        downloadBtn.onclick = () => window.dbHelper.downloadFile(file);
        fileControls.appendChild(downloadBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Xóa';
        deleteBtn.className = 'delete-btn';
        deleteBtn.onclick = () => this.deleteFile(file.id, file.name);
        fileControls.appendChild(deleteBtn);

        fileElement.appendChild(fileInfo);
        fileElement.appendChild(fileControls);
        container.appendChild(fileElement);
    }

    async copyImageToClipboard(file) {
        try {
            const fileData = await window.dbHelper.getFile(file.id);
            
            // Convert data URL to blob
            const response = await fetch(fileData.data);
            const blob = await response.blob();

            // Copy to clipboard
            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob
                })
            ]);

            this.showAlert(`Đã copy ảnh "${file.name}" vào clipboard!`, 'success');

        } catch (error) {
            console.error('Copy to clipboard failed:', error);
            this.showAlert('Không thể copy ảnh vào clipboard: ' + error.message, 'error');
        }
    }

    toggleFolderExpansion(folderElement, folderName, files) {
        const existingFilesList = folderElement.querySelector('.folder-files');
        
        if (existingFilesList) {
            // Collapse
            existingFilesList.remove();
            const expandBtn = folderElement.querySelector('.view-btn');
            expandBtn.textContent = 'Xem';
        } else {
            // Expand
            const filesList = document.createElement('div');
            filesList.className = 'folder-files';
            filesList.style.marginLeft = '20px';
            filesList.style.borderLeft = '2px solid #ddd';
            filesList.style.paddingLeft = '10px';
            filesList.style.marginTop = '10px';

            files.forEach(file => {
                this.renderFileItem(filesList, file);
            });

            folderElement.appendChild(filesList);
            const expandBtn = folderElement.querySelector('.view-btn');
            expandBtn.textContent = 'Ẩn';
        }
    }

    async downloadFolder(folderName, files) {
        if (files.length === 0) {
            alert('Thư mục rỗng.');
            return;
        }

        try {
            // Create a zip-like structure by downloading each file
            for (const file of files) {
                window.dbHelper.downloadFile(file);
                // Small delay between downloads to avoid overwhelming browser
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        } catch (error) {
            console.error('Failed to download folder:', error);
            alert('Không thể tải xuống thư mục. Vui lòng thử lại.');
        }
    }

    async deleteFile(fileId, fileName) {
        if (confirm(`Bạn có chắc muốn xóa file "${fileName}"?`)) {
            try {
                await window.dbHelper.deleteFile(fileId);
                this.loadFileList();
                this.updateStorageInfo();
            } catch (error) {
                console.error('Failed to delete file:', error);
                alert('Không thể xóa file. Vui lòng thử lại.');
            }
        }
    }

    async deleteFolder(folderName) {
        if (confirm(`Bạn có chắc muốn xóa thư mục "${folderName}" và tất cả file bên trong?`)) {
            try {
                await window.dbHelper.deleteFolder(folderName);
                this.loadFileList();
                this.updateStorageInfo();
            } catch (error) {
                console.error('Failed to delete folder:', error);
                alert('Không thể xóa thư mục. Vui lòng thử lại.');
            }
        }
    }

    async clearAllFiles() {
        if (confirm('Bạn có chắc muốn xóa tất cả files và thư mục? Hành động này không thể hoàn tác.')) {
            try {
                await window.dbHelper.clearAllFiles();
                this.loadFileList();
                this.updateStorageInfo();
                alert('Đã xóa tất cả files thành công.');
            } catch (error) {
                console.error('Failed to clear all files:', error);
                alert('Không thể xóa files. Vui lòng thử lại.');
            }
        }
    }

    async updateStorageInfo() {
        try {
            const storageSize = await window.dbHelper.getStorageSize();
            const formattedSize = window.dbHelper.formatFileSize(storageSize);
            document.getElementById('storageUsed').textContent = formattedSize;
        } catch (error) {
            console.error('Failed to update storage info:', error);
        }
    }

    isViewableFile(file) {
        const viewableTypes = ['text', 'code'];
        const fileType = window.dbHelper.getFileType(file.name);
        return viewableTypes.includes(fileType) || 
               file.type.startsWith('text/') || 
               file.name.endsWith('.json') ||
               file.name.endsWith('.csv');
    }

    async viewFile(file) {
        try {
            const fileData = await window.dbHelper.getFile(file.id);
            
            // Create modal to display file content
            const modal = this.createFileViewModal();
            const content = modal.querySelector('.file-view-content');
            const title = modal.querySelector('.file-view-title');
            
            title.textContent = file.name;
            
            if (fileData.type.startsWith('text/') || 
                fileData.name.endsWith('.json') || 
                fileData.name.endsWith('.csv') ||
                fileData.name.endsWith('.js') ||
                fileData.name.endsWith('.html') ||
                fileData.name.endsWith('.css')) {
                
                // Convert data URL to text
                const text = await this.dataURLToText(fileData.data);
                content.innerHTML = `<pre style="white-space: pre-wrap; word-wrap: break-word;">${this.escapeHtml(text)}</pre>`;
            } else if (fileData.type.startsWith('image/')) {
                content.innerHTML = `<img src="${fileData.data}" style="max-width: 100%; max-height: 400px;" alt="${file.name}">`;
            } else {
                content.innerHTML = '<p>Không thể xem trước file này.</p>';
            }
            
            document.body.appendChild(modal);
            modal.style.display = 'block';
            
        } catch (error) {
            console.error('Failed to view file:', error);
            alert('Không thể xem file. Vui lòng thử lại.');
        }
    }

    createFileViewModal() {
        const modal = document.createElement('div');
        modal.className = 'modal file-view-modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <span class="close">&times;</span>
                <h3 class="file-view-title">File Content</h3>
                <div class="file-view-content" style="max-height: 500px; overflow: auto; border: 1px solid #ddd; padding: 10px; background: #f9f9f9;"></div>
            </div>
        `;

        // Close modal functionality
        const closeBtn = modal.querySelector('.close');
        closeBtn.onclick = () => {
            document.body.removeChild(modal);
        };

        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        };

        return modal;
    }

    async dataURLToText(dataURL) {
        const response = await fetch(dataURL);
        const text = await response.text();
        return text;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    showAlert(message, type = 'info') {
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

    // Utility method to get file content as text (useful for automation scripts)
    async getFileContent(fileName, folderPath = '') {
        try {
            const files = await window.dbHelper.getAllFiles();
            const file = files.find(f => 
                f.name === fileName && f.folderPath === folderPath
            );

            if (!file) {
                throw new Error(`File not found: ${fileName}`);
            }

            return await this.dataURLToText(file.data);
        } catch (error) {
            console.error('Failed to get file content:', error);
            throw error;
        }
    }

    // Method to list files (useful for automation scripts)
    async listFiles(folderPath = '') {
        try {
            const files = await window.dbHelper.getAllFiles();
            return files
                .filter(f => f.folderPath === folderPath)
                .map(f => ({
                    name: f.name,
                    size: f.size,
                    type: f.type,
                    uploadDate: f.uploadDate
                }));
        } catch (error) {
            console.error('Failed to list files:', error);
            throw error;
        }
    }
}

// Initialize file manager when page loads
let fileManager;
document.addEventListener('DOMContentLoaded', () => {
    fileManager = new FileManager();
    
    // Make file manager utilities globally available for automation scripts
    window.FileManagerUtils = {
        getFileContent: (fileName, folderPath) => fileManager.getFileContent(fileName, folderPath),
        listFiles: (folderPath) => fileManager.listFiles(folderPath),
        copyImageToClipboard: (file) => fileManager.copyImageToClipboard(file),
        pasteImageFromClipboard: () => fileManager.pasteImageFromClipboard()
    };
});