// Enhanced Script Builder for Auto Clicker Extension - Tab Independent
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
            reload: []
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
            reload: 'Reload trang'
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
                return `Vị trí: (${step.x || 0}, ${step.y}), Smooth: ${step.smooth ? 'Có' : 'Không'}`;
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
            default:
                return JSON.stringify(step, null, 2);
        }
    }

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