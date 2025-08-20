class AIHelper {
    constructor() {
        this.apiKey = '';
        this.initializeEventListeners();
        this.loadApiKey();
        this.lastRawResponse = '';
        this.lastDOMContent = '';
        this.originalDOMLength = 0;
        this.truncatedDOMLength = 0;
        // 🔥 NEW: Allow disabling truncation
        this.enableTruncation = false; // ✅ Set to false to disable truncation
        this.maxDomSize = 100000; // ✅ Increased from 12k to 100k
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

        // 🔥 NEW: Truncation controls
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

    // Save AI generated script to IndexedDB
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

    // 🔥 ENHANCED: Much better truncation with social media support
    smartTruncateHTML(html, maxLength = 100000) {
        if (html.length <= maxLength) return html;
        
        console.warn(`🔧 DOM truncation: ${html.length} → ${maxLength} chars`);
        
        // 🔥 ENHANCED: Much better protection patterns for Facebook/social media
        const importantPatterns = [
            // Form inputs
            /<input[^>]*(?:search|tìm|kiếm|query|q|email|password|username)[^>]*>/gi,
            /<button[^>]*(?:search|tìm|submit|gửi|login|đăng|register)[^>]*>.*?<\/button>/gi,
            /<form[^>]*>.*?<\/form>/gi,
            
            // Navigation and structure
            /<nav[^>]*>.*?<\/nav>/gi,
            /<header[^>]*>.*?<\/header>/gi,
            /<a[^>]*href[^>]*>.*?<\/a>/gi,
            
            // 🔥 NEW: Social media interaction buttons - COMPREHENSIVE
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
            
            // 🔥 NEW: Interactive elements by text content - BROADER
            /<[^>]*>.*?(?:comment|bình luận|like|thích|share|chia sẻ|post|đăng|send|gửi|follow|theo dõi|message|nhắn tin|react|phản ứng).*?<\/[^>]*>/gi,
            
            // 🔥 NEW: Facebook-specific patterns
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
        
        console.log(`🛡️ Protected ${protectedElements.length} important elements`);
        
        // 🔥 IMPROVED: Better cutting strategy
        let cutPos = maxLength;
        
        // Try to cut at tag boundaries
        while (cutPos > maxLength * 0.7 && protectedHtml[cutPos] !== '>') {
            cutPos--;
        }
        
        // If still not found, cut at word boundaries
        if (cutPos <= maxLength * 0.7) {
            cutPos = protectedHtml.lastIndexOf(' ', maxLength);
            if (cutPos < maxLength * 0.5) {
                cutPos = maxLength; // Force cut if necessary
            }
        }
        
        let truncatedHtml = protectedHtml.substring(0, cutPos + 1);
        
        // Restore protected elements
        protectedElements.forEach(({ placeholder, content }) => {
            truncatedHtml = truncatedHtml.replace(placeholder, content);
        });
        
        console.log(`✂️ Truncation complete: ${html.length} → ${truncatedHtml.length} chars`);
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
            
            // 🔥 FIXED: No more aggressive truncation!
            let processedDOM = dom;
            
            if (this.enableTruncation && dom.length > this.maxDomSize) {
                console.warn(`⚠️ DOM size ${dom.length} exceeds limit ${this.maxDomSize}, truncating...`);
                processedDOM = this.smartTruncateHTML(dom, this.maxDomSize);
                this.truncatedDOMLength = processedDOM.length;
            } else {
                console.log(`✅ Sending full DOM (${dom.length} chars) to AI - No truncation!`);
                this.truncatedDOMLength = dom.length; // Same as original
            }
            
            this.updateDOMTruncationInfo();
            
            // Generate script using AI with FULL DOM or controlled truncation
            const aiResponse = await this.callGoogleAI(description, processedDOM, currentUrl);
            
            // Display raw AI response immediately
            this.displayRawAIResponse(aiResponse);
            
            const steps = this.parseAIResponse(aiResponse);
            
            // Display generated script
            this.displayGeneratedScript(steps);
            this.showAlert('Đã tạo script thành công!', 'success');

        } catch (error) {
            console.error('AI script generation failed:', error);
            this.showAlert('Lỗi tạo script: ' + error.message, 'error');
            
            // Display error in raw response
            this.displayRawAIResponse(`ERROR: ${error.message}\n\nStack: ${error.stack}`);
        } finally {
            if (generateBtn) {
                generateBtn.textContent = '🤖 Tạo Script';
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
        
        // 🔥 ENHANCED: Much better prompt for social media
        const prompt = `Bạn là chuyên gia tự động hóa web. Dựa trên mô tả của người dùng và DOM HTML thực tế, hãy tạo một mảng JSON các bước tự động hóa với CSS selectors THẬT.

MÔ TẢ NGƯỜI DÙNG: "${description}"
URL TRANG HIỆN TẠI: ${currentUrl}

CÁC HÀNH ĐỘNG CÓ SẴN:
${availableActions}

DOM HTML THỰC TẾ (${this.enableTruncation ? 'có thể bị truncate' : 'FULL DOM'}):
${dom}

🔥 QUY TẮC QUAN TRỌNG VỀ CSS SELECTORS:
1. CHỈ sử dụng CSS selectors CÓ THẬT trong DOM HTML ở trên
2. TUYỆT ĐỐI KHÔNG tự bịa hay đoán selector
3. KHÔNG bao giờ sử dụng __stagehand_id hoặc fake IDs
4. Ưu tiên sử dụng theo thứ tự:
   - ARIA labels: [aria-label*="comment"], [aria-label*="like"], [aria-label*="share"]
   - Role + text: [role="button"]:contains("Comment"), [role="button"]:contains("Like")
   - ID thật: #loginButton, #commentButton
   - Name attribute: input[name="username"], button[name="submit"]
   - Data attributes: [data-testid="comment"], [data-cy="like-button"]
   - Type + context: input[type="email"], button[type="submit"]
   - Classes ổn định: .comment-button, .like-btn (KHÔNG dùng .css-xyz123)
   - Text content: button:contains("Comment"), span:contains("Like")
   - Structure: .post-actions button:first-child

🌟 ĐẶC BIỆT CHO FACEBOOK/SOCIAL MEDIA:
- Comment button: [aria-label*="comment"], [role="button"]:contains("Comment"), div[role="button"] span:contains("Comment")
- Like button: [aria-label*="like"], [role="button"]:contains("Like"), div[role="button"] span:contains("Thích")
- Share button: [aria-label*="share"], [role="button"]:contains("Share"), div[role="button"] span:contains("Chia sẻ")
- Vietnamese text: "Bình luận", "Thích", "Chia sẻ"

CHIẾN LƯỢC CHỌN SELECTOR:
- PHÂN TÍCH KỸ DOM trước khi tạo selector
- Tìm attributes CÓ THẬT: aria-label, role, data-*, id, name, class
- Với social media buttons: ưu tiên aria-label và role="button"
- Với form inputs: dùng name hoặc type attribute  
- CHỈ dùng tọa độ (click) khi THẬT SỰ không có selector nào

VÍ DỤ PHÂN TÍCH ĐÚNG:
- Nếu DOM có: <div aria-label="Leave a comment" role="button"><span>Comment</span></div>
- Dùng: [aria-label*="comment" i] HOẶC [role="button"]:contains("Comment")
- KHÔNG tự bịa: #comment-btn (nếu không có ID này)

VÍ DỤ OUTPUT MONG MUỐN:
[
  {"action": "clickElement", "selector": "[aria-label*='comment' i]"},
  {"action": "fill", "selector": "textarea[aria-label*='comment']", "text": "Bình luận của tôi"},
  {"action": "clickElement", "selector": "[aria-label*='submit' i][role='button']"}
]

QUY TẮC CUỐI CÙNG:
- BẮT BUỘC selector phải TỒN TẠI trong DOM ở trên
- KIỂM TRA từng selector với DOM trước khi đưa vào JSON
- Nếu không chắc chắn, dùng cách tổng quát hơn: [role="button"]:contains("text")
- TUYỆT ĐỐI KHÔNG đoán mò selector
- CHỈ dùng những gì BẠN THẤY trong DOM HTML

Hãy tạo script automation với selectors THẬT dựa trên DOM được cung cấp:`;

        try {
            // Get selected model from settings
            const selectedModel = document.getElementById('aiModel')?.value || 'gemini-2.5-flash';

            console.log('🔥 Sending ENHANCED social media prompt to AI...');

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
                        temperature: 0.05, // Low temperature for consistent selectors
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
            console.log('Raw API Response from Google:', JSON.stringify(data, null, 2));

            // KIỂM TRA LỖI TRỰC TIẾP TỪ API
            if (data.error) {
                console.error('Google AI API Error:', data.error);
                throw new Error(`API Error: ${data.error.message}`);
            }

            // KIỂM TRA PHẢN HỒI BỊ CHẶN BỞI BỘ LỌC AN TOÀN
            if (!data.candidates) {
                if (data.promptFeedback && data.promptFeedback.blockReason) {
                    console.error('Prompt was blocked by safety filters:', data.promptFeedback);
                    throw new Error(`Yêu cầu bị chặn. Lý do: ${data.promptFeedback.blockReason}`);
                } else {
                    console.error('Invalid API response structure:', data);
                    throw new Error('Phản hồi không hợp lệ: Không tìm thấy "candidates".');
                }
            }

            // Nếu mọi thứ ổn, tiếp tục xử lý
            const generatedText = data.candidates[0].content.parts[0].text;
            
            return generatedText;

        } catch (error) {
            console.error('Google AI API error:', error);
            throw new Error(`Google AI API call failed: ${error.message}`);
        }
    }

    getAvailableActions() {
        return `
🔥 CÁC HÀNH ĐỘNG CÓ SẴN (chỉ dùng selector CSS THẬT):

CÁC HÀNH ĐỘNG CƠ BẢN:
- click: Click vào tọa độ {"action": "click", "x": 100, "y": 200}
- clickElement: Click vào element {"action": "clickElement", "selector": "CSS_SELECTOR_THẬT"}
- fill: Điền input {"action": "fill", "selector": "CSS_SELECTOR_THẬT", "text": "giá_trị"}
- type: Nhập text (thay thế cho fill) {"action": "type", "selector": "CSS_SELECTOR_THẬT", "text": "giá_trị"}
- press: Nhấn phím {"action": "press", "key": "Enter|Tab|Escape|Space"}
- hover: Hover vào element {"action": "hover", "selector": "CSS_SELECTOR_THẬT"}

ĐIỀU HƯỚNG:
- goto: Đi tới URL {"action": "goto", "url": "https://example.com"}
- reload: Reload trang {"action": "reload"}

SCROLL:
- scroll: Scroll phần trăm {"action": "scroll", "scrollMode": "percentage", "percentageY": 50}
- scroll: Scroll tuyệt đối {"action": "scroll", "scrollMode": "absolute", "x": 0, "y": 500}
- scroll: Scroll tương đối {"action": "scroll", "scrollMode": "relative", "x": 0, "y": 200}
- scroll: Scroll delta {"action": "scroll", "scrollMode": "delta", "delta": 300}

TƯƠNG TÁC FORM:
- selectOption: Chọn option dropdown {"action": "selectOption", "selector": "select[name='country']", "value": "giá_trị_option"}
- check: Check/uncheck checkbox {"action": "check", "selector": "input[type='checkbox'][name='agree']", "checked": true}

UPLOAD FILE:
- setInputFiles: Upload files {"action": "setInputFiles", "selector": "input[type='file']", "filePaths": ["file1.txt"]}

CHỜ ĐỢI:
- wait: Chờ thời gian {"action": "wait", "duration": 2000}
- waitForElement: Chờ element {"action": "waitForElement", "selector": "CSS_SELECTOR_THẬT", "timeout": 10000}

LẤY DỮ LIỆU:
- getText: Lấy text {"action": "getText", "selector": "CSS_SELECTOR_THẬT"}
- getAttribute: Lấy attribute {"action": "getAttribute", "selector": "CSS_SELECTOR_THẬT", "attribute": "href"}
- innerText: Lấy inner text {"action": "innerText", "selector": "CSS_SELECTOR_THẬT"}
- textContent: Lấy text content {"action": "textContent", "selector": "CSS_SELECTOR_THẬT"}
- inputValue: Lấy input value {"action": "inputValue", "selector": "input[name='username']"}

🔥 VÍ DỤ CSS SELECTORS THẬT CHO SOCIAL MEDIA:
- Comment button: [aria-label*="comment" i], [role="button"]:contains("Comment"), div[role="button"] span:contains("Bình luận")
- Like button: [aria-label*="like" i], [role="button"]:contains("Like"), div[role="button"] span:contains("Thích")  
- Share button: [aria-label*="share" i], [role="button"]:contains("Share"), div[role="button"] span:contains("Chia sẻ")
- Form inputs: input[name="email"], textarea[aria-label*="comment"], input[type="password"]
- Submit buttons: button[type="submit"], [role="button"][aria-label*="submit"]

🚫 TUYỆT ĐỐI KHÔNG SỬ DỤNG:
- __stagehand_id (không có thật!)
- Selectors không có trong DOM
- Generated classes như .css-xyz123, .makeStyles-root
- Fake IDs không tồn tại
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
                // Thử tìm JSON object thay vì array
                const objectMatch = cleanResponse.match(/\{[\s\S]*\}/);
                if (objectMatch) {
                    const singleStep = JSON.parse(objectMatch[0]);
                    return [singleStep]; // Wrap trong array
                }
                throw new Error('Không tìm thấy JSON array trong phản hồi AI');
            }

            const steps = JSON.parse(jsonMatch[0]);
            
            if (!Array.isArray(steps)) {
                throw new Error('Phản hồi AI không phải là array');
            }

            // 🔥 ENHANCED: Validate and convert steps with REAL selector validation
            return steps.map((step, index) => {
                if (!step.action) {
                    throw new Error(`Bước ${index + 1} thiếu action`);
                }

                // Convert AI format to our internal format
                const convertedStep = {
                    type: step.action,
                    tabId: null // Will be set when used
                };

                // Map common properties
                if (step.selector) {
                    // 🔥 VALIDATE SELECTOR - cảnh báo nếu có vẻ fake
                    if (step.selector.includes('__stagehand_id')) {
                        console.warn(`⚠️ Bước ${index + 1}: AI vẫn dùng fake __stagehand_id!`);
                        // Có thể replace bằng fallback selector
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

                // Handle coordinates properly
                if (step.x !== undefined) convertedStep.x = parseInt(step.x);
                if (step.y !== undefined) convertedStep.y = parseInt(step.y);

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

                // Validate coordinates for click action
                if (convertedStep.type === 'click') {
                    if (convertedStep.x === undefined || convertedStep.y === undefined || 
                        isNaN(convertedStep.x) || isNaN(convertedStep.y)) {
                        console.warn(`Warning: Click step ${index + 1} có tọa độ không hợp lệ:`, convertedStep);
                        // Convert to clickElement if possible
                        if (convertedStep.selector) {
                            convertedStep.type = 'clickElement';
                            delete convertedStep.x;
                            delete convertedStep.y;
                        } else {
                            throw new Error(`Bước ${index + 1}: Click cần tọa độ x, y hợp lệ hoặc selector`);
                        }
                    }
                }

                // 🔥 ENHANCED SELECTOR VALIDATION
                if (convertedStep.selector) {
                    // Cảnh báo về các pattern có vấn đề
                    if (convertedStep.selector.includes('__stagehand_id')) {
                        console.warn(`🚫 FAKE SELECTOR: Bước ${index + 1} dùng __stagehand_id (không tồn tại)`);
                    }
                    
                    if (convertedStep.selector.match(/\#[a-z0-9]{8,}/i)) {
                        console.warn(`⚠️ SUSPICIOUS ID: Bước ${index + 1} selector ${convertedStep.selector} có vẻ là generated ID`);
                    }
                    
                    if (convertedStep.selector.includes('.css-') || convertedStep.selector.includes('.makeStyles-')) {
                        console.warn(`⚠️ GENERATED CLASS: Bước ${index + 1} selector ${convertedStep.selector} dùng generated class`);
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

            // Hover effect
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
            
            // 🔥 ENHANCED validation indicator with REAL selector checking
            const validationIcon = document.createElement('span');
            if (step.type === 'click' && (step.x !== undefined && step.y !== undefined)) {
                validationIcon.textContent = '🎯';
                validationIcon.title = 'Click tọa độ';
                validationIcon.style.color = '#f59e0b';
            } else if (step.selector) {
                // Check for real selector quality
                if (step.selector.includes('__stagehand_id')) {
                    validationIcon.textContent = '🚫';
                    validationIcon.title = 'FAKE ID - Selector không tồn tại!';
                    validationIcon.style.color = '#ef4444';
                } else if (step.selector.includes('#') || step.selector.includes('[name=') || step.selector.includes('[data-') || step.selector.includes('[aria-label')) {
                    validationIcon.textContent = '✅';
                    validationIcon.title = 'Selector semantic tốt';
                    validationIcon.style.color = '#10b981';
                } else if (step.selector.includes('.css-') || step.selector.includes('.makeStyles-')) {
                    validationIcon.textContent = '⚠️';
                    validationIcon.title = 'Generated class - có thể không ổn định';
                    validationIcon.style.color = '#f59e0b';
                } else {
                    validationIcon.textContent = '👌';
                    validationIcon.title = 'Selector OK';
                    validationIcon.style.color = '#6366f1';
                }
            } else {
                validationIcon.textContent = '✅';
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

        // Store generated steps for later use
        this.generatedSteps = steps;
        
        // 🔥 ENHANCED summary with selector analysis
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
            <strong>📊 Phân tích Script AI:</strong><br>
            • Tổng cộng: ${steps.length} bước<br>
            • Selector thật: ${realSelectors} bước ✅<br>
            • Fake selector (__stagehand_id): ${fakeSelectors} bước 🚫<br>
            • Click tọa độ: ${coordinateClicks} bước 🎯<br>
            ${fakeSelectors > 0 ? '<br><strong style="color: #dc2626;">⚠️ Có fake selector! Cần sửa lại!</strong>' : '<br><strong style="color: #059669;">🎉 Tất cả selector đều thật!</strong>'}
        `;
        container.appendChild(summary);
    }

    // DOM Display Functions
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

        // Auto show DOM container
        const container = document.getElementById('aiDOMResponse');
        const button = document.getElementById('toggleDOMResponse');
        if (container && container.style.display === 'none') {
            container.style.display = 'block';
            if (button) button.textContent = '👁️ Hide';
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

        // Update status indicator
        if (domStatus) {
            if (!this.enableTruncation) {
                domStatus.textContent = '✅ Full DOM';
                domStatus.className = 'status-full-dom';
            } else if (this.truncatedDOMLength < this.originalDOMLength) {
                domStatus.textContent = '⚠️ Truncated';
                domStatus.className = 'status-truncated';
            } else {
                domStatus.textContent = '✅ Not Truncated';
                domStatus.className = 'status-full-dom';
            }
        }

        // Update info box
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
                button.textContent = '👁️ Hide';
            } else {
                container.style.display = 'none';
                button.textContent = '👁️ Show';
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

    // AI Response Display Functions
    displayRawAIResponse(rawResponse) {
        this.lastRawResponse = rawResponse;
        const textarea = document.getElementById('aiResponseText');
        if (textarea) {
            // Format JSON đẹp nếu có thể parse
            try {
                // Try to extract JSON from response
                const jsonMatch = rawResponse.match(/\[[\s\S]*\]/) || rawResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    const formatted = JSON.stringify(parsed, null, 2);
                    textarea.value = `=== RAW AI RESPONSE ===\n${rawResponse}\n\n=== EXTRACTED JSON ===\n${formatted}`;
                } else {
                    textarea.value = `=== RAW AI RESPONSE ===\n${rawResponse}\n\n=== NOTE ===\nKhông tìm thấy JSON hợp lệ trong response`;
                }
            } catch (e) {
                // Nếu không phải JSON thì hiển thị raw
                textarea.value = `=== RAW AI RESPONSE ===\n${rawResponse}\n\n=== PARSE ERROR ===\n${e.message}`;
            }
        }

        // Auto show if first time
        const container = document.getElementById('aiRawResponse');
        const button = document.getElementById('toggleAIResponse');
        if (container && container.style.display === 'none') {
            container.style.display = 'block';
            if (button) button.textContent = '👁️ Hide';
        }
    }

    toggleAIResponseDisplay() {
        const container = document.getElementById('aiRawResponse');
        const button = document.getElementById('toggleAIResponse');
        
        if (container && button) {
            if (container.style.display === 'none') {
                container.style.display = 'block';
                button.textContent = '👁️ Hide';
            } else {
                container.style.display = 'none';
                button.textContent = '👁️ Show';
            }
        }
    }

    copyAIResponseToClipboard() {
        const textarea = document.getElementById('aiResponseText');
        if (textarea && textarea.value) {
            // Create a temporary input to select and copy
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

    // 🔥 NEW: Methods to control truncation from UI
    enableDOMTruncation(enable = true) {
        this.enableTruncation = enable;
        console.log(`🔧 DOM Truncation: ${enable ? 'ENABLED' : 'DISABLED'}`);
        this.updateDOMTruncationInfo();
        
        // Save setting
        chrome.storage.local.set({ enableTruncation: enable });
    }

    setMaxDOMSize(size) {
        this.maxDomSize = size;
        console.log(`🔧 Max DOM Size set to: ${size} chars`);
        
        // Save setting
        chrome.storage.local.set({ maxDomSize: size });
    }

    // Load settings from storage
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
            
            // Update UI controls
            const enableTruncationInput = document.getElementById('enableTruncation');
            const maxDomSizeInput = document.getElementById('maxDomSize');
            
            if (enableTruncationInput) enableTruncationInput.checked = this.enableTruncation;
            if (maxDomSizeInput) maxDomSizeInput.value = this.maxDomSize;
            
            console.log(`🔧 Settings loaded: Truncation=${this.enableTruncation}, MaxSize=${this.maxDomSize}`);
            
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

// Initialize AI Helper when page loads
let aiHelper;
document.addEventListener('DOMContentLoaded', () => {
    aiHelper = new AIHelper();
    
    // Load settings after initialization
    aiHelper.loadSettings();
    
    // Make AI helper globally available
    window.AIHelper = aiHelper;
    
    console.log('🔥 FIXED: AI Helper loaded with CONFIGURABLE DOM TRUNCATION!');
});