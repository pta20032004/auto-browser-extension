class AIHelper {
    constructor() {
        this.apiKey = '';
        this.initializeEventListeners();
        this.loadApiKey();
    }

    initializeEventListeners() {
        // API Key input
        document.getElementById('aiApiKey')?.addEventListener('change', (e) => {
            this.saveApiKey(e.target.value);
        });

        // Generate script button
        document.getElementById('generateAIScriptBtn')?.addEventListener('click', () => {
            this.generateScriptFromDescription();
        });

        // Clear AI script button
        document.getElementById('clearAIScriptBtn')?.addEventListener('click', () => {
            this.clearAIScript();
        });

        // Use AI script button
        document.getElementById('useAIScriptBtn')?.addEventListener('click', () => {
            this.useGeneratedScript();
        });

        // Save AI script button - NEW
        document.getElementById('saveAIScriptBtn')?.addEventListener('click', () => {
            this.saveAIScript();
        });
    }

    async loadApiKey() {
        try {
            const result = await chrome.storage.local.get(['aiApiKey']);
            if (result.aiApiKey) {
                this.apiKey = result.aiApiKey;
                const input = document.getElementById('aiApiKey');
                if (input) input.value = this.apiKey;
            }
        } catch (error) {
            console.error('Failed to load API key:', error);
        }
    }

    async saveApiKey(apiKey) {
        this.apiKey = apiKey;
        try {
            await chrome.storage.local.set({ aiApiKey: apiKey });
            this.showAlert('API Key đã được lưu!', 'success');
        } catch (error) {
            console.error('Failed to save API key:', error);
            this.showAlert('Không thể lưu API Key', 'error');
        }
    }

    // NEW: Save AI generated script to IndexedDB
    async saveAIScript() {
        if (!this.generatedSteps || this.generatedSteps.length === 0) {
            this.showAlert('Không có script nào để lưu.', 'warning');
            return;
        }

        const scriptName = prompt('Nhập tên script AI:', `AI_Script_${Date.now()}`);
        if (!scriptName) return;

        try {
            const fullName = `[AI] ${scriptName}`;
            await window.dbHelper.saveScript(fullName, this.generatedSteps);
            this.showAlert(`Đã lưu script "${fullName}" thành công!`, 'success');
        } catch (error) {
            console.error('Failed to save AI script:', error);
            this.showAlert('Không thể lưu script AI: ' + error.message, 'error');
        }
    }

    // NEW: Smart HTML truncation to avoid breaking tags
    smartTruncateHTML(html, maxLength = 8000) {
        if (html.length <= maxLength) return html;
        
        // Find safe cut position (after closing tag)
        let cutPos = maxLength;
        while (cutPos > 0 && html[cutPos] !== '>') {
            cutPos--;
        }
        
        // If no closing tag found nearby, cut at nearest space
        if (cutPos < maxLength * 0.8) {
            cutPos = html.lastIndexOf(' ', maxLength);
        }
        
        return html.substring(0, cutPos + 1) + '\n<!-- [HTML truncated for AI processing] -->';
    }

    async generateScriptFromDescription() {
        const description = document.getElementById('aiDescription')?.value?.trim();
        if (!description) {
            this.showAlert('Vui lòng nhập mô tả hành động', 'warning');
            return;
        }

        if (!this.apiKey) {
            this.showAlert('Vui lòng nhập Google AI Studio API Key', 'warning');
            return;
        }

        const generateBtn = document.getElementById('generateAIScriptBtn');
        if (generateBtn) {
            generateBtn.textContent = 'Đang xử lý...';
            generateBtn.disabled = true;
        }

        try {
            // Get current page DOM
            const dom = await this.getCurrentPageDOM();
            const currentUrl = await this.getCurrentPageUrl();
            
            // Generate script using AI
            const aiResponse = await this.callGoogleAI(description, dom, currentUrl);
            const steps = this.parseAIResponse(aiResponse);
            
            // Display generated script
            this.displayGeneratedScript(steps);
            this.showAlert('Đã tạo script thành công!', 'success');

        } catch (error) {
            console.error('AI script generation failed:', error);
            this.showAlert('Lỗi tạo script: ' + error.message, 'error');
        } finally {
            if (generateBtn) {
                generateBtn.textContent = '🤖 Tạo Script';
                generateBtn.disabled = false;
            }
        }
    }

    async getCurrentPageDOM() {
        return new Promise((resolve, reject) => {
            // Send message to content script to get serialized DOM
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'getSerializedDOM'
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else if (response?.success) {
                            resolve(response.dom);
                        } else {
                            reject(new Error(response?.error || 'Failed to get DOM'));
                        }
                    });
                } else {
                    reject(new Error('No active tab found'));
                }
            });
        });
    }

    async getCurrentPageUrl() {
        return new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    resolve(tabs[0].url);
                } else {
                    reject(new Error('No active tab found'));
                }
            });
        });
    }

    async callGoogleAI(description, dom, currentUrl) {
        const availableActions = this.getAvailableActions();
        
        // Use smart truncation instead of simple substring
        const truncatedDOM = this.smartTruncateHTML(dom, 8000);
        
        const prompt = `You are a web automation expert. Based on the user description and the provided HTML DOM, generate a JSON array of automation steps.

USER DESCRIPTION: "${description}"
CURRENT PAGE URL: ${currentUrl}

AVAILABLE ACTIONS:
${availableActions}

HTML DOM (with interactive elements marked with __stagehand_id):
${truncatedDOM}

IMPORTANT RULES:
1. Return ONLY a valid JSON array, no other text
2. Use exact action names from the available actions list
3. For target selectors, use CSS selectors or __stagehand_id attributes when available
4. For scroll actions, use percentage values (0-100) when appropriate
5. Include goto action at the beginning ONLY if navigating to a different URL
6. Be specific with values (email, password, text to type)
7. Use waitForElement before interacting with elements that might load dynamically
8. Prefer __stagehand_id selectors over CSS selectors when available

EXAMPLE OUTPUT FORMAT:
[
  {"action": "fill", "selector": "[__stagehand_id='1']", "text": "user@example.com"},
  {"action": "fill", "selector": "[__stagehand_id='2']", "text": "password123"},
  {"action": "click", "selector": "[__stagehand_id='3']"},
  {"action": "waitForElement", "selector": ".success-message", "timeout": 5000}
]

Generate the automation steps:`;

        try {
            // Get selected model from settings
            const selectedModel = document.getElementById('aiModel')?.value || 'gemini-2.5-flash';

            // Create URL with selected model
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 2048,
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
                throw new Error('Invalid API response structure');
            }

            const generatedText = data.candidates[0].content.parts[0].text;
            return generatedText;

        } catch (error) {
            throw new Error(`Google AI API call failed: ${error.message}`);
        }
    }

    getAvailableActions() {
        return `
BASIC ACTIONS:
- click: Click on element {"action": "click", "selector": "css_selector"}
- fill: Fill input field {"action": "fill", "selector": "css_selector", "text": "value"}
- type: Type text (alternative to fill) {"action": "type", "selector": "css_selector", "text": "value"}
- press: Press keyboard key {"action": "press", "key": "Enter|Tab|Escape|Space"}
- hover: Hover over element {"action": "hover", "selector": "css_selector"}

NAVIGATION:
- goto: Navigate to URL {"action": "goto", "url": "https://example.com"}
- reload: Reload current page {"action": "reload"}

SCROLL ACTIONS:
- scroll: Scroll page {"action": "scroll", "scrollMode": "percentage", "percentageY": 50} (scroll to 50% of page)
- scroll: Scroll absolute {"action": "scroll", "scrollMode": "absolute", "x": 0, "y": 500}
- scroll: Scroll relative {"action": "scroll", "scrollMode": "relative", "x": 0, "y": 200}
- scroll: Scroll delta {"action": "scroll", "scrollMode": "delta", "delta": 300}

FORM INTERACTIONS:
- selectOption: Select dropdown option {"action": "selectOption", "selector": "select", "value": "option_value"}
- check: Check/uncheck checkbox {"action": "check", "selector": "input[type='checkbox']", "checked": true}

FILE UPLOAD:
- setInputFiles: Upload files {"action": "setInputFiles", "selector": "input[type='file']", "filePaths": ["file1.txt"]}

WAIT ACTIONS:
- wait: Wait for time {"action": "wait", "duration": 2000}
- waitForElement: Wait for element {"action": "waitForElement", "selector": "css_selector", "timeout": 10000}

LOOPS:
- for: For loop {"action": "for", "variable": "i", "start": 1, "end": 5, "steps": [...]}
- while: While loop {"action": "while", "condition": {"selector": ".loading", "property": "textContent", "operator": "equals", "value": "Loading..."}, "maxIterations": 10, "steps": [...]}

DATA EXTRACTION:
- getText: Get text content {"action": "getText", "selector": "css_selector"}
- getAttribute: Get attribute {"action": "getAttribute", "selector": "css_selector", "attribute": "href"}
- innerText: Get inner text {"action": "innerText", "selector": "css_selector"}
- textContent: Get text content {"action": "textContent", "selector": "css_selector"}
- inputValue: Get input value {"action": "inputValue", "selector": "input"}
`;
    }

    parseAIResponse(aiResponse) {
        try {
            // Clean up the response - remove markdown code blocks if any
            let cleanResponse = aiResponse.trim();
            cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            
            // Find JSON array in the response
            const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('No JSON array found in AI response');
            }

            const steps = JSON.parse(jsonMatch[0]);
            
            if (!Array.isArray(steps)) {
                throw new Error('AI response is not an array');
            }

            // Validate and convert steps to our format
            return steps.map((step, index) => {
                if (!step.action) {
                    throw new Error(`Step ${index + 1} missing action`);
                }

                // Convert AI format to our internal format
                const convertedStep = {
                    type: step.action,
                    tabId: null // Will be set when used
                };

                // Map common properties
                if (step.selector) convertedStep.selector = step.selector;
                if (step.text) convertedStep.text = step.text;
                if (step.value) convertedStep.value = step.value;
                if (step.url) convertedStep.url = step.url;
                if (step.key) convertedStep.key = step.key;
                if (step.timeout) convertedStep.timeout = step.timeout;
                if (step.duration) convertedStep.duration = step.duration;
                if (step.checked !== undefined) convertedStep.checked = step.checked;
                if (step.attribute) convertedStep.attribute = step.attribute;
                if (step.filePaths) convertedStep.filePaths = step.filePaths;

                // Handle scroll parameters
                if (step.action === 'scroll') {
                    if (step.scrollMode) convertedStep.scrollMode = step.scrollMode;
                    if (step.x !== undefined) convertedStep.x = step.x;
                    if (step.y !== undefined) convertedStep.y = step.y;
                    if (step.percentageX !== undefined) convertedStep.percentageX = step.percentageX;
                    if (step.percentageY !== undefined) convertedStep.percentageY = step.percentageY;
                    if (step.delta !== undefined) convertedStep.delta = step.delta;
                    if (step.smooth !== undefined) convertedStep.smooth = step.smooth;
                }

                // Handle loop parameters
                if (step.action === 'for') {
                    convertedStep.variable = step.variable;
                    convertedStep.start = step.start;
                    convertedStep.end = step.end;
                    convertedStep.steps = step.steps || [];
                }

                if (step.action === 'while') {
                    convertedStep.condition = step.condition;
                    convertedStep.maxIterations = step.maxIterations || 10;
                    convertedStep.steps = step.steps || [];
                }

                return convertedStep;
            });

        } catch (error) {
            throw new Error(`Failed to parse AI response: ${error.message}`);
        }
    }

    displayGeneratedScript(steps) {
        const container = document.getElementById('aiGeneratedScript');
        if (!container) return;

        if (steps.length === 0) {
            container.innerHTML = '<div class="empty-state">Không tạo được script nào.</div>';
            return;
        }

        container.innerHTML = '';

        steps.forEach((step, index) => {
            const stepElement = document.createElement('div');
            stepElement.className = 'ai-script-step';
            stepElement.style.cssText = `
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                margin-bottom: 8px;
                background: white;
                padding: 12px;
            `;

            const stepHeader = document.createElement('div');
            stepHeader.style.cssText = `
                font-size: 12px;
                font-weight: 600;
                color: #1e293b;
                margin-bottom: 4px;
            `;
            stepHeader.textContent = `${index + 1}. ${this.getStepTypeLabel(step.type)}`;

            const stepDetails = document.createElement('div');
            stepDetails.style.cssText = `
                font-size: 11px;
                color: #64748b;
            `;
            stepDetails.textContent = this.getStepDescription(step);

            stepElement.appendChild(stepHeader);
            stepElement.appendChild(stepDetails);
            container.appendChild(stepElement);
        });

        // Store generated steps for later use
        this.generatedSteps = steps;
    }

    getStepTypeLabel(type) {
        const labels = {
            click: 'Click',
            fill: 'Điền Text',
            type: 'Nhập Text',
            press: 'Nhấn Phím',
            hover: 'Hover',
            goto: 'Đi tới URL',
            reload: 'Reload',
            scroll: 'Scroll',
            selectOption: 'Chọn Option',
            check: 'Check/Uncheck',
            setInputFiles: 'Upload Files',
            wait: 'Chờ',
            waitForElement: 'Chờ Element',
            getText: 'Lấy Text',
            getAttribute: 'Lấy Attribute',
            innerText: 'Lấy Inner Text',
            textContent: 'Lấy Text Content',
            inputValue: 'Lấy Input Value',
            for: 'Vòng lặp For',
            while: 'Vòng lặp While'
        };
        return labels[type] || type;
    }

    getStepDescription(step) {
        switch (step.type) {
            case 'click':
                return `Click: ${step.selector}`;
            case 'fill':
            case 'type':
                return `${step.selector} → "${step.text}"`;
            case 'press':
                return `Nhấn phím: ${step.key}`;
            case 'hover':
                return `Hover: ${step.selector}`;
            case 'goto':
                return `URL: ${step.url}`;
            case 'scroll':
                if (step.scrollMode === 'percentage') {
                    return `Scroll ${step.percentageY || 0}%`;
                } else if (step.scrollMode === 'delta') {
                    return `Scroll ${step.delta}px`;
                } else {
                    return `Scroll (${step.x || 0}, ${step.y || 0})`;
                }
            case 'selectOption':
                return `${step.selector} → ${step.value}`;
            case 'check':
                return `${step.selector} → ${step.checked ? 'Check' : 'Uncheck'}`;
            case 'wait':
                return `Chờ ${step.duration}ms`;
            case 'waitForElement':
                return `Chờ: ${step.selector}`;
            case 'for':
                return `For ${step.variable} = ${step.start} to ${step.end} (${step.steps.length} bước)`;
            case 'while':
                const cond = step.condition;
                return `While ${cond.selector}.${cond.property} ${cond.operator} "${cond.value}" (${step.steps.length} bước)`;
            default:
                return JSON.stringify(step, null, 2);
        }
    }

    clearAIScript() {
        const container = document.getElementById('aiGeneratedScript');
        if (container) {
            container.innerHTML = '<div class="empty-state">Chưa có script nào được tạo.</div>';
        }
        
        const description = document.getElementById('aiDescription');
        if (description) {
            description.value = '';
        }

        this.generatedSteps = [];
    }

    useGeneratedScript() {
        if (!this.generatedSteps || this.generatedSteps.length === 0) {
            this.showAlert('Chưa có script nào để sử dụng.', 'warning');
            return;
        }

        // Send generated steps to script builder
        if (window.enhancedScriptBuilder) {
            // Switch to scripts tab
            const scriptsTab = document.querySelector('[data-page="scripts"]');
            if (scriptsTab) {
                scriptsTab.click();
            }

            // Set the steps in script builder
            window.enhancedScriptBuilder.setStepsFromAI(this.generatedSteps);
            this.showAlert('Đã chuyển script sang Script Builder!', 'success');
        } else {
            this.showAlert('Script Builder chưa sẵn sàng.', 'error');
        }
    }

    showAlert(message, type = 'info') {
        if (window.SidebarUtils && window.SidebarUtils.showNotification) {
            window.SidebarUtils.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
}

// Initialize AI Helper when page loads
let aiHelper;
document.addEventListener('DOMContentLoaded', () => {
    aiHelper = new AIHelper();
    
    // Make AI helper globally available
    window.AIHelper = aiHelper;
});