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
        const addStepBtn = document.getElementById('addStepBtn');
        if (addStepBtn) {
            addStepBtn.addEventListener('click', () => {
                this.showAddStepModal();
            });
        }

        // Save script button
        const saveScriptBtn = document.getElementById('saveScriptBtn');
        if (saveScriptBtn) {
            saveScriptBtn.addEventListener('click', () => {
                this.showSaveScriptModal();
            });
        }

        // Load script button
        const loadScriptBtn = document.getElementById('loadScriptBtn');
        if (loadScriptBtn) {
            loadScriptBtn.addEventListener('click', () => {
                this.showLoadScriptModal();
            });
        }

        // Run script button
        const runScriptBtn = document.getElementById('runScriptBtn');
        if (runScriptBtn) {
            runScriptBtn.addEventListener('click', () => {
                this.runScript();
            });
        }

        // Clear script button
        const clearScriptBtn = document.getElementById('clearScriptBtn');
        if (clearScriptBtn) {
            clearScriptBtn.addEventListener('click', () => {
                this.clearScript();
            });
        }

        // Export Playwright button - FIXED
        const exportPlaywrightBtn = document.getElementById('exportPlaywrightBtn');
        if (exportPlaywrightBtn) {
            console.log('🎭 Export Playwright button found, binding event...');
            exportPlaywrightBtn.addEventListener('click', () => {
                console.log('🎭 Export Playwright clicked!');
                this.exportToPlaywright();
            });
        } else {
            console.error('❌ Export Playwright button not found!');
        }

        // Step type change
        const stepType = document.getElementById('stepType');
        if (stepType) {
            stepType.addEventListener('change', (e) => {
                this.updateStepParameters(e.target.value);
            });
        }

        // Modal controls
        const confirmAddStep = document.getElementById('confirmAddStep');
        if (confirmAddStep) {
            confirmAddStep.addEventListener('click', () => {
                this.confirmAddStep();
            });
        }

        const cancelAddStep = document.getElementById('cancelAddStep');
        if (cancelAddStep) {
            cancelAddStep.addEventListener('click', () => {
                this.hideAddStepModal();
            });
        }

        const confirmSaveScript = document.getElementById('confirmSaveScript');
        if (confirmSaveScript) {
            confirmSaveScript.addEventListener('click', () => {
                this.confirmSaveScript();
            });
        }

        const cancelScriptManager = document.getElementById('cancelScriptManager');
        if (cancelScriptManager) {
            cancelScriptManager.addEventListener('click', () => {
                this.hideScriptManagerModal();
            });
        }

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
            // ENHANCED SCROLL with multiple modes
            scroll: [
                { name: 'scrollMode', label: 'Chế độ scroll', type: 'select', 
                  options: ['absolute', 'relative', 'percentage', 'delta'], default: 'absolute',
                  help: 'absolute: tọa độ tuyệt đối, relative: từ vị trí hiện tại, percentage: theo %, delta: scroll một khoảng' },
                { name: 'x', label: 'Vị trí X (absolute/relative)', type: 'number', default: 0 },
                { name: 'y', label: 'Vị trí Y (absolute/relative)', type: 'number', default: 0 },
                { name: 'percentageX', label: 'Phần trăm X (0-100)', type: 'number', placeholder: '0-100' },
                { name: 'percentageY', label: 'Phần trăm Y (0-100)', type: 'number', placeholder: '0-100' },
                { name: 'delta', label: 'Delta Y (px)', type: 'number', placeholder: '100 = scroll down 100px, -100 = scroll up' },
                { name: 'smooth', label: 'Scroll mượt', type: 'checkbox', default: true }
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
            ],

            // NEW LOOP ACTIONS
            for: [
                { name: 'variable', label: 'Biến đếm', type: 'text-expand', required: true, default: 'i', placeholder: 'i, index, count' },
                { name: 'start', label: 'Giá trị bắt đầu', type: 'number', required: true, default: 1 },
                { name: 'end', label: 'Giá trị kết thúc', type: 'number', required: true, default: 5 },
                { name: 'steps', label: 'Các bước trong vòng lặp', type: 'nestedSteps', required: true, help: 'Thêm các bước sẽ được lặp lại' }
            ],
            while: [
                { name: 'conditionSelector', label: 'CSS Selector kiểm tra', type: 'text', required: true, placeholder: '.loading, #status' },
                { name: 'conditionProperty', label: 'Thuộc tính kiểm tra', type: 'select', required: true, 
                  options: ['textContent', 'innerText', 'value', 'checked', 'disabled', 'style.display'], default: 'textContent' },
                { name: 'conditionOperator', label: 'Toán tử so sánh', type: 'select', required: true,
                  options: ['equals', 'not_equals', 'contains', 'not_contains', 'exists', 'not_exists'], default: 'equals' },
                { name: 'conditionValue', label: 'Giá trị so sánh', type: 'text', placeholder: 'Loading..., true, false' },
                { name: 'maxIterations', label: 'Số lần lặp tối đa', type: 'number', default: 10, help: 'Để tránh vòng lặp vô hạn' },
                { name: 'steps', label: 'Các bước trong vòng lặp', type: 'nestedSteps', required: true, help: 'Thêm các bước sẽ được lặp lại' }
            ]
        };
    }

    showAddStepModal() {
        console.log('📝 showAddStepModal called');
        
        try {
            const modal = document.getElementById('addStepModal');
            if (!modal) {
                console.error('❌ Add step modal not found in DOM');
                this.showAlert('Lỗi: Không tìm thấy modal thêm bước', 'error');
                return;
            }
            
            modal.style.display = 'block';
            console.log('📝 Modal displayed');
            
            // Reset form
            this.currentEditingStep = null;
            
            // Set default step type and update parameters
            const stepTypeSelect = document.getElementById('stepType');
            if (stepTypeSelect) {
                stepTypeSelect.value = 'click';
                console.log('📝 Default step type set to:', stepTypeSelect.value);
                this.updateStepParameters('click');
            } else {
                console.error('❌ Step type select not found');
            }
            
            // Clear any previous validation errors
            const paramInputs = document.querySelectorAll('#stepParams input, #stepParams select, #stepParams textarea');
            paramInputs.forEach(input => {
                input.style.borderColor = '#ccc';
            });
            
            console.log('✅ Add step modal opened successfully');
            
        } catch (error) {
            console.error('❌ Error in showAddStepModal:', error);
            this.showAlert(`Lỗi mở modal: ${error.message}`, 'error');
        }
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

            // Add scroll mode specific logic
            if (stepType === 'scroll' && param.name === 'scrollMode') {
                input.addEventListener('change', () => {
                    this.updateScrollParameterVisibility(input.value);
                });
                // Set initial visibility
                this.updateScrollParameterVisibility(input.value);
            }
        });
    }

    updateScrollParameterVisibility(scrollMode) {
        const params = document.querySelectorAll('#stepParams .param-group');
        
        params.forEach(paramGroup => {
            const input = paramGroup.querySelector('[data-param-name]');
            if (!input) return;
            
            const paramName = input.dataset.paramName;
            
            // Hide all mode-specific parameters first
            if (['x', 'y', 'percentageX', 'percentageY', 'delta'].includes(paramName)) {
                paramGroup.style.display = 'none';
                input.required = false;
            }
            
            // Show relevant parameters based on mode
            switch (scrollMode) {
                case 'absolute':
                case 'relative':
                    if (['x', 'y'].includes(paramName)) {
                        paramGroup.style.display = 'block';
                        if (paramName === 'y') input.required = true;
                    }
                    break;
                case 'percentage':
                    if (['percentageX', 'percentageY'].includes(paramName)) {
                        paramGroup.style.display = 'block';
                        if (paramName === 'percentageY') input.required = true;
                    }
                    break;
                case 'delta':
                    if (paramName === 'delta') {
                        paramGroup.style.display = 'block';
                        input.required = true;
                    }
                    break;
            }
        });
    }

    createFilePickerInput(param) {
        console.log('📁 Creating file picker input for param:', param.name);
        
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
            console.log('📁 Browse button clicked');
            const originalText = browseBtn.textContent;
            
            try {
                // Show loading state
                browseBtn.textContent = '⏳ Đang tải...';
                browseBtn.disabled = true;
                
                // Check if IndexedDB helper is ready
                if (!window.dbHelper) {
                    throw new Error('File Manager chưa sẵn sàng. Vui lòng chờ một chút và thử lại.');
                }
                
                // Ensure IndexedDB is initialized
                if (!window.dbHelper.db) {
                    console.log('📁 Initializing IndexedDB...');
                    await window.dbHelper.init();
                }
                
                console.log('📁 Getting files from IndexedDB...');
                
                // Get files from IndexedDB with timeout
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Timeout khi tải files')), 10000);
                });
                
                const [allFiles, allFolders] = await Promise.race([
                    Promise.all([
                        window.dbHelper.getAllFiles(),
                        window.dbHelper.getAllFolders()
                    ]),
                    timeoutPromise
                ]);
                
                console.log('📁 Retrieved', allFiles.length, 'files and', allFolders.length, 'folders');
                
                if (allFiles.length === 0) {
                    throw new Error('Chưa có file nào trong File Manager. Vui lòng upload files trước.');
                }
                
                // Create file picker modal
                console.log('📁 Creating file picker modal...');
                const modal = this.createFilePickerModal(allFiles, allFolders, param.multiple);
                document.body.appendChild(modal);
                
                // Handle modal events
                modal.addEventListener('filesSelected', (event) => {
                    console.log('📁 Files selected:', event.detail.files);
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
                        
                        // Trigger change event for validation
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    
                    document.body.removeChild(modal);
                });
                
                modal.addEventListener('cancelled', () => {
                    console.log('📁 File picker cancelled');
                    document.body.removeChild(modal);
                });
                
            } catch (error) {
                console.error('📁 File picker error:', error);
                this.showAlert(`Lỗi chọn files: ${error.message}`, 'error');
                
                // Fallback: show simple input for manual entry
                const manualInput = prompt(
                    'Lỗi File Manager. Nhập đường dẫn file thủ công (ngăn cách bởi dấu phẩy):\n\n' +
                    'Ví dụ: image.jpg, folder/data.txt',
                    ''
                );
                
                if (manualInput && manualInput.trim()) {
                    const paths = manualInput.split(',').map(s => s.trim()).filter(s => s);
                    if (paths.length > 0) {
                        selectedFiles = paths.map(path => ({ path: path }));
                        displayArea.innerHTML = selectedFiles.map(file => 
                            `<div style="margin: 2px 0;">📄 ${file.path} <small>(thủ công)</small></div>`
                        ).join('');
                        input.value = selectedFiles.map(f => f.path).join(',');
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        
                        this.showAlert(`✅ Đã nhập ${paths.length} file path thủ công`, 'success');
                    }
                }
                
            } finally {
                // Restore button state
                browseBtn.textContent = originalText;
                browseBtn.disabled = false;
            }
        });
        
        container.appendChild(displayArea);
        container.appendChild(browseBtn);
        container.appendChild(input);
        
        return container;
    }

    createFilePickerModal(allFiles, allFolders, multiple = false) {
        console.log('📁 Creating file picker modal with', allFiles.length, 'files,', allFolders.length, 'folders');
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        
        const content = document.createElement('div');
        content.className = 'modal-content';
        content.style.maxWidth = '500px';
        content.innerHTML = `
            <div class="modal-header">
                <h3>📁 Chọn Files từ File Manager</h3>
                <button class="close">&times;</button>
            </div>
            <div style="margin-bottom: 12px;">
                <div style="font-size: 11px; color: #666; display: flex; justify-content: space-between;">
                    <span>📊 Có sẵn: ${allFiles.length} files, ${allFolders.length} folders</span>
                    <span>🔧 Chế độ: ${multiple ? 'Chọn nhiều' : 'Chọn một'}</span>
                </div>
            </div>
            <div style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; margin: 10px 0; border-radius: 4px;">
                <div id="filePickerList"></div>
            </div>
            <div style="margin: 10px 0; padding: 10px; background: #f9f9f9; border-radius: 4px; border: 1px solid #e2e8f0;">
                <strong style="font-size: 12px; color: #374151;">📝 Đã chọn:</strong>
                <div id="selectedFilesList" style="margin-top: 5px; font-size: 11px; max-height: 60px; overflow-y: auto; color: #64748b;"></div>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="confirmFilePicker" class="btn btn-primary" disabled>✅ Xác nhận</button>
                <button id="cancelFilePicker" class="btn btn-secondary">❌ Hủy</button>
            </div>
        `;
        
        modal.appendChild(content);
        
        try {
            // Render file list
            const fileList = content.querySelector('#filePickerList');
            const selectedList = content.querySelector('#selectedFilesList');
            const confirmBtn = content.querySelector('#confirmFilePicker');
            let selectedFiles = [];
            
            selectedList.textContent = 'Chưa chọn file nào';
            
            function updateSelectedDisplay() {
                if (selectedFiles.length === 0) {
                    selectedList.textContent = 'Chưa chọn file nào';
                    confirmBtn.disabled = true;
                    confirmBtn.textContent = '✅ Xác nhận';
                } else {
                    selectedList.innerHTML = selectedFiles.map(f => `<div>📄 ${f.path}</div>`).join('');
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = `✅ Xác nhận (${selectedFiles.length})`;
                }
            }
            
            if (allFiles.length === 0) {
                fileList.innerHTML = `
                    <div style="padding: 40px; text-align: center; color: #64748b;">
                        <div style="font-size: 24px; margin-bottom: 8px;">📂</div>
                        <div style="font-size: 12px; margin-bottom: 4px;"><strong>Chưa có files</strong></div>
                        <div style="font-size: 10px;">Vui lòng upload files trong tab "Files" trước</div>
                    </div>
                `;
            } else {
                // Group files by folder
                const filesByFolder = {};
                allFiles.forEach(file => {
                    const folder = file.folderPath || 'Root';
                    if (!filesByFolder[folder]) filesByFolder[folder] = [];
                    filesByFolder[folder].push(file);
                });
                
                // Render folders and files
                Object.keys(filesByFolder).sort().forEach(folderName => {
                    // Folder header
                    const folderDiv = document.createElement('div');
                    folderDiv.style.cssText = 'background: #f0f0f0; padding: 8px; font-weight: bold; border-bottom: 1px solid #ddd; font-size: 11px; color: #374151;';
                    folderDiv.innerHTML = `📁 ${folderName} <small style="font-weight: normal; color: #64748b;">(${filesByFolder[folderName].length} files)</small>`;
                    fileList.appendChild(folderDiv);
                    
                    // Files in folder
                    filesByFolder[folderName].forEach(file => {
                        const fileDiv = document.createElement('div');
                        fileDiv.style.cssText = 'padding: 6px 16px; border-bottom: 1px solid #eee; cursor: pointer; font-size: 12px; transition: background-color 0.2s;';
                        fileDiv.innerHTML = `
                            <label style="cursor: pointer; display: flex; align-items: center; width: 100%;">
                                <input type="${multiple ? 'checkbox' : 'radio'}" name="fileSelect" style="margin-right: 8px;" value="${file.id}">
                                <span style="flex: 1;">📄 ${file.name}</span>
                                <small style="color: #64748b; margin-left: 8px;">(${this.formatFileSize(file.size)})</small>
                            </label>
                        `;
                        
                        // Hover effect
                        fileDiv.addEventListener('mouseenter', () => {
                            fileDiv.style.backgroundColor = '#f8fafc';
                        });
                        fileDiv.addEventListener('mouseleave', () => {
                            fileDiv.style.backgroundColor = '';
                        });
                        
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
                            
                            updateSelectedDisplay();
                        });
                        
                        fileList.appendChild(fileDiv);
                    });
                });
            }
            
            // Event handlers
            content.querySelector('.close').addEventListener('click', () => {
                console.log('📁 Modal close button clicked');
                modal.dispatchEvent(new CustomEvent('cancelled'));
            });
            
            content.querySelector('#cancelFilePicker').addEventListener('click', () => {
                console.log('📁 Cancel button clicked');
                modal.dispatchEvent(new CustomEvent('cancelled'));
            });
            
            content.querySelector('#confirmFilePicker').addEventListener('click', () => {
                console.log('📁 Confirm button clicked, selected files:', selectedFiles);
                modal.dispatchEvent(new CustomEvent('filesSelected', { detail: { files: selectedFiles } }));
            });
            
            // Initial display update
            updateSelectedDisplay();
            
        } catch (error) {
            console.error('📁 Error creating file picker modal:', error);
            
            // Fallback UI for errors
            content.innerHTML = `
                <div class="modal-header">
                    <h3>❌ Lỗi File Picker</h3>
                    <button class="close">&times;</button>
                </div>
                <div style="padding: 20px; text-align: center;">
                    <div style="color: #dc2626; margin-bottom: 12px;">
                        <strong>Không thể tải danh sách files</strong>
                    </div>
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 16px;">
                        Lỗi: ${error.message}
                    </div>
                    <button id="closeErrorModal" class="btn btn-secondary">Đóng</button>
                </div>
            `;
            
            content.querySelector('.close').addEventListener('click', () => {
                modal.dispatchEvent(new CustomEvent('cancelled'));
            });
            content.querySelector('#closeErrorModal').addEventListener('click', () => {
                modal.dispatchEvent(new CustomEvent('cancelled'));
            });
        }
        
        return modal;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    async confirmAddStep() {
        console.log('🔄 confirmAddStep called');
        
        const confirmBtn = document.getElementById('confirmAddStep');
        const originalText = confirmBtn ? confirmBtn.textContent : '';
        
        try {
            // Show loading state
            if (confirmBtn) {
                confirmBtn.textContent = 'Đang xử lý...';
                confirmBtn.disabled = true;
            }

            const stepType = document.getElementById('stepType').value;
            console.log('📝 Step type:', stepType);
            
            const stepData = { type: stepType, tabId: this.currentTabId };

            // Collect parameters
            const paramInputs = document.querySelectorAll('#stepParams [data-param-name]');
            let isValid = true;
            let validationErrors = [];

            console.log('🔍 Found', paramInputs.length, 'parameter inputs');

            for (const input of paramInputs) {
                const paramName = input.dataset.paramName;
                let value;

                console.log(`🔍 Processing param: ${paramName}, type: ${input.type}, required: ${input.required}`);

                if (input.type === 'checkbox') {
                    value = input.checked;
                } else if (input.type === 'number') {
                    value = input.value ? parseInt(input.value) : undefined;
                } else if (input.type === 'hidden' && paramName === 'filePaths') {
                    // File picker input - ENHANCED VALIDATION
                    const rawValue = input.value ? input.value.trim() : '';
                    if (rawValue) {
                        value = rawValue.split(',').map(s => s.trim()).filter(s => s);
                        console.log(`📁 File paths processed:`, value);
                    } else {
                        value = [];
                    }
                } else {
                    value = input.value ? input.value.trim() : '';
                }

                // ENHANCED VALIDATION with specific error messages
                if (input.required) {
                    let isEmpty = false;
                    
                    if (Array.isArray(value)) {
                        isEmpty = value.length === 0;
                    } else if (typeof value === 'string') {
                        isEmpty = value === '';
                    } else {
                        isEmpty = !value && value !== 0 && value !== false;
                    }
                    
                    if (isEmpty) {
                        console.log(`❌ Validation failed for ${paramName}:`, value);
                        isValid = false;
                        input.style.borderColor = '#dc3545';
                        
                        // Add specific error message
                        const label = input.parentElement.querySelector('label');
                        const fieldName = label ? label.textContent.replace('*', '').trim() : paramName;
                        validationErrors.push(`• ${fieldName} là bắt buộc`);
                    } else {
                        console.log(`✅ Validation passed for ${paramName}:`, value);
                        input.style.borderColor = '#ccc';
                    }
                } else {
                    input.style.borderColor = '#ccc';
                }

                // Set value in stepData
                if (value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0)) {
                    // Handle special cases
                    if (paramName === 'modifiers' && typeof value === 'string') {
                        stepData[paramName] = value.split(',').map(s => s.trim()).filter(s => s);
                    } else if (paramName === 'checked') {
                        stepData[paramName] = value === 'true';
                    } else {
                        stepData[paramName] = value;
                    }
                }
            }

            // Special handling for scroll step
            if (stepType === 'scroll') {
                const scrollMode = stepData.scrollMode || 'absolute';
                
                // Set the correct mode flags
                stepData.relative = scrollMode === 'relative';
                
                // Clean up unused parameters based on mode
                switch (scrollMode) {
                    case 'absolute':
                    case 'relative':
                        delete stepData.percentageX;
                        delete stepData.percentageY;
                        delete stepData.delta;
                        break;
                    case 'percentage':
                        delete stepData.x;
                        delete stepData.y;
                        delete stepData.delta;
                        break;
                    case 'delta':
                        delete stepData.x;
                        delete stepData.y;
                        delete stepData.percentageX;
                        delete stepData.percentageY;
                        break;
                }
            }

            if (!isValid) {
                console.log('❌ Validation failed, errors:', validationErrors);
                const errorMessage = validationErrors.length > 0 ? 
                    `Lỗi validation:\n${validationErrors.join('\n')}` : 
                    'Vui lòng điền đầy đủ thông tin bắt buộc.';
                this.showAlert(errorMessage, 'error');
                return;
            }

            console.log('✅ All validation passed, step data:', stepData);

            if (this.currentEditingStep !== null) {
                // Update existing step
                this.steps[this.currentEditingStep] = stepData;
                console.log('📝 Updated existing step at index:', this.currentEditingStep);
            } else {
                // Add new step
                this.steps.push(stepData);
                console.log('➕ Added new step, total steps:', this.steps.length);
            }

            this.updateStepsDisplay();
            this.hideAddStepModal();
            
            const actionText = this.currentEditingStep !== null ? 'cập nhật' : 'thêm';
            this.showAlert(`✅ Đã ${actionText} bước "${this.getStepTypeLabel(stepType)}" thành công!`, 'success');

        } catch (error) {
            console.error('❌ Error in confirmAddStep:', error);
            this.showAlert(`Lỗi khi thêm bước: ${error.message}`, 'error');
        } finally {
            // Restore button state
            if (confirmBtn) {
                confirmBtn.textContent = originalText;
                confirmBtn.disabled = false;
            }
        }
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

            // Special handling for scroll step editing
            if (step.type === 'scroll') {
                let scrollMode = 'absolute';
                if (step.relative) scrollMode = 'relative';
                else if (step.percentageY !== undefined) scrollMode = 'percentage';
                else if (step.delta !== undefined) scrollMode = 'delta';
                
                const scrollModeInput = document.querySelector('[data-param-name="scrollMode"]');
                if (scrollModeInput) {
                    scrollModeInput.value = scrollMode;
                    this.updateScrollParameterVisibility(scrollMode);
                }
            }
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
                let scrollDesc = '';
                if (step.delta !== undefined) {
                    scrollDesc = `Delta: ${step.delta}px`;
                } else if (step.percentageY !== undefined) {
                    scrollDesc = `Phần trăm: X=${step.percentageX || 0}%, Y=${step.percentageY}%`;
                } else {
                    const mode = step.relative ? 'tương đối' : 'tuyệt đối';
                    scrollDesc = `${mode}: (${step.x || 0}, ${step.y})`;
                }
                return `${scrollDesc}, Smooth: ${step.smooth ? 'Có' : 'Không'}`;
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
    // PLAYWRIGHT EXPORT FUNCTIONALITY - ENHANCED & FIXED
    // ====================================================================

    exportToPlaywright() {
        console.log('🎭 exportToPlaywright called');
        console.log('🎭 Steps count:', this.steps.length);
        
        if (this.steps.length === 0) {
            this.showAlert('Không có bước nào để xuất.', 'warning');
            return;
        }

        try {
            console.log('🎭 Generating Playwright code...');
            const playwrightCode = this.generatePlaywrightCode();
            console.log('🎭 Playwright code generated:', playwrightCode.substring(0, 200) + '...');
            
            console.log('🎭 Showing export modal...');
            this.showPlaywrightExportModal(playwrightCode);
        } catch (error) {
            console.error('🎭 Export error:', error);
            this.showAlert('Lỗi khi xuất Playwright: ' + error.message, 'error');
        }
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

        // Add goto current URL at the beginning if we have a tab
        if (this.currentTabId) {
            lines.push("  // Navigate to current page (replace with your URL)");
            lines.push("  // await page.goto('https://your-website.com');");
            lines.push("");
        }

        this.steps.forEach((step, index) => {
            lines.push(`  // Step ${index + 1}: ${this.getStepTypeLabel(step.type)}`);
            const code = this.stepToPlaywrightCode(step);
            if (Array.isArray(code)) {
                lines.push(...code);
            } else {
                lines.push(code);
            }
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
                if (step.delta !== undefined) {
                    return `  await page.mouse.wheel(0, ${step.delta});`;
                } else if (step.percentageY !== undefined) {
                    return `  await page.evaluate(() => {
    const maxY = document.documentElement.scrollHeight - window.innerHeight;
    const targetY = (${step.percentageY} / 100) * maxY;
    window.scrollTo(${step.percentageX || 0}, targetY);
  });`;
                } else {
                    if (step.relative) {
                        return `  await page.evaluate(() => {
    const currentX = window.pageXOffset;
    const currentY = window.pageYOffset;
    window.scrollTo(currentX + ${step.x || 0}, currentY + ${step.y || 0});
  });`;
                    } else {
                        return `  await page.evaluate(() => window.scrollTo(${step.x || 0}, ${step.y}));`;
                    }
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

            // NEW LOOP CASES
            case 'for':
                const forLines = [
                    `  for (let ${step.variable} = ${step.start}; ${step.variable} <= ${step.end}; ${step.variable}++) {`,
                    `    // Loop iteration \${${step.variable}}`
                ];
                
                if (step.steps && step.steps.length > 0) {
                    step.steps.forEach(subStep => {
                        const subCode = this.stepToPlaywrightCode(subStep);
                        if (Array.isArray(subCode)) {
                            forLines.push(...subCode.map(line => '  ' + line));
                        } else {
                            forLines.push('  ' + subCode);
                        }
                    });
                }
                
                forLines.push('  }');
                return forLines;

            case 'while':
                const whileLines = [
                    `  let iterations = 0;`,
                    `  while (iterations < ${step.maxIterations}) {`,
                    `    iterations++;`,
                    `    `,
                    `    // Check condition`,
                    `    const element = await page.locator('${step.conditionSelector}').first();`,
                    `    const exists = await element.count() > 0;`,
                    `    `,
                    `    if (!exists) {`,
                    `      if ('${step.conditionOperator}' === 'not_exists') break;`,
                    `      if ('${step.conditionOperator}' !== 'exists') continue;`,
                    `    } else {`,
                    `      if ('${step.conditionOperator}' === 'exists') break;`,
                    `    }`,
                    `    `,
                    `    if (exists) {`,
                    `      const value = await element.${step.conditionProperty}();`,
                    `      `,
                    `      let conditionMet = false;`,
                    `      switch ('${step.conditionOperator}') {`,
                    `        case 'equals': conditionMet = value === '${step.conditionValue}'; break;`,
                    `        case 'not_equals': conditionMet = value !== '${step.conditionValue}'; break;`,
                    `        case 'contains': conditionMet = value.includes('${step.conditionValue}'); break;`,
                    `        case 'not_contains': conditionMet = !value.includes('${step.conditionValue}'); break;`,
                    `      }`,
                    `      `,
                    `      if (!conditionMet) break;`,
                    `    }`,
                    `    `,
                    `    // Execute loop steps`
                ];
                
                if (step.steps && step.steps.length > 0) {
                    step.steps.forEach(subStep => {
                        const subCode = this.stepToPlaywrightCode(subStep);
                        if (Array.isArray(subCode)) {
                            whileLines.push(...subCode.map(line => '    ' + line));
                        } else {
                            whileLines.push('    ' + subCode);
                        }
                    });
                }
                
                whileLines.push('  }');
                return whileLines;

            default:
                return `  // Unsupported step type: ${step.type}`;
        }
    }

    showPlaywrightExportModal(code) {
        console.log('🎭 showPlaywrightExportModal called');
        
        // Remove existing modal if any
        const existingModal = document.getElementById('playwrightExportModal');
        if (existingModal) {
            console.log('🎭 Removing existing modal');
            existingModal.remove();
        }

        console.log('🎭 Creating new modal');
        const modal = document.createElement('div');
        modal.id = 'playwrightExportModal';
        modal.className = 'modal';
        modal.style.display = 'block';

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px; max-height: 90vh;">
                <div class="modal-header">
                    <h3>🎭 Export Playwright Script</h3>
                    <button class="close">&times;</button>
                </div>
                <div style="margin-bottom: 16px;">
                    <p style="font-size: 12px; color: #666; line-height: 1.4;">
                        🎯 Script đã được chuyển đổi sang định dạng Playwright.<br>
                        📋 Copy code bên dưới để sử dụng trong dự án Playwright của bạn.
                    </p>
                </div>
                <textarea id="playwrightCode" style="width: 100%; height: 400px; font-family: 'Courier New', monospace; font-size: 11px; border: 1px solid #ddd; padding: 10px; border-radius: 4px; resize: vertical;" readonly>${code}</textarea>
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px;">
                    <button id="copyPlaywrightCode" class="btn btn-primary">📋 Copy Code</button>
                    <button id="downloadPlaywrightFile" class="btn btn-secondary">💾 Download File</button>
                    <button id="closePlaywrightModal" class="btn btn-secondary">❌ Đóng</button>
                </div>
            </div>
        `;

        console.log('🎭 Appending modal to body');
        document.body.appendChild(modal);

        console.log('🎭 Setting up event handlers');
        
        // Event handlers
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                console.log('🎭 Close button clicked');
                document.body.removeChild(modal);
            });
        }

        const closeModalBtn = modal.querySelector('#closePlaywrightModal');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                console.log('🎭 Close modal button clicked');
                document.body.removeChild(modal);
            });
        }

        const copyBtn = modal.querySelector('#copyPlaywrightCode');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                console.log('🎭 Copy button clicked');
                const textarea = modal.querySelector('#playwrightCode');
                if (textarea) {
                    textarea.select();
                    document.execCommand('copy');
                    this.showAlert('✅ Đã copy code vào clipboard!', 'success');
                }
            });
        }

        const downloadBtn = modal.querySelector('#downloadPlaywrightFile');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                console.log('🎭 Download button clicked');
                const blob = new Blob([code], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `playwright-script-${Date.now()}.js`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                this.showAlert('✅ Đã download file Playwright!', 'success');
            });
        }

        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                console.log('🎭 Clicked outside modal');
                document.body.removeChild(modal);
            }
        });

        console.log('🎭 Modal setup complete');
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

    // ====================================================================
    // ENHANCED AI SCRIPT INTEGRATION WITH APPEND OPTION
    // ====================================================================

    async setStepsFromAI(aiSteps) {
        console.log('🤖 setStepsFromAI called with', aiSteps.length, 'steps');
        
        if (this.runningStates.get(this.currentTabId)?.isRunning) {
            this.showAlert('Không thể tải khi đang chạy kịch bản.', 'warning');
            return;
        }

        // 🔥 NEW: Enhanced logic with append option
        if (this.steps.length > 0) {
            // Show custom dialog with multiple options
            const choice = await this.showAIScriptChoiceModal(aiSteps.length);
            
            switch (choice) {
                case 'replace':
                    console.log('🤖 User chose: Replace');
                    this.steps = [...aiSteps];
                    this.updateStepsDisplay();
                    this.showAlert(`✅ Đã thay thế bằng ${aiSteps.length} bước từ AI!`, 'success');
                    break;
                    
                case 'append':
                    console.log('🤖 User chose: Append');
                    const originalCount = this.steps.length;
                    this.steps.push(...aiSteps);
                    this.updateStepsDisplay();
                    this.showAlert(`✅ Đã thêm ${aiSteps.length} bước từ AI vào cuối! Tổng: ${this.steps.length} bước.`, 'success');
                    break;
                    
                case 'cancel':
                    console.log('🤖 User chose: Cancel');
                    this.showAlert('❌ Đã hủy việc sử dụng script AI.', 'info');
                    return;
            }
        } else {
            // No existing steps, just add directly
            console.log('🤖 No existing steps, adding AI steps directly');
            this.steps = [...aiSteps];
            this.updateStepsDisplay();
            this.showAlert(`✅ Đã tải ${aiSteps.length} bước từ AI thành công!`, 'success');
        }
    }

    // 🔥 NEW: Enhanced choice modal for AI script usage
    showAIScriptChoiceModal(aiStepsCount) {
        return new Promise((resolve) => {
            console.log('🤖 Showing AI script choice modal');
            
            // Remove existing modal if any
            const existingModal = document.getElementById('aiScriptChoiceModal');
            if (existingModal) {
                existingModal.remove();
            }

            const modal = document.createElement('div');
            modal.id = 'aiScriptChoiceModal';
            modal.className = 'modal';
            modal.style.display = 'block';

            modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>🤖 Sử dụng Script từ AI</h3>
                        <button class="close" data-action="cancel">&times;</button>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <p style="font-size: 13px; color: #333; line-height: 1.5; margin-bottom: 16px;">
                            🎯 Bạn đã có <strong>${this.steps.length} bước</strong> trong script hiện tại.<br>
                            🤖 AI vừa tạo <strong>${aiStepsCount} bước</strong> mới.
                        </p>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 16px;">
                            <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">Bạn muốn:</div>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <button id="replaceChoice" class="choice-btn" style="padding: 12px; text-align: left; background: #fef2f2; border: 2px solid #fecaca; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
                                    <div style="font-weight: 600; color: #dc2626; margin-bottom: 4px;">🔄 Thay thế hoàn toàn</div>
                                    <div style="font-size: 11px; color: #991b1b;">Xóa ${this.steps.length} bước cũ, chỉ giữ ${aiStepsCount} bước từ AI</div>
                                </button>
                                <button id="appendChoice" class="choice-btn" style="padding: 12px; text-align: left; background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
                                    <div style="font-weight: 600; color: #16a34a; margin-bottom: 4px;">➕ Thêm vào cuối</div>
                                    <div style="font-size: 11px; color: #15803d;">Giữ ${this.steps.length} bước cũ, thêm ${aiStepsCount} bước từ AI → Tổng: ${this.steps.length + aiStepsCount} bước</div>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button id="cancelChoice" class="btn btn-secondary" data-action="cancel">❌ Hủy</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Add hover effects
            const choiceBtns = modal.querySelectorAll('.choice-btn');
            choiceBtns.forEach(btn => {
                btn.addEventListener('mouseenter', () => {
                    btn.style.transform = 'translateY(-2px)';
                    btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                });
                btn.addEventListener('mouseleave', () => {
                    btn.style.transform = 'translateY(0)';
                    btn.style.boxShadow = 'none';
                });
            });

            // Event handlers
            modal.querySelector('#replaceChoice').addEventListener('click', () => {
                console.log('🤖 Replace choice clicked');
                document.body.removeChild(modal);
                resolve('replace');
            });

            modal.querySelector('#appendChoice').addEventListener('click', () => {
                console.log('🤖 Append choice clicked');
                document.body.removeChild(modal);
                resolve('append');
            });

            modal.querySelector('#cancelChoice').addEventListener('click', () => {
                console.log('🤖 Cancel choice clicked');
                document.body.removeChild(modal);
                resolve('cancel');
            });

            modal.querySelector('.close').addEventListener('click', () => {
                console.log('🤖 Close button clicked');
                document.body.removeChild(modal);
                resolve('cancel');
            });

            // Click outside to cancel
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    console.log('🤖 Clicked outside modal');
                    document.body.removeChild(modal);
                    resolve('cancel');
                }
            });

            console.log('🤖 Choice modal setup complete');
        });
    }
}

// Initialize script builder when page loads
let enhancedScriptBuilder;
document.addEventListener('DOMContentLoaded', () => {
    enhancedScriptBuilder = new EnhancedScriptBuilder();
    
    // Make script builder globally available
    window.enhancedScriptBuilder = enhancedScriptBuilder;
    
    console.log('🎭 Enhanced Script Builder loaded with fixed Playwright export!');
});