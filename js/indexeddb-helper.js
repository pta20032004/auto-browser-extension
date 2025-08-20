class IndexedDBHelper {
    constructor() {
        this.dbName = 'AutoClickerDB';
        this.version = 1;
        this.db = null;
    }

    // Initialize database
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                reject(new Error('Failed to open database'));
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object stores
                if (!db.objectStoreNames.contains('files')) {
                    const fileStore = db.createObjectStore('files', { keyPath: 'id' });
                    fileStore.createIndex('name', 'name', { unique: false });
                    fileStore.createIndex('type', 'type', { unique: false });
                    fileStore.createIndex('uploadDate', 'uploadDate', { unique: false });
                }

                if (!db.objectStoreNames.contains('scripts')) {
                    const scriptStore = db.createObjectStore('scripts', { keyPath: 'id' });
                    scriptStore.createIndex('name', 'name', { unique: false });
                    scriptStore.createIndex('createdDate', 'createdDate', { unique: false });
                }

                if (!db.objectStoreNames.contains('folders')) {
                    const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
                    folderStore.createIndex('name', 'name', { unique: false });
                    folderStore.createIndex('uploadDate', 'uploadDate', { unique: false });
                }
            };
        });
    }

    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // File operations
    async saveFile(file, folderPath = '') {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (event) => {
                const fileData = {
                    id: this.generateId(),
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    folderPath: folderPath,
                    data: event.target.result,
                    uploadDate: new Date().toISOString(),
                    lastModified: new Date(file.lastModified).toISOString()
                };

                const transaction = this.db.transaction(['files'], 'readwrite');
                const store = transaction.objectStore('files');
                const request = store.add(fileData);

                request.onsuccess = () => {
                    resolve(fileData);
                };

                request.onerror = () => {
                    reject(new Error('Failed to save file'));
                };
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsDataURL(file);
        });
    }

    async saveFolder(files, folderName) {
        if (!this.db) await this.init();

        const folderId = this.generateId();
        const folderData = {
            id: folderId,
            name: folderName,
            fileCount: files.length,
            uploadDate: new Date().toISOString()
        };

        // Save folder info
        await new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['folders'], 'readwrite');
            const store = transaction.objectStore('folders');
            const request = store.add(folderData);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('Failed to save folder info'));
        });

        // Save all files in the folder
        const savedFiles = [];
        for (const file of files) {
            try {
                const savedFile = await this.saveFile(file, folderName);
                savedFiles.push(savedFile);
            } catch (error) {
                console.error('Failed to save file:', file.name, error);
            }
        }

        return {
            folder: folderData,
            files: savedFiles
        };
    }

    async getAllFiles() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error('Failed to get files'));
            };
        });
    }

    async getAllFolders() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['folders'], 'readonly');
            const store = transaction.objectStore('folders');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error('Failed to get folders'));
            };
        });
    }

    async getFilesByFolder(folderPath) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');
            const request = store.getAll();

            request.onsuccess = () => {
                const files = request.result.filter(file => file.folderPath === folderPath);
                resolve(files);
            };

            request.onerror = () => {
                reject(new Error('Failed to get files by folder'));
            };
        });
    }

    async getFile(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error('Failed to get file'));
            };
        });
    }

    async deleteFile(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            const request = store.delete(id);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(new Error('Failed to delete file'));
            };
        });
    }

    async deleteFolder(folderName) {
        if (!this.db) await this.init();

        // Delete all files in the folder
        const files = await this.getFilesByFolder(folderName);
        for (const file of files) {
            await this.deleteFile(file.id);
        }

        // Delete folder info
        const folders = await this.getAllFolders();
        const folder = folders.find(f => f.name === folderName);
        if (folder) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['folders'], 'readwrite');
                const store = transaction.objectStore('folders');
                const request = store.delete(folder.id);

                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error('Failed to delete folder'));
            });
        }
    }

    async clearAllFiles() {
        if (!this.db) await this.init();

        const promises = [
            new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['files'], 'readwrite');
                const store = transaction.objectStore('files');
                const request = store.clear();

                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error('Failed to clear files'));
            }),
            new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['folders'], 'readwrite');
                const store = transaction.objectStore('folders');
                const request = store.clear();

                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error('Failed to clear folders'));
            })
        ];

        return Promise.all(promises);
    }

    // Script operations
    async saveScript(name, steps) {
        if (!this.db) await this.init();

        const scriptData = {
            id: this.generateId(),
            name: name,
            steps: steps,
            createdDate: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['scripts'], 'readwrite');
            const store = transaction.objectStore('scripts');
            const request = store.add(scriptData);

            request.onsuccess = () => {
                resolve(scriptData);
            };

            request.onerror = () => {
                reject(new Error('Failed to save script'));
            };
        });
    }

    async updateScript(id, name, steps) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['scripts'], 'readwrite');
            const store = transaction.objectStore('scripts');
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const scriptData = getRequest.result;
                if (scriptData) {
                    scriptData.name = name;
                    scriptData.steps = steps;
                    scriptData.lastModified = new Date().toISOString();

                    const updateRequest = store.put(scriptData);
                    updateRequest.onsuccess = () => resolve(scriptData);
                    updateRequest.onerror = () => reject(new Error('Failed to update script'));
                } else {
                    reject(new Error('Script not found'));
                }
            };

            getRequest.onerror = () => {
                reject(new Error('Failed to get script'));
            };
        });
    }

    async getAllScripts() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['scripts'], 'readonly');
            const store = transaction.objectStore('scripts');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error('Failed to get scripts'));
            };
        });
    }

    async getScript(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['scripts'], 'readonly');
            const store = transaction.objectStore('scripts');
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error('Failed to get script'));
            };
        });
    }

    async deleteScript(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['scripts'], 'readwrite');
            const store = transaction.objectStore('scripts');
            const request = store.delete(id);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(new Error('Failed to delete script'));
            };
        });
    }

    async getScriptsByPrefix(prefix) {
        const allScripts = await this.getAllScripts();
        return allScripts.filter(script => script.name.startsWith(prefix));
    }

    async getAIScripts() {
        return this.getScriptsByPrefix('[AI]');
    }

    // Utility methods
    async getStorageSize() {
        if (!this.db) await this.init();

        const files = await this.getAllFiles();
        let totalSize = 0;

        files.forEach(file => {
            totalSize += file.size || 0;
        });

        return totalSize;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getFileType(fileName) {
        const extension = fileName.split('.').pop().toLowerCase();
        
        const typeMap = {
            // Images
            'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'bmp': 'image', 'svg': 'image',
            // Videos
            'mp4': 'video', 'avi': 'video', 'mov': 'video', 'wmv': 'video', 'flv': 'video', 'webm': 'video',
            // Audio
            'mp3': 'audio', 'wav': 'audio', 'flac': 'audio', 'aac': 'audio', 'm4a': 'audio',
            // Code
            'js': 'code', 'html': 'code', 'css': 'code', 'json': 'code', 'xml': 'code', 'php': 'code', 'py': 'code',
            // Text
            'txt': 'text', 'md': 'text', 'csv': 'text', 'log': 'text'
        };

        return typeMap[extension] || 'file';
    }

    // Download file as blob
    downloadFile(fileData) {
        try {
            // Convert data URL to blob
            const byteCharacters = atob(fileData.data.split(',')[1]);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: fileData.type });

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileData.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to download file:', error);
            alert('Không thể tải file xuống. Vui lòng thử lại.');
        }
    }
}

// Global instance
window.dbHelper = new IndexedDBHelper();