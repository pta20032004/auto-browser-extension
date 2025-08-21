class AIHelper {
    constructor() {
        this.apiKey = '';
        this.initializeEventListeners();
        this.loadApiKey();
        this.lastRawResponse = '';
        this.lastDOMContent = '';
        this.originalDOMLength = 0;
        this.truncatedDOMLength = 0;
        this.enableTruncation = false;
        this.maxDomSize = 100000;
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

        // Save AI script button
        document.getElementById('saveAIScriptBtn')?.addEventListener('click', () => {
            this.saveAIScript();
        });

        // DOM Debug Controls
        document.getElementById('toggleDOMResponse')?.addEventListener('click', () => {
            this.toggleDOMResponseDisplay();
        });

        document.getElementById('copyDOMResponse')?.addEventListener('click', () => {
            this.copyDOMResponseToClipboard();
        });

        document.getElementById('clearDOMResponse')?.addEventListener('click', () => {
            this.clearDOMResponseDisplay();
        });

        // AI Response Debug Controls
        document.getElementById('toggleAIResponse')?.addEventListener('click', () => {
            this.toggleAIResponseDisplay();
        });

        document.getElementById('copyAIResponse')?.addEventListener('click', () => {
            this.copyAIResponseToClipboard();
        });

        document.getElementById('clearAIResponse')?.addEventListener('click', () => {
            this.clearAIResponseDisplay();
        });

        // Truncation controls
        document.getElementById('enableTruncation')?.addEventListener('change', (e) => {
            this.enableDOMTruncation(e.target.checked);
        });

        document.getElementById('maxDomSize')?.addEventListener('change', (e) => {
            this.setMaxDOMSize(parseInt(e.target.value) || 100000);
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

    smartTruncateHTML(html, maxLength = 100000) {
        if (html.length <= maxLength) return html;
        
        console.warn(`DOM truncation: ${html.length} → ${maxLength} chars`);
        
        const importantPatterns = [
            // Form inputs
            /<input[^>]*(?:search|tìm|kiếm|query|q|email|password|username)[^>]*>/gi,
            /<button[^>]*(?:search|tìm|submit|gửi|login|đăng|register)[^>]*>.*?<\/button>/gi,
            /<form[^>]*>.*?<\/form>/gi,
            
            // Navigation and structure
            /<nav[^>]*>.*?<\/nav>/gi,
            /<header[^>]*>.*?<\/header>/gi,
            /<a[^>]*href[^>]*>.*?<\/a>/gi,
            
            // Social media interaction buttons
            /<[^>]*aria-label[^>]*(?:comment|like|share|react|follow|message)[^>]*>.*?<\/[^>]*>/gi,
            /<[^>]*aria-label[^>]*(?:bình luận|thích|chia sẻ|phản ứng|theo dõi|nhắn tin)[^>]*>.*?<\/[^>]*>/gi,
            /<[^>]*role="button"[^>]*>.*?(?:comment|like|share|react|post|send|follow)[^>]*<\/[^>]*>/gi,
            /<[^>]*role="button"[^>]*>.*?(?:bình luận|thích|chia sẻ|phản ứng|đăng|gửi|theo dõi)[^>]*<\/[^>]*>/gi,
            /<div[^>]*role="button"[^>]*>.*?<\/div>/gi,
            /<button[^>]*>.*?(?:comment|like|share|post|send|follow|message)[^>]*<\/button>/gi,
            /<button[^>]*>.*?(?:bình luận|thích|chia sẻ|đăng|gửi|theo dõi|nhắn tin)[^>]*<\/button>/gi,
            
            // Data attributes and test elements
            /<\w+[^>]*(?:data-testid|data-cy|data-test|aria-label|role)[^>]*>.*?<\/\w+>/gi,
            /<select[^>]*>.*?<\/select>/gi,
            /<textarea[^>]*>.*?<\/textarea>/gi,
            
            // Interactive elements by text content
            /<[^>]*>.*?(?:comment|bình luận|like|thích|share|chia sẻ|post|đăng|send|gửi|follow|theo dõi|message|nhắn tin|react|phản ứng).*?<\/[^>]*>/gi,
            
            // Facebook-specific patterns
            /<div[^>]*data-[^>]*>.*?(?:comment|like|share).*?<\/div>/gi,
            /<span[^>]*>.*?(?:Comment|Like|Share|Bình luận|Thích|Chia sẻ).*?<\/span>/gi
        ];
        
        let protectedElements = [];
        let protectedHtml = html;
        
        // Extract and protect important elements
        importantPatterns.forEach((pattern, index) => {
            const matches = html.match(pattern);
            if (matches) {
                matches.forEach((match, matchIndex) => {
                    const placeholder = `__PROTECTED_${index}_${matchIndex}__`;
                    protectedElements.push({ placeholder, content: match });
                    protectedHtml = protectedHtml.replace(match, placeholder);
                });
            }
        });
        
        console.log(`Protected ${protectedElements.length} important elements`);
        
        let cutPos = maxLength;
        
        while (cutPos > maxLength * 0.7 && protectedHtml[cutPos] !== '>') {
            cutPos--;
        }
        
        if (cutPos <= maxLength * 0.7) {
            cutPos = protectedHtml.lastIndexOf(' ', maxLength);
            if (cutPos < maxLength * 0.5) {
                cutPos = maxLength;
            }
        }
        
        let truncatedHtml = protectedHtml.substring(0, cutPos + 1);
        
        // Restore protected elements
        protectedElements.forEach(({ placeholder, content }) => {
            truncatedHtml = truncatedHtml.replace(placeholder, content);
        });
        
        console.log(`Truncation complete: ${html.length} → ${truncatedHtml.length} chars`);
        return truncatedHtml + '\n<!-- [Truncated for AI context] -->';
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
            generateBtn.textContent = 'Đang phân tích DOM...';
            generateBtn.disabled = true;
        }

        try {
            // Get current page DOM
            const dom = await this.getCurrentPageDOM();
            const currentUrl = await this.getCurrentPageUrl();
            
            // Store original DOM and display it
            this.originalDOMLength = dom.length;
            this.lastDOMContent = dom;
            this.displayDOMContent(dom);
            
            if (generateBtn) {
                generateBtn.textContent = 'Đang tạo script...';
            }
            
            let processedDOM = dom;
            
            if (this.enableTruncation && dom.length > this.maxDomSize) {
                console.warn(`DOM size ${dom.length} exceeds limit ${this.maxDomSize}, truncating...`);
                processedDOM = this.smartTruncateHTML(dom, this.maxDomSize);
                this.truncatedDOMLength = processedDOM.length;
            } else {
                console.log(`Sending full DOM (${dom.length} chars) to AI - No truncation!`);
                this.truncatedDOMLength = dom.length;
            }
            
            this.updateDOMTruncationInfo();
            
            // Generate script using AI
            const aiResponse = await this.callGoogleAI(description, processedDOM, currentUrl);
            
            // Display raw AI response immediately
            this.displayRawAIResponse(aiResponse);
            
            const steps = this.parseAIResponse(aiResponse);
            
            // Display generated script
            this.displayGeneratedScript(steps);
            this.showAlert('Đã tạo script thành công!', 'success');

        } catch (error) {
            console.error('AI script generation failed:', error);
            this.showAlert(`Lỗi tạo script: ${error.message}`, 'error');
            
            // Display error in raw response
            this.displayRawAIResponse(`ERROR: ${error.message}\n\nStack: ${error.stack}`);
        } finally {
            if (generateBtn) {
                generateBtn.textContent = 'Tạo Script';
                generateBtn.disabled = false;
            }
        }
    }

    async getCurrentPageDOM() {
        return new Promise((resolve, reject) => {
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
        
        const prompt = `Bạn là chuyên gia tự động hóa web. Dựa trên mô tả của người dùng và DOM HTML thực tế, hãy tạo một mảng JSON các bước tự động hóa.

MÔ TẢ NGƯỜI DÙNG: "${description}"
URL TRANG HIỆN TẠI: ${currentUrl}

CÁC HÀNH ĐỘNG CÓ SẴN:
${availableActions}

DOM HTML THỰC TẾ:
${dom}

QUY TẮC QUAN TRỌNG:
1. CHỈ sử dụng CSS selectors CÓ THẬT trong DOM HTML ở trên
2. TUYỆT ĐỐI KHÔNG tự bịa hay đoán selector
3. KHÔNG BAO GIỜ sử dụng :contains() - ĐÂY LÀ CÚ PHÁP KHÔNG HỢP LỆ!
4. Ưu tiên sử dụng:
   - ARIA labels: [aria-label*="comment"], [aria-label*="like"]
   - Role attributes: [role="button"]
   - ID thật: #loginButton
   - Name attribute: input[name="username"]
   - Data attributes: [data-testid="comment"]

VÍ DỤ ĐÚNG:
[
  {"action": "clickElement", "selector": "[aria-label*='comment' i]"},
  {"action": "fill", "selector": "textarea[placeholder*='Write']", "text": "Bình luận"},
  {"action": "clickElement", "selector": "button[type='submit']"}
]

VÍ DỤ SAI (KHÔNG BAO GIỜ LÀM):
[
  {"action": "clickElement", "selector": "button:contains('Comment')"},
  {"action": "clickElement", "selector": "[role='button']:contains('Like')"}
]

Hãy tạo script với CSS selectors THẬT dựa trên DOM:`;

        try {
            const selectedModel = document.getElementById('aiModel')?.value || 'gemini-2.5-flash';

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
                        temperature: 0.05,
                        maxOutputTokens: 4096,
                        topP: 0.8,
                        topK: 40
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
            }
            
            const data = await response.json();

            if (data.error) {
                throw new Error(`API Error: ${data.error.message}`);
            }

            if (!data.candidates) {
                if (data.promptFeedback && data.promptFeedback.blockReason) {
                    throw new Error(`Yêu cầu bị chặn. Lý do: ${data.promptFeedback.blockReason}`);
                } else {
                    throw new Error('Phản hồi không hợp lệ: Không tìm thấy "candidates".');
                }
            }

            const generatedText = data.candidates[0].content.parts[0].text;
            return generatedText;

        } catch (error) {
            throw new Error(`Google AI API call failed: ${error.message}`);
        }
    }

    getAvailableActions() {
        return `
CÁC HÀNH ĐỘNG CƠ BẢN:
- click: Click vào tọa độ {"action": "click", "x": 100, "y": 200}
- clickElement: Click vào element {"action": "clickElement", "selector": "CSS_SELECTOR_THẬT"}
- fill: Điền input {"action": "fill", "selector": "CSS_SELECTOR_THẬT", "text": "giá_trị"}
- type: Nhập text {"action": "type", "selector": "CSS_SELECTOR_THẬT", "text": "giá_trị"}
- press: Nhấn phím {"action": "press", "key": "Enter|Tab|Escape|Space"}
- hover: Hover vào element {"action": "hover", "selector": "CSS_SELECTOR_THẬT"}
- goto: Đi tới URL {"action": "goto", "url": "https://example.com"}
- reload: Reload trang {"action": "reload"}
- scroll: Scroll {"action": "scroll", "scrollMode": "percentage", "percentageY": 50}
- selectOption: Chọn option {"action": "selectOption", "selector": "select", "value": "giá_trị"}
- check: Check/uncheck {"action": "check", "selector": "input[type='checkbox']", "checked": true}
- wait: Chờ thời gian {"action": "wait", "duration": 2000}
- waitForElement: Chờ element {"action": "waitForElement", "selector": "CSS_SELECTOR_THẬT"}
- getText: Lấy text {"action": "getText", "selector": "CSS_SELECTOR_THẬT"}
- getAttribute: Lấy attribute {"action": "getAttribute", "selector": "CSS_SELECTOR_THẬT", "attribute": "href"}

VÍ DỤ CSS SELECTORS HỢP LỆ:
- Comment button: [aria-label*="comment" i], [role="button"][aria-label*="comment"]
- Like button: [aria-label*="like" i], button[aria-label*="like"]  
- Share button: [aria-label*="share" i], [role="button"][aria-label*="share"]
- Form inputs: input[name="email"], textarea[placeholder*="Write"]
- Submit buttons: button[type="submit"], [role="button"][aria-label*="submit"]

DATA EXTRACTION CẢI TIẾN:
- getText: Lấy text từ element {"action": "getText", "selector": "CSS_SELECTOR_GENERAL"}
- innerText: Lấy inner text {"action": "innerText", "selector": "CSS_SELECTOR_GENERAL"}  
- textContent: Lấy text content {"action": "textContent", "selector": "CSS_SELECTOR_GENERAL"}
- getAttribute: Lấy attribute {"action": "getAttribute", "selector": "CSS_SELECTOR_GENERAL", "attribute": "href|aria-label|data-*"}

SELECTOR STRATEGY CHO TRÍCH XUẤT:
1. Dùng semantic selectors: [role="article"], [aria-label*="Comment"], [data-testid]
2. TRÁNH user-specific: KHÔNG dùng tên cụ thể trong aria-label
3. TRÁNH generated classes: KHÔNG dùng .x1lliihq, .xjkvuk6, etc.
4. Dùng structural: div[dir="auto"], span:not([aria-label])

VÍ DỤ TRÍCH XUẤT FACEBOOK COMMENTS:
[
  {"action": "getText", "selector": "[role='article'] a[role='link'] strong", "description": "Lấy tên user"},
  {"action": "innerText", "selector": "[role='article'] div[dir='auto']:not([aria-label])", "description": "Lấy nội dung comment"},
  {"action": "getAttribute", "selector": "[role='article'] a[aria-label*='ago']", "attribute": "aria-label", "description": "Lấy thời gian"}
]
KHÔNG BAO GIỜ SỬ DỤNG:
- :contains() - CÚ PHÁP KHÔNG HỢP LỆ!
- __stagehand_id
- Generated classes như .css-xyz123
- Fake IDs không tồn tại
`;
    }

    parseAIResponse(aiResponse) {
        try {
            let cleanResponse = aiResponse.trim();
            cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            
            const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                const objectMatch = cleanResponse.match(/\{[\s\S]*\}/);
                if (objectMatch) {
                    const singleStep = JSON.parse(objectMatch[0]);
                    return [singleStep];
                }
                throw new Error('Không tìm thấy JSON array trong phản hồi AI');
            }

            const steps = JSON.parse(jsonMatch[0]);
            
            if (!Array.isArray(steps)) {
                throw new Error('Phản hồi AI không phải là array');
            }

            return steps.map((step, index) => {
                if (!step.action) {
                    throw new Error(`Bước ${index + 1} thiếu action`);
                }

                const convertedStep = {
                    type: step.action,
                    tabId: null
                };

                if (step.selector) {
                    if (step.selector.includes('__stagehand_id')) {
                        console.warn(`Bước ${index + 1}: AI vẫn dùng fake __stagehand_id!`);
                    }
                    convertedStep.selector = step.selector;
                }
                
                if (step.text) convertedStep.text = step.text;
                if (step.value) convertedStep.value = step.value;
                if (step.url) convertedStep.url = step.url;
                if (step.key) convertedStep.key = step.key;
                if (step.timeout) convertedStep.timeout = step.timeout;
                if (step.duration) convertedStep.duration = step.duration;
                if (step.checked !== undefined) convertedStep.checked = step.checked;
                if (step.attribute) convertedStep.attribute = step.attribute;
                if (step.filePaths) convertedStep.filePaths = step.filePaths;

                if (step.x !== undefined) convertedStep.x = parseInt(step.x);
                if (step.y !== undefined) convertedStep.y = parseInt(step.y);

                if (step.action === 'scroll') {
                    if (step.scrollMode) convertedStep.scrollMode = step.scrollMode;
                    if (step.x !== undefined) convertedStep.x = step.x;
                    if (step.y !== undefined) convertedStep.y = step.y;
                    if (step.percentageX !== undefined) convertedStep.percentageX = step.percentageX;
                    if (step.percentageY !== undefined) convertedStep.percentageY = step.percentageY;
                    if (step.delta !== undefined) convertedStep.delta = step.delta;
                    if (step.smooth !== undefined) convertedStep.smooth = step.smooth;
                }

                if (convertedStep.type === 'click') {
                    if (convertedStep.x === undefined || convertedStep.y === undefined || 
                        isNaN(convertedStep.x) || isNaN(convertedStep.y)) {
                        console.warn(`Warning: Click step ${index + 1} có tọa độ không hợp lệ:`, convertedStep);
                        if (convertedStep.selector) {
                            convertedStep.type = 'clickElement';
                            delete convertedStep.x;
                            delete convertedStep.y;
                        } else {
                            throw new Error(`Bước ${index + 1}: Click cần tọa độ x, y hợp lệ hoặc selector`);
                        }
                    }
                }

                if (convertedStep.selector) {
                    if (convertedStep.selector.includes('__stagehand_id')) {
                        console.warn(`FAKE SELECTOR: Bước ${index + 1} dùng __stagehand_id (không tồn tại)`);
                    }
                    
                    if (convertedStep.selector.match(/\#[a-z0-9]{8,}/i)) {
                        console.warn(`SUSPICIOUS ID: Bước ${index + 1} selector ${convertedStep.selector} có vẻ là generated ID`);
                    }
                    
                    if (convertedStep.selector.includes('.css-') || convertedStep.selector.includes('.makeStyles-')) {
                        console.warn(`GENERATED CLASS: Bước ${index + 1} selector ${convertedStep.selector} dùng generated class`);
                    }
                }

                return convertedStep;
            });

        } catch (error) {
            console.error('Lỗi phân tích phản hồi AI:', error);
            console.error('Raw AI response:', aiResponse);
            throw new Error(`Không thể phân tích phản hồi AI: ${error.message}`);
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
                transition: all 0.2s ease;
            `;

            stepElement.addEventListener('mouseenter', () => {
                stepElement.style.borderColor = '#10b981';
                stepElement.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.1)';
            });
            stepElement.addEventListener('mouseleave', () => {
                stepElement.style.borderColor = '#e2e8f0';
                stepElement.style.boxShadow = 'none';
            });

            const stepHeader = document.createElement('div');
            stepHeader.style.cssText = `
                font-size: 12px;
                font-weight: 600;
                color: #1e293b;
                margin-bottom: 4px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            `;
            
            const stepTitle = document.createElement('span');
            stepTitle.textContent = `${index + 1}. ${this.getStepTypeLabel(step.type)}`;
            
            const validationIcon = document.createElement('span');
            if (step.type === 'click' && (step.x !== undefined && step.y !== undefined)) {
                validationIcon.textContent = 'COORD';
                validationIcon.title = 'Click tọa độ';
                validationIcon.style.color = '#f59e0b';
            } else if (step.selector) {
                if (step.selector.includes('__stagehand_id')) {
                    validationIcon.textContent = 'FAKE';
                    validationIcon.title = 'FAKE ID - Selector không tồn tại!';
                    validationIcon.style.color = '#ef4444';
                } else if (step.selector.includes('#') || step.selector.includes('[name=') || step.selector.includes('[data-') || step.selector.includes('[aria-label')) {
                    validationIcon.textContent = 'GOOD';
                    validationIcon.title = 'Selector semantic tốt';
                    validationIcon.style.color = '#10b981';
                } else if (step.selector.includes('.css-') || step.selector.includes('.makeStyles-')) {
                    validationIcon.textContent = 'WARN';
                    validationIcon.title = 'Generated class - có thể không ổn định';
                    validationIcon.style.color = '#f59e0b';
                } else {
                    validationIcon.textContent = 'OK';
                    validationIcon.title = 'Selector OK';
                    validationIcon.style.color = '#6366f1';
                }
            } else {
                validationIcon.textContent = 'OK';
                validationIcon.title = 'Không cần selector';
                validationIcon.style.color = '#10b981';
            }
            
            stepHeader.appendChild(stepTitle);
            stepHeader.appendChild(validationIcon);

            const stepDetails = document.createElement('div');
            stepDetails.style.cssText = `
                font-size: 11px;
                color: #64748b;
                line-height: 1.4;
            `;
            stepDetails.textContent = this.getStepDescription(step);

            stepElement.appendChild(stepHeader);
            stepElement.appendChild(stepDetails);
            container.appendChild(stepElement);
        });

        this.generatedSteps = steps;
        
        const summary = document.createElement('div');
        summary.style.cssText = `
            margin-top: 12px;
            padding: 12px;
            background: #f0fdf4;
            border: 1px solid #dcfce7;
            border-radius: 6px;
            font-size: 11px;
            color: #166534;
        `;
        
        const fakeSelectors = steps.filter(s => s.selector && s.selector.includes('__stagehand_id')).length;
        const realSelectors = steps.filter(s => s.selector && !s.selector.includes('__stagehand_id')).length;
        const coordinateClicks = steps.filter(s => s.type === 'click' && s.x !== undefined).length;
        
        summary.innerHTML = `
            <strong>Phân tích Script AI:</strong><br>
            • Tổng cộng: ${steps.length} bước<br>
            • Selector thật: ${realSelectors} bước<br>
            • Fake selector (__stagehand_id): ${fakeSelectors} bước<br>
            • Click tọa độ: ${coordinateClicks} bước<br>
            ${fakeSelectors > 0 ? '<br><strong style="color: #dc2626;">Có fake selector! Cần sửa lại!</strong>' : '<br><strong style="color: #059669;">Tất cả selector đều thật!</strong>'}
        `;
        container.appendChild(summary);
    }

    displayDOMContent(domContent) {
        this.lastDOMContent = domContent;
        const textarea = document.getElementById('aiDOMText');
        const lengthSpan = document.getElementById('domLength');
        
        if (textarea) {
            textarea.value = domContent;
        }
        
        if (lengthSpan) {
            lengthSpan.textContent = domContent.length.toLocaleString();
        }

        this.updateDOMTruncationInfo();

        const container = document.getElementById('aiDOMResponse');
        const button = document.getElementById('toggleDOMResponse');
        if (container && container.style.display === 'none') {
            container.style.display = 'block';
            if (button) button.textContent = 'Hide';
        }
    }

    updateDOMTruncationInfo() {
        const truncatedSpan = document.getElementById('domTruncated');
        const domStatus = document.getElementById('domStatus');
        const domInfoBox = document.getElementById('domInfoBox');
        const domInfoContent = document.getElementById('domInfoContent');
        
        if (truncatedSpan) {
            if (!this.enableTruncation) {
                truncatedSpan.textContent = 'Disabled';
                truncatedSpan.style.color = '#10b981';
                truncatedSpan.title = 'Truncation is disabled - full DOM sent to AI';
            } else {
                const wasTruncated = this.truncatedDOMLength < this.originalDOMLength;
                truncatedSpan.textContent = wasTruncated ? 'Yes' : 'No';
                truncatedSpan.style.color = wasTruncated ? '#dc2626' : '#16a34a';
                truncatedSpan.title = wasTruncated ? 
                    `DOM was truncated from ${this.originalDOMLength} to ${this.truncatedDOMLength} chars` :
                    'Full DOM sent to AI without truncation';
            }
        }

        if (domStatus) {
            if (!this.enableTruncation) {
                domStatus.textContent = 'Full DOM';
                domStatus.className = 'status-full-dom';
            } else if (this.truncatedDOMLength < this.originalDOMLength) {
                domStatus.textContent = 'Truncated';
                domStatus.className = 'status-truncated';
            } else {
                domStatus.textContent = 'Not Truncated';
                domStatus.className = 'status-full-dom';
            }
        }

        if (domInfoBox && domInfoContent) {
            if (!this.enableTruncation) {
                domInfoBox.className = 'truncation-disabled';
                domInfoContent.innerHTML = `
                    • DOM được gửi đầy đủ cho AI (KHUYẾN NGHỊ)<br>
                    • Tất cả elements được bảo toàn<br>
                    • Comment/Like/Share buttons luôn có trong DOM<br>
                    • AI sẽ thấy toàn bộ structure của trang
                `;
            } else {
                domInfoBox.className = 'truncation-enabled';
                domInfoContent.innerHTML = `
                    • DOM sẽ bị cắt nếu vượt quá ${this.maxDomSize} chars<br>
                    • Important elements được bảo vệ<br>
                    • Có thể mất một số interactive elements<br>
                    • Khuyến nghị: TẮT truncation để AI hoạt động tốt hơn
                `;
            }
        }
    }

    toggleDOMResponseDisplay() {
        const container = document.getElementById('aiDOMResponse');
        const button = document.getElementById('toggleDOMResponse');
        
        if (container && button) {
            if (container.style.display === 'none') {
                container.style.display = 'block';
                button.textContent = 'Hide';
            } else {
                container.style.display = 'none';
                button.textContent = 'Show';
            }
        }
    }

    copyDOMResponseToClipboard() {
        const textarea = document.getElementById('aiDOMText');
        if (textarea && textarea.value) {
            const tempInput = document.createElement('textarea');
            tempInput.value = textarea.value;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            
            this.showAlert('Đã copy DOM content vào clipboard!', 'success');
        } else {
            this.showAlert('Không có DOM content để copy!', 'warning');
        }
    }

    clearDOMResponseDisplay() {
        const textarea = document.getElementById('aiDOMText');
        const lengthSpan = document.getElementById('domLength');
        const truncatedSpan = document.getElementById('domTruncated');
        
        if (textarea) {
            textarea.value = '';
        }
        if (lengthSpan) {
            lengthSpan.textContent = '0';
        }
        if (truncatedSpan) {
            truncatedSpan.textContent = 'No';
        }
        
        this.lastDOMContent = '';
        this.originalDOMLength = 0;
        this.truncatedDOMLength = 0;
        
        this.showAlert('Đã xóa DOM content!', 'info');
    }

    displayRawAIResponse(rawResponse) {
        this.lastRawResponse = rawResponse;
        const textarea = document.getElementById('aiResponseText');
        if (textarea) {
            try {
                const jsonMatch = rawResponse.match(/\[[\s\S]*\]/) || rawResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    const formatted = JSON.stringify(parsed, null, 2);
                    textarea.value = `=== RAW AI RESPONSE ===\n${rawResponse}\n\n=== EXTRACTED JSON ===\n${formatted}`;
                } else {
                    textarea.value = `=== RAW AI RESPONSE ===\n${rawResponse}\n\n=== NOTE ===\nKhông tìm thấy JSON hợp lệ trong response`;
                }
            } catch (e) {
                textarea.value = `=== RAW AI RESPONSE ===\n${rawResponse}\n\n=== PARSE ERROR ===\n${e.message}`;
            }
        }

        const container = document.getElementById('aiRawResponse');
        const button = document.getElementById('toggleAIResponse');
        if (container && container.style.display === 'none') {
            container.style.display = 'block';
            if (button) button.textContent = 'Hide';
        }
    }

    toggleAIResponseDisplay() {
        const container = document.getElementById('aiRawResponse');
        const button = document.getElementById('toggleAIResponse');
        
        if (container && button) {
            if (container.style.display === 'none') {
                container.style.display = 'block';
                button.textContent = 'Hide';
            } else {
                container.style.display = 'none';
                button.textContent = 'Show';
            }
        }
    }

    copyAIResponseToClipboard() {
        const textarea = document.getElementById('aiResponseText');
        if (textarea && textarea.value) {
            const tempInput = document.createElement('textarea');
            tempInput.value = textarea.value;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            
            this.showAlert('Đã copy AI response vào clipboard!', 'success');
        } else {
            this.showAlert('Không có AI response để copy!', 'warning');
        }
    }

    clearAIResponseDisplay() {
        const textarea = document.getElementById('aiResponseText');
        if (textarea) {
            textarea.value = '';
            this.lastRawResponse = '';
        }
        this.showAlert('Đã xóa AI response!', 'info');
    }

    getStepTypeLabel(type) {
        const labels = {
            click: 'Click (tọa độ)',
            clickElement: 'Click Element', 
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
            inputValue: 'Lấy Input Value'
        };
        return labels[type] || type;
    }

    getStepDescription(step) {
        switch (step.type) {
            case 'click':
                return `Tọa độ: (${step.x}, ${step.y})`;
            case 'clickElement':
                return `Click: ${step.selector}`;
            case 'fill':
            case 'type':
                return `${step.selector} ← "${step.text}"`;
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
                    return `Scroll tới (${step.x || 0}, ${step.y || 0})`;
                }
            case 'selectOption':
                return `${step.selector} → ${step.value}`;
            case 'check':
                return `${step.selector} → ${step.checked ? 'Check' : 'Uncheck'}`;
            case 'wait':
                return `Chờ ${step.duration}ms`;
            case 'waitForElement':
                return `Chờ: ${step.selector}`;
            case 'setInputFiles':
                return `Upload: ${step.filePaths ? step.filePaths.length : 0} file(s)`;
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

        if (window.enhancedScriptBuilder) {
            const scriptsTab = document.querySelector('[data-page="scripts"]');
            if (scriptsTab) {
                scriptsTab.click();
            }

            window.enhancedScriptBuilder.setStepsFromAI(this.generatedSteps);
            this.showAlert('Đã chuyển script sang Script Builder!', 'success');
        } else {
            this.showAlert('Script Builder chưa sẵn sàng.', 'error');
        }
    }

    enableDOMTruncation(enable = true) {
        this.enableTruncation = enable;
        console.log(`DOM Truncation: ${enable ? 'ENABLED' : 'DISABLED'}`);
        this.updateDOMTruncationInfo();
        
        chrome.storage.local.set({ enableTruncation: enable });
    }

    setMaxDOMSize(size) {
        this.maxDomSize = size;
        console.log(`Max DOM Size set to: ${size} chars`);
        
        chrome.storage.local.set({ maxDomSize: size });
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get([
                'enableTruncation', 
                'maxDomSize'
            ]);
            
            if (result.enableTruncation !== undefined) {
                this.enableTruncation = result.enableTruncation;
            }
            
            if (result.maxDomSize) {
                this.maxDomSize = result.maxDomSize;
            }
            
            const enableTruncationInput = document.getElementById('enableTruncation');
            const maxDomSizeInput = document.getElementById('maxDomSize');
            
            if (enableTruncationInput) enableTruncationInput.checked = this.enableTruncation;
            if (maxDomSizeInput) maxDomSizeInput.value = this.maxDomSize;
            
            console.log(`Settings loaded: Truncation=${this.enableTruncation}, MaxSize=${this.maxDomSize}`);
            
        } catch (error) {
            console.error('Failed to load settings:', error);
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

let aiHelper;
document.addEventListener('DOMContentLoaded', () => {
    aiHelper = new AIHelper();
    aiHelper.loadSettings();
    window.AIHelper = aiHelper;
    
    console.log('AI Helper loaded - SIMPLE PROMPT FIX');
});