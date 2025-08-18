// Enhanced Script Builder with Playwright Export & New Options
class EnhancedScriptBuilder {
    constructor() {
        this.steps = [];
        this.currentEditingStep = null;
        this.runningStates = new Map(); // Map tabId -> { isRunning, stepIndex }
        this.currentTabId = null;
        
        this.initializeEventListeners();
        this.loadStepParameters();
        this.getCurrentTabId();
    }

    getCurrentTabId() {
        // Request tab ID from parent
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                source: 'automation-sidebar',
                action: 'getTabId'
            }, '*');
        }
    }

    getTabRunningState(tabId) {
        if (!this.runningStates.has(tabId)) {
            this.runningStates.set(tabId, {
                isRunning: false,
                stepIndex: -1
            });
        }
        return this.runningStates.get(tabId);
    }

    setTabRunningState(tabId, state) {
        this.runningStates.set(tabId, { 
            ...this.getTabRunningState(tabId), 
            ...state 
        });
    }

    initializeEventListeners() {
        // Add step button
        document.getElementById('addStepBtn').addEventListener('click', () => {
            this.showAddStepModal();
        });

        // Save script button
        document.getElementById('saveScriptBtn').addEventListener('click', () => {
            this.showSaveScriptModal();
        });

        // Load script button
        document.getElementById('loadScriptBtn').addEventListener('click', () => {
            this.showLoadScriptModal();
        });

        // Run script button
        document.getElementById('runScriptBtn').addEventListener('click', () => {
            this.runScript();
        });

        // Clear script button
        document.getElementById('clearScriptBtn').addEventListener('click', () => {
            this.clearScript();
        });

        // Export Playwright button
        document.getElementById('exportPlaywrightBtn').addEventListener('click', () => {
            this.exportToPlaywright();
        });

        // Step type change
        document.getElementById('stepType').addEventListener('change', (e) => {
            this.updateStepParameters(e.target.value);
        });

        // Modal controls
        document.getElementById('confirmAddStep').addEventListener('click', () => {
            this.confirmAddStep();
        });

        document.getElementById('cancelAddStep').addEventListener('click', () => {
            this.hideAddStepModal();
        });

        document.getElementById('confirmSaveScript').addEventListener('click', () => {
            this.confirmSaveScript();
        });

        document.getElementById('cancelScriptManager').addEventListener('click', () => {
            this.hideScriptManagerModal();
        });

        // Close modal buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // Click outside modal to close
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        // Listen for messages from parent
        window.addEventListener('message', (event) => {
            if (event.source !== window.parent) return;
            
            const { action, data } = event.data;
            
            switch (action) {
                case 'tabIdResponse':
                    this.currentTabId = data.tabId;
                    console.log('Script Builder: Current tab ID set to:', this.currentTabId);
                    break;
            }
        });
    }

    loadStepParameters() {
        this.stepParameters = {
            // Classic actions
            click: [
                { name: 'x', label: 'Tọa độ X', type: 'number', required: true },
                { name: 'y', label: 'Tọa độ Y', type: 'number', required: true },
                { name: 'button', label: 'Nút chuột', type: 'select', options: ['left', 'right', 'middle'], default: 'left' },
                { name: 'clickCount', label: 'Số lần click', type: 'number', default: 1 },
                { name: 'delay', label: 'Delay sau click (ms)', type: 'number', default: 100 }
            ],
            clickElement: [
                { name: 'selector', label: 'CSS Selector', type: 'text', required: true, placeholder: '#button, .class, input[type="submit"]' },
                { name: 'button', label: 'Nút chuột', type: 'select', options: ['left', 'right', 'middle'], default: 'left' },
                { name: 'clickCount', label: 'Số lần click', type: 'number', default: 1 },
                { name: 'timeout', label: 'Timeout (ms)', type: 'number', default: 5000 }
            ],
            type: [
                { name: 'selector', label: 'CSS Selector', type: 'text', required: true, placeholder: 'input[type="text"], textarea' },
                { name: 'text', label: 'Text cần nhập', type: 'textarea', required: true },
                { name: 'clear', label: 'Xóa text cũ trước', type: 'checkbox', default: true },
                { name: 'timeout', label: 'Timeout (ms)', type: 'number', default: 5000 }
            ],
            press: [
                { name: 'key', label: 'Phím', type: 'text', required: true, placeholder: 'Enter, Escape, Tab, Space, ArrowDown' },
                { name: 'modifiers', label: 'Phím bổ trợ (ctrl,shift,alt)', type: 'text', placeholder: 'ctrl,shift' }
            ],
            waitForElement: [
                { name: 'selector', label: 'CSS Selector', type: 'text', required: true },
                { name: 'visible', label: 'Chờ element hiển thị', type: 'checkbox', default: true },
                { name: 'timeout', label: 'Timeout (ms)', type: 'number', default: 30000 }
            ],
            wait: [
                { name: 'duration', label: 'Thời gian chờ (ms)', type: 'number', required: true, default: 1000 }
            ],
            scroll: [
                { name: 'x', label: 'Vị trí X', type: 'number', default: 0 },
                { name: 'y', label: 'Vị trí Y', type: 'number', required: true },
                { name: 'smooth', label: 'Scroll mượt', type: 'checkbox', default: true },
                { name: 'delta', label: 'Scroll theo delta (px)', type: 'number', placeholder: '100 = scroll down 100px' }
            ],
            hover: [
                { name: 'selector', label: 'CSS Selector', type: 'text', required: true },
                { name: 'timeout', label: 'Timeout (ms)', type: 'number', default: 5000 }
            ],
            selectOption: [
                { name: 'selector', label: 'CSS Selector (select)', type: 'text', required: true },
                { name: 'value', label: 'Giá trị option', type: 'text', required: true },
                { name: 'timeout', label: 'Timeout (ms)', type: 'number', default: 5000 }
            ],
            check: [
                { name: 'selector', label: 'CSS Selector (checkbox/radio)', type: 'text', required: true },
                { name: 'checked', label: 'Check/Uncheck', type: 'select', options: ['true', 'false'], default: 'true' },
                { name: 'timeout', label: 'Timeout (ms)', type: 'number', default: 5000 }
            ],
            getText: [
                { name: 'selector', label: 'CSS Selector', type: 'text', required: true },
                { name: 'timeout', label: 'Timeout (ms)', type: 'number', default: 5000 }
            ],
            getAttribute: [
                { name: 'selector', label: 'CSS Selector', type: 'text', required: true },
                { name: 'attribute', label: 'Tên attribute', type: 'text', required: true, placeholder: 'href, src, value, class' },
                { name: 'timeout', label: 'Timeout (ms)', type: 'number', default: 5000 }
            ],
            goto: [
                { name: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://example.com' }
            ],
            reload: [],

            // NEW PLAYWRIGHT-STYLE LOCATORS
            getByRole: [
                { name: 'role', label: 'Role', type: 'select', required: true, 
                  options: ['button', 'link', 'textbox', 'checkbox', 'radio', 'menuitem', 'tab', 'option'], 
                  default: 'button' },
                { name: 'name', label: 'Accessible Name', type: 'text', required: true, 
                  placeholder: 'Đăng nhập, Submit, Cancel' },
                { name: 'action', label: 'Hành động', type: 'select', options: ['click', 'hover'], default: 'click' },
                { name: 'timeout', label: 'Timeout (ms)', type: 'number', default: 5000 }
            ],
            getByText: [
                { name: 'text', label: 'Text Content', type: 'text', required: true, 
                  placeholder: 'Welcome, Đăng nhập, Submit' },
                { name: 'action', label: 'Hành động', type: 'select', options: ['click', 'hover'], default: 'click' },
                { name: 'timeout', label: 'Timeout (ms)', type: 'number', default: 5000 }
            ],
            getByPlaceholder: [
                { name: 'placeholder', label: 'Placeholder Text', type: 'text', required: true, 
                  placeholder: 'Nhập email..., Search...' },
                { name: 'action', label: 'Hành động', type: 'select', options: ['click', 'fill'], default: 'click' },
                { name: 'value', label: 'Giá trị (nếu action = fill)', type: 'text', placeholder: 'Text để điền vào' },
                { name: 'timeout', label: 'Timeout (ms)', type: 'number', default: 5000 }
            ],

            // NEW PLAYWRIGHT-STYLE INTERACTIONS
            fill: [
                { name: 'selector', label: 'CSS Selector', type: 'text', required: true, placeholder: 'input[type="text"], textarea' },
                { name: 'text', label: 'Text để điền', type: 'textarea', required: true },
                { name: 'timeout', label: 'Timeout (ms)', type: 'number', default: 5000 }
            ],
            setInputFiles: [
                { name: 'selector', label: 'CSS Selector (input[type="file"])', type: 'text', required: true, 
                  placeholder: 'input[type="file"], #fileInput' },
                { name: 'filePaths', label: 'File Paths', type: 'filePicker', required: true,
                  multiple: true, help: 'Chọn files từ File Manager' },
                { name: 'timeout', label: 'Timeout (ms)', type: 'number', default: 5000 }
            ],

            // NEW PLAYWRIGHT-STYLE DATA EXTRACTION
            innerText: [
                { name: 'selector', label: 'CSS Selector', type: 'text', required: true },
                { name: 'timeout', label: 'Timeout (ms)', type: 'number', default: 5000 }
            ],
            textContent: [
                { name: 'selector', label: 'CSS Selector', type: 'text', required: true },
                { name: 'timeout', label: 'Timeout (ms)', type: 'number', default: 5000 }
            ],
            inputValue: [
                { name: 'selector', label: 'CSS Selector (input/textarea/select)', type: 'text', required: true },
                { name: 'timeout', label: 'Timeout (ms)', type: 'number', default: 5000 }
            ]
        };
    }

    showAddStepModal() {
        document.getElementById('addStepModal').style.display = 'block';
        this.updateStepParameters('click'); // Default
        this.currentEditingStep = null;
    }

    hideAddStepModal() {
        document.getElementById('addStepModal').style.display = 'none';
        this.clearStepParametersForm();
    }

    updateStepParameters(stepType) {
        const paramsContainer = document.getElementById('stepParams');
        paramsContainer.innerHTML = '';

        const params = this.stepParameters[stepType] || [];

        params.forEach(param => {
            const paramGroup = document.createElement('div');
            paramGroup.className = 'param-group';

            const label = document.createElement('label');
            label.textContent = param.label + (param.required ? ' *' : '');
            if (param.help) {
                label.title = param.help;
                label.style.cursor = 'help';
                label.textContent += ' ❓';
            }
            paramGroup.appendChild(label);

            let input;
            switch (param.type) {
                case 'select':
                    input = document.createElement('select');
                    param.options.forEach(option => {
                        const optionElement = document.createElement('option');
                        optionElement.value = option;
                        optionElement.textContent = option;
                        input.appendChild(optionElement);
                    });
                    if (param.default) input.value = param.default;
                    break;

                case 'textarea':
                    input = document.createElement('textarea');
                    input.rows = 3;
                    if (param.placeholder) input.placeholder = param.placeholder;
                    break;

                case 'checkbox':
                    input = document.createElement('input');
                    input.type = 'checkbox';
                    if (param.default) input.checked = param.default;
                    break;

                case 'filePicker':
                    input = this.createFilePickerInput(param);
                    break;

                default:
                    input = document.createElement('input');
                    input.type = param.type;
                    if (param.placeholder) input.placeholder = param.placeholder;
                    if (param.default !== undefined) input.value = param.default;
                    break;
            }

            input.dataset.paramName = param.name;
            if (param.required) input.required = true;

            paramGroup.appendChild(input);
            paramsContainer.appendChild(paramGroup);
        });
    }

    createFilePickerInput(param) {
        const container = document.createElement('div');
        container.style.cssText = 'border: 1px solid #ccc; border-radius: 4px; padding: 8px; background: #f9f9f9;';
        
        const input = document.createElement('input');
        input.type = 'hidden';
        input.dataset.paramName = param.name;
        
        const displayArea = document.createElement('div');
        displayArea.style.cssText = 'min-height: 40px; font-size: 11px; color: #666; margin-bottom: 8px; max-height: 100px; overflow-y: auto;';
        displayArea.textContent = 'Chưa chọn file nào';
        
        const browseBtn = document.createElement('button');
        browseBtn.type = 'button';
        browseBtn.textContent = '📁 Chọn Files';
        browseBtn.style.cssText = 'padding: 4px 8px; font-size: 11px; background: #4f46e5; color: white; border: none; border-radius: 4px; cursor: pointer;';
        
        let selectedFiles = [];
        
        browseBtn.addEventListener('click', async () => {
            try {
                // Get files from IndexedDB
                const allFiles = await window.dbHelper.getAllFiles();
                const allFolders = await window.dbHelper.getAllFolders();
                
                // Create file picker modal
                const modal = this.createFilePickerModal(allFiles, allFolders, param.multiple);
                document.body.appendChild(modal);
                
                modal.addEventListener('filesSelected', (event) => {
                    selectedFiles = event.detail.files;
                    
                    // Update display
                    if (selectedFiles.length === 0) {
                        displayArea.textContent = 'Chưa chọn file nào';
                        input.value = '';
                    } else {
                        displayArea.innerHTML = selectedFiles.map(file => 
                            `<div style="margin: 2px 0;">📄 ${file.path}</div>`
                        ).join('');
                        input.value = selectedFiles.map(f => f.path).join(',');
                    }
                    
                    document.body.removeChild(modal);
                });
                
                modal.addEventListener('cancelled', () => {
                    document.body.removeChild(modal);
                });
                
            } catch (error) {
                console.error('Failed to browse files:', error);
                alert('Không thể duyệt files: ' + error.message);
            }
        });
        
        container.appendChild(displayArea);
        container.appendChild(browseBtn);
        container.appendChild(input);
        
        return container;
    }

    createFilePickerModal(allFiles, allFolders, multiple = false) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        
        const content = document.createElement('div');
        content.className = 'modal-content';
        content.style.maxWidth = '500px';
        content.innerHTML = `
            <div class="modal-header">
                <h3>Chọn Files từ File Manager</h3>
                <button class="close">&times;</button>
            </div>
            <div style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; margin: 10px 0;">
                <div id="filePickerList"></div>
            </div>
            <div style="margin: 10px 0; padding: 10px; background: #f9f9f9; border-radius: 4px;">
                <strong>Đã chọn:</strong>
                <div id="selectedFilesList" style="margin-top: 5px; font-size: 11px; max-height: 60px; overflow-y: auto;"></div>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="confirmFilePicker" class="btn btn-primary">Xác nhận</button>
                <button id="cancelFilePicker" class="btn btn-secondary">Hủy</button>
            </div>
        `;
        
        modal.appendChild(content);
        
        // Render file list
        const fileList = content.querySelector('#filePickerList');
        const selectedList = content.querySelector('#selectedFilesList');
        let selectedFiles = [];
        
        // Group files by folder
        const filesByFolder = {};
        allFiles.forEach(file => {
            const folder = file.folderPath || 'Root';
            if (!filesByFolder[folder]) filesByFolder[folder] = [];
            filesByFolder[folder].push(file);
        });
        
        // Render folders and files
        Object.keys(filesByFolder).forEach(folderName => {
            // Folder header
            const folderDiv = document.createElement('div');
            folderDiv.style.cssText = 'background: #f0f0f0; padding: 8px; font-weight: bold; border-bottom: 1px solid #ddd;';
            folderDiv.textContent = `📁 ${folderName}`;
            fileList.appendChild(folderDiv);
            
            // Files in folder
            filesByFolder[folderName].forEach(file => {
                const fileDiv = document.createElement('div');
                fileDiv.style.cssText = 'padding: 6px 16px; border-bottom: 1px solid #eee; cursor: pointer; font-size: 12px;';
                fileDiv.innerHTML = `<input type="${multiple ? 'checkbox' : 'radio'}" name="fileSelect" style="margin-right: 8px;"> 📄 ${file.name} <small>(${this.formatFileSize(file.size)})</small>`;
                
                const checkbox = fileDiv.querySelector('input');
                checkbox.addEventListener('change', () => {
                    const filePath = folderName === 'Root' ? file.name : `${folderName}/${file.name}`;
                    
                    if (checkbox.checked) {
                        if (!multiple) {
                            // Single selection - clear others
                            selectedFiles = [];
                            fileList.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
                                if (input !== checkbox) input.checked = false;
                            });
                        }
                        selectedFiles.push({ path: filePath, file: file });
                    } else {
                        selectedFiles = selectedFiles.filter(f => f.path !== filePath);
                    }
                    
                    // Update selected display
                    if (selectedFiles.length === 0) {
                        selectedList.textContent = 'Chưa chọn file nào';
                    } else {
                        selectedList.innerHTML = selectedFiles.map(f => `<div>• ${f.path}</div>`).join('');
                    }
                });
                
                fileList.appendChild(fileDiv);
            });
        });
        
        // Event handlers
        content.querySelector('.close').addEventListener('click', () => {
            modal.dispatchEvent(new CustomEvent('cancelled'));
        });
        
        content.querySelector('#cancelFilePicker').addEventListener('click', () => {
            modal.dispatchEvent(new CustomEvent('cancelled'));
        });
        
        content.querySelector('#confirmFilePicker').addEventListener('click', () => {
            modal.dispatchEvent(new CustomEvent('filesSelected', { detail: { files: selectedFiles } }));
        });
        
        return modal;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    confirmAddStep() {
        const stepType = document.getElementById('stepType').value;
        const stepData = { type: stepType, tabId: this.currentTabId };

        // Collect parameters
        const paramInputs = document.querySelectorAll('#stepParams [data-param-name]');
        let isValid = true;

        paramInputs.forEach(input => {
            const paramName = input.dataset.paramName;
            let value;

            if (input.type === 'checkbox') {
                value = input.checked;
            } else if (input.type === 'number') {
                value = input.value ? parseInt(input.value) : undefined;
            } else if (input.type === 'hidden' && paramName === 'filePaths') {
                // File picker input
                value = input.value ? input.value.split(',') : [];
            } else {
                value = input.value.trim();
            }

            if (input.required && (!value && value !== 0 && value !== false)) {
                isValid = false;
                input.style.borderColor = '#dc3545';
            } else {
                input.style.borderColor = '#ccc';
            }

            if (value !== undefined && value !== '') {
                // Handle special cases
                if (paramName === 'modifiers' && typeof value === 'string') {
                    stepData[paramName] = value.split(',').map(s => s.trim()).filter(s => s);
                } else if (paramName === 'checked') {
                    stepData[paramName] = value === 'true';
                } else {
                    stepData[paramName] = value;
                }
            }
        });

        if (!isValid) {
            this.showAlert('Vui lòng điền đầy đủ thông tin bắt buộc.', 'error');
            return;
        }

        if (this.currentEditingStep !== null) {
            // Update existing step
            this.steps[this.currentEditingStep] = stepData;
        } else {
            // Add new step
            this.steps.push(stepData);
        }

        this.updateStepsDisplay();
        this.hideAddStepModal();
    }

    editStep(index) {
        this.currentEditingStep = index;
        const step = this.steps[index];

        // Set step type
        document.getElementById('stepType').value = step.type;
        this.updateStepParameters(step.type);

        // Set parameter values
        setTimeout(() => {
            const paramInputs = document.querySelectorAll('#stepParams [data-param-name]');
            paramInputs.forEach(input => {
                const paramName = input.dataset.paramName;
                const value = step[paramName];

                if (value !== undefined) {
                    if (input.type === 'checkbox') {
                        input.checked = value;
                    } else if (paramName === 'modifiers' && Array.isArray(value)) {
                        input.value = value.join(', ');
                    } else if (paramName === 'filePaths' && Array.isArray(value)) {
                        input.value = value.join(',');
                        // Update display
                        const container = input.parentElement;
                        const displayArea = container.querySelector('div');
                        if (displayArea && value.length > 0) {
                            displayArea.innerHTML = value.map(path => 
                                `<div style="margin: 2px 0;">📄 ${path}</div>`
                            ).join('');
                        }
                    } else {
                        input.value = value;
                    }
                }
            });
        }, 100);

        document.getElementById('addStepModal').style.display = 'block';
    }

    deleteStep(index) {
        if (this.confirmSidebar('Bạn có chắc muốn xóa bước này?')) {
            this.steps.splice(index, 1);
            this.updateStepsDisplay();
        }
    }

    moveStep(index, direction) {
        if (direction === 'up' && index > 0) {
            [this.steps[index], this.steps[index - 1]] = [this.steps[index - 1], this.steps[index]];
        } else if (direction === 'down' && index < this.steps.length - 1) {
            [this.steps[index], this.steps[index + 1]] = [this.steps[index + 1], this.steps[index]];
        }
        this.updateStepsDisplay();
    }

    updateStepsDisplay() {
        const container = document.getElementById('scriptSteps');
        container.innerHTML = '';

        if (this.steps.length === 0) {
            container.innerHTML = '<div class="empty-state">Chưa có bước nào. Nhấn "Thêm Bước" để bắt đầu.</div>';
            return;
        }

        const tabState = this.getTabRunningState(this.currentTabId);

        this.steps.forEach((step, index) => {
            const stepElement = document.createElement('div');
            stepElement.className = 'script-step';
            
            // Highlight currently running step for current tab
            if (tabState.stepIndex === index && tabState.isRunning) {
                stepElement.classList.add('script-running');
                stepElement.style.background = '#e3f2fd';
                stepElement.style.borderLeft = '4px solid #2196f3';
            }

            const stepHeader = document.createElement('div');
            stepHeader.className = 'step-header';

            const stepType = document.createElement('div');
            stepType.className = 'step-type';
            stepType.textContent = `${index + 1}. ${this.getStepTypeLabel(step.type)}`;

            const stepControls = document.createElement('div');
            stepControls.className = 'step-controls';

            // Move up button
            if (index > 0) {
                const upBtn = document.createElement('button');
                upBtn.textContent = '↑';
                upBtn.title = 'Di chuyển lên';
                upBtn.onclick = () => this.moveStep(index, 'up');
                stepControls.appendChild(upBtn);
            }

            // Move down button
            if (index < this.steps.length - 1) {
                const downBtn = document.createElement('button');
                downBtn.textContent = '↓';
                downBtn.title = 'Di chuyển xuống';
                downBtn.onclick = () => this.moveStep(index, 'down');
                stepControls.appendChild(downBtn);
            }

            // Edit button
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Sửa';
            editBtn.className = 'edit-btn';
            editBtn.onclick = () => this.editStep(index);
            stepControls.appendChild(editBtn);

            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Xóa';
            deleteBtn.className = 'delete-btn';
            deleteBtn.onclick = () => this.deleteStep(index);
            stepControls.appendChild(deleteBtn);

            stepHeader.appendChild(stepType);
            stepHeader.appendChild(stepControls);

            const stepDetails = document.createElement('div');
            stepDetails.className = 'step-details';
            stepDetails.textContent = this.getStepDescription(step);

            stepElement.appendChild(stepHeader);
            stepElement.appendChild(stepDetails);
            container.appendChild(stepElement);
        });
    }

    getStepTypeLabel(type) {
        const labels = {
            // Classic
            click: 'Click (tọa độ)',
            clickElement: 'Click Element',
            type: 'Nhập Text',
            press: 'Nhấn Phím',
            waitForElement: 'Chờ Element',
            wait: 'Chờ',
            scroll: 'Scroll',
            hover: 'Hover',
            selectOption: 'Chọn Option',
            check: 'Check/Uncheck',
            getText: 'Lấy Text',
            getAttribute: 'Lấy Attribute',
            goto: 'Đi tới URL',
            reload: 'Reload trang',
            // Playwright-style
            getByRole: 'Tìm theo Role',
            getByText: 'Tìm theo Text',
            getByPlaceholder: 'Tìm theo Placeholder',
            fill: 'Điền Text (Fill)',
            setInputFiles: 'Upload Files',
            innerText: 'Lấy Inner Text',
            textContent: 'Lấy Text Content',
            inputValue: 'Lấy Input Value'
        };
        return labels[type] || type;
    }

    getStepDescription(step) {
        switch (step.type) {
            case 'click':
                return `Tọa độ: (${step.x}, ${step.y}), Nút: ${step.button || 'left'}, Số lần: ${step.clickCount || 1}`;
            case 'clickElement':
                return `Selector: ${step.selector}, Nút: ${step.button || 'left'}`;
            case 'type':
                return `Selector: ${step.selector}, Text: "${step.text}", Xóa cũ: ${step.clear ? 'Có' : 'Không'}`;
            case 'press':
                return `Phím: ${step.key}${step.modifiers ? ', Modifiers: ' + step.modifiers.join('+') : ''}`;
            case 'waitForElement':
                return `Selector: ${step.selector}, Timeout: ${step.timeout || 30000}ms`;
            case 'wait':
                return `Thời gian: ${step.duration}ms`;
            case 'scroll':
                return `Vị trí: (${step.x || 0}, ${step.y})${step.delta ? `, Delta: ${step.delta}px` : ''}, Smooth: ${step.smooth ? 'Có' : 'Không'}`;
            case 'hover':
                return `Selector: ${step.selector}`;
            case 'selectOption':
                return `Selector: ${step.selector}, Value: ${step.value}`;
            case 'check':
                return `Selector: ${step.selector}, Checked: ${step.checked ? 'Có' : 'Không'}`;
            case 'getText':
                return `Selector: ${step.selector}`;
            case 'getAttribute':
                return `Selector: ${step.selector}, Attribute: ${step.attribute}`;
            case 'goto':
                return `URL: ${step.url}`;
            case 'reload':
                return 'Reload trang hiện tại';
            // Playwright-style
            case 'getByRole':
                return `Role: ${step.role}, Name: "${step.name}", Action: ${step.action}`;
            case 'getByText':
                return `Text: "${step.text}", Action: ${step.action}`;
            case 'getByPlaceholder':
                return `Placeholder: "${step.placeholder}", Action: ${step.action}${step.value ? `, Value: "${step.value}"` : ''}`;
            case 'fill':
                return `Selector: ${step.selector}, Text: "${step.text}"`;
            case 'setInputFiles':
                return `Selector: ${step.selector}, Files: ${Array.isArray(step.filePaths) ? step.filePaths.length : 0} file(s)`;
            case 'innerText':
            case 'textContent':
            case 'inputValue':
                return `Selector: ${step.selector}`;
            default:
                return JSON.stringify(step, null, 2);
        }
    }

    // ====================================================================
    // PLAYWRIGHT EXPORT FUNCTIONALITY
    // ====================================================================

    exportToPlaywright() {
        if (this.steps.length === 0) {
            this.showAlert('Không có bước nào để xuất.', 'warning');
            return;
        }

        const playwrightCode = this.generatePlaywrightCode();
        this.showPlaywrightExportModal(playwrightCode);
    }

    generatePlaywrightCode() {
        const lines = [
            "const { test, expect } = require('@playwright/test');",
            "",
            "test('Generated automation script', async ({ page }) => {",
            "  // Auto-generated script from Web Automation Suite",
            `  // Generated on: ${new Date().toISOString()}`,
            `  // Total steps: ${this.steps.length}`,
            ""
        ];

        this.steps.forEach((step, index) => {
            lines.push(`  // Step ${index + 1}: ${this.getStepTypeLabel(step.type)}`);
            lines.push(this.stepToPlaywrightCode(step));
            lines.push("");
        });

        lines.push("});");

        return lines.join('\n');
    }

    stepToPlaywrightCode(step) {
        switch (step.type) {
            case 'click':
                return `  await page.mouse.click(${step.x}, ${step.y});`;

            case 'clickElement':
                return `  await page.locator('${step.selector}').click();`;

            case 'type':
                if (step.clear !== false) {
                    return `  await page.locator('${step.selector}').fill('${step.text}');`;
                } else {
                    return `  await page.locator('${step.selector}').type('${step.text}');`;
                }

            case 'fill':
                return `  await page.locator('${step.selector}').fill('${step.text}');`;

            case 'press':
                const modifiers = step.modifiers && step.modifiers.length > 0 ? 
                    step.modifiers.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join('+') + '+' : '';
                return `  await page.keyboard.press('${modifiers}${step.key}');`;

            case 'wait':
                return `  await page.waitForTimeout(${step.duration});`;

            case 'waitForElement':
                return `  await page.waitForSelector('${step.selector}', { timeout: ${step.timeout || 30000} });`;

            case 'scroll':
                if (step.delta) {
                    return `  await page.mouse.wheel(0, ${step.delta});`;
                } else {
                    return `  await page.evaluate(() => window.scrollTo(${step.x || 0}, ${step.y}));`;
                }

            case 'hover':
                return `  await page.locator('${step.selector}').hover();`;

            case 'selectOption':
                return `  await page.locator('${step.selector}').selectOption('${step.value}');`;

            case 'check':
                if (step.checked) {
                    return `  await page.locator('${step.selector}').check();`;
                } else {
                    return `  await page.locator('${step.selector}').uncheck();`;
                }

            case 'getText':
            case 'innerText':
                return `  const text = await page.locator('${step.selector}').innerText();`;

            case 'textContent':
                return `  const text = await page.locator('${step.selector}').textContent();`;

            case 'inputValue':
                return `  const value = await page.locator('${step.selector}').inputValue();`;

            case 'getAttribute':
                return `  const value = await page.locator('${step.selector}').getAttribute('${step.attribute}');`;

            case 'goto':
                return `  await page.goto('${step.url}');`;

            case 'reload':
                return `  await page.reload();`;

            // Playwright-style locators
            case 'getByRole':
                const roleAction = step.action === 'click' ? '.click()' : '.hover()';
                return `  await page.getByRole('${step.role}', { name: '${step.name}' })${roleAction};`;

            case 'getByText':
                const textAction = step.action === 'click' ? '.click()' : '.hover()';
                return `  await page.getByText('${step.text}')${textAction};`;

            case 'getByPlaceholder':
                if (step.action === 'fill' && step.value) {
                    return `  await page.getByPlaceholder('${step.placeholder}').fill('${step.value}');`;
                } else {
                    return `  await page.getByPlaceholder('${step.placeholder}').click();`;
                }

            case 'setInputFiles':
                const files = Array.isArray(step.filePaths) ? step.filePaths : [step.filePaths];
                const fileList = files.map(f => `'${f}'`).join(', ');
                return `  await page.locator('${step.selector}').setInputFiles([${fileList}]);`;

            default:
                return `  // Unsupported step type: ${step.type}`;
        }
    }

    showPlaywrightExportModal(code) {
        // Remove existing modal if any
        const existingModal = document.getElementById('playwrightExportModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'playwrightExportModal';
        modal.className = 'modal';
        modal.style.display = 'block';

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px; max-height: 90vh;">
                <div class="modal-header">
                    <h3>Export Playwright Script</h3>
                    <button class="close">&times;</button>
                </div>
                <div style="margin-bottom: 16px;">
                    <p style="font-size: 12px; color: #666;">
                        Script đã được chuyển đổi sang định dạng Playwright. Copy code bên dưới để sử dụng.
                    </p>
                </div>
                <textarea id="playwrightCode" style="width: 100%; height: 400px; font-family: 'Courier New', monospace; font-size: 11px; border: 1px solid #ddd; padding: 10px;" readonly>${code}</textarea>
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px;">
                    <button id="copyPlaywrightCode" class="btn btn-primary">📋 Copy Code</button>
                    <button id="downloadPlaywrightFile" class="btn btn-secondary">💾 Download File</button>
                    <button id="closePlaywrightModal" class="btn btn-secondary">Đóng</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event handlers
        modal.querySelector('.close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.querySelector('#closePlaywrightModal').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.querySelector('#copyPlaywrightCode').addEventListener('click', () => {
            const textarea = modal.querySelector('#playwrightCode');
            textarea.select();
            document.execCommand('copy');
            this.showAlert('Đã copy code vào clipboard!', 'success');
        });

        modal.querySelector('#downloadPlaywrightFile').addEventListener('click', () => {
            const blob = new Blob([code], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `playwright-script-${Date.now()}.js`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            this.showAlert('Đã download file Playwright!', 'success');
        });

        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    // ====================================================================
    // EXISTING FUNCTIONS (SAME AS BEFORE)
    // ====================================================================

    clearScript() {
        const tabState = this.getTabRunningState(this.currentTabId);
        if (tabState.isRunning) {
            this.showAlert('Không thể xóa khi đang chạy kịch bản.', 'warning');
            return;
        }

        if (this.steps.length === 0 || this.confirmSidebar('Bạn có chắc muốn xóa toàn bộ kịch bản?')) {
            this.steps = [];
            this.updateStepsDisplay();
        }
    }

    showSaveScriptModal() {
        if (this.steps.length === 0) {
            this.showAlert('Không có bước nào để lưu.', 'warning');
            return;
        }

        document.getElementById('scriptName').value = '';
        this.loadSavedScripts();
        document.getElementById('scriptManagerModal').style.display = 'block';
    }

    hideScriptManagerModal() {
        document.getElementById('scriptManagerModal').style.display = 'none';
    }

    async confirmSaveScript() {
        const name = document.getElementById('scriptName').value.trim();
        if (!name) {
            this.showAlert('Vui lòng nhập tên kịch bản.', 'warning');
            return;
        }

        try {
            await window.dbHelper.saveScript(name, this.steps);
            this.showAlert('Đã lưu kịch bản thành công!', 'success');
            this.loadSavedScripts();
            document.getElementById('scriptName').value = '';
        } catch (error) {
            console.error('Failed to save script:', error);
            this.showAlert('Không thể lưu kịch bản. Vui lòng thử lại.', 'error');
        }
    }

    showLoadScriptModal() {
        this.loadSavedScripts();
        document.getElementById('scriptManagerModal').style.display = 'block';
    }

    async loadSavedScripts() {
        try {
            const scripts = await window.dbHelper.getAllScripts();
            const container = document.getElementById('savedScripts');
            container.innerHTML = '';

            if (scripts.length === 0) {
                container.innerHTML = '<div class="empty-state">Chưa có kịch bản nào được lưu.</div>';
                return;
            }

            scripts.forEach(script => {
                const item = document.createElement('div');
                item.className = 'saved-script-item';

                const nameDiv = document.createElement('div');
                nameDiv.className = 'saved-script-name';
                nameDiv.textContent = script.name;

                const metaDiv = document.createElement('div');
                metaDiv.className = 'saved-script-meta';
                metaDiv.style.fontSize = '10px';
                metaDiv.style.color = '#666';
                metaDiv.textContent = `${script.steps.length} bước • ${new Date(script.createdDate).toLocaleDateString('vi-VN')}`;

                const controls = document.createElement('div');
                controls.className = 'saved-script-controls';

                const loadBtn = document.createElement('button');
                loadBtn.textContent = 'Tải';
                loadBtn.onclick = () => this.loadScript(script);
                controls.appendChild(loadBtn);

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Xóa';
                deleteBtn.className = 'delete-btn';
                deleteBtn.onclick = () => this.deleteScript(script.id);
                controls.appendChild(deleteBtn);

                const itemContent = document.createElement('div');
                itemContent.style.flex = '1';
                itemContent.appendChild(nameDiv);
                itemContent.appendChild(metaDiv);

                item.appendChild(itemContent);
                item.appendChild(controls);
                container.appendChild(item);
            });
        } catch (error) {
            console.error('Failed to load scripts:', error);
        }
    }

    loadScript(script) {
        const tabState = this.getTabRunningState(this.currentTabId);
        if (tabState.isRunning) {
            this.showAlert('Không thể tải khi đang chạy kịch bản.', 'warning');
            return;
        }

        if (this.steps.length > 0 && !this.confirmSidebar('Bạn có chắc muốn thay thế kịch bản hiện tại?')) {
            return;
        }

        this.steps = [...script.steps];
        this.updateStepsDisplay();
        this.hideScriptManagerModal();
        this.showAlert(`Đã tải kịch bản "${script.name}" thành công!`, 'success');
    }

    async deleteScript(scriptId) {
        if (this.confirmSidebar('Bạn có chắc muốn xóa kịch bản này?')) {
            try {
                await window.dbHelper.deleteScript(scriptId);
                this.loadSavedScripts();
                this.showAlert('Đã xóa kịch bản thành công!', 'success');
            } catch (error) {
                console.error('Failed to delete script:', error);
                this.showAlert('Không thể xóa kịch bản. Vui lòng thử lại.', 'error');
            }
        }
    }

    async runScript() {
        if (this.steps.length === 0) {
            this.showAlert('Không có bước nào để chạy.', 'warning');
            return;
        }

        if (!this.currentTabId) {
            this.showAlert('Chưa xác định được tab. Vui lòng thử lại.', 'error');
            return;
        }

        const tabState = this.getTabRunningState(this.currentTabId);
        if (tabState.isRunning) {
            this.showAlert('Kịch bản đang chạy. Vui lòng đợi hoàn thành.', 'warning');
            return;
        }

        this.setTabRunningState(this.currentTabId, { 
            isRunning: true, 
            stepIndex: 0 
        });
        this.updateStepsDisplay();

        try {
            for (let i = 0; i < this.steps.length; i++) {
                this.setTabRunningState(this.currentTabId, { stepIndex: i });
                this.updateStepsDisplay();

                const step = this.steps[i];
                console.log(`Tab ${this.currentTabId}: Executing step ${i + 1}:`, step);

                // Send step to background with tab ID
                const result = await this.executeStepForTab(step);
                console.log(`Tab ${this.currentTabId}: Step ${i + 1} result:`, result);

                // Small delay between steps
                await this.sleep(500);
            }

            this.showAlert(`Tab ${this.currentTabId}: Kịch bản đã chạy xong thành công!`, 'success');
        } catch (error) {
            console.error('Script execution failed:', error);
            this.showAlert(`Tab ${this.currentTabId}: Lỗi khi chạy bước ${tabState.stepIndex + 1}: ${error.message}`, 'error');
        } finally {
            this.setTabRunningState(this.currentTabId, { 
                isRunning: false, 
                stepIndex: -1 
            });
            this.updateStepsDisplay();
        }
    }

    executeStepForTab(step) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: "executeStep",
                step: step,
                tabId: this.currentTabId
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                if (response && response.success) {
                    resolve(response.result);
                } else {
                    reject(new Error(response?.error || "Step execution failed"));
                }
            });
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    clearStepParametersForm() {
        const paramInputs = document.querySelectorAll('#stepParams input, #stepParams select, #stepParams textarea');
        paramInputs.forEach(input => {
            if (input.type === 'checkbox') {
                input.checked = false;
            } else {
                input.value = '';
            }
            input.style.borderColor = '#ccc';
        });
    }

    // Utility functions
    showAlert(message, type = 'info') {
        // Use the sidebar notification system
        if (window.SidebarUtils && window.SidebarUtils.showNotification) {
            window.SidebarUtils.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    confirmSidebar(message) {
        // Use simple confirm for now - could be enhanced with custom modal
        return confirm(message);
    }
}

// Initialize script builder when page loads
let enhancedScriptBuilder;
document.addEventListener('DOMContentLoaded', () => {
    enhancedScriptBuilder = new EnhancedScriptBuilder();
});