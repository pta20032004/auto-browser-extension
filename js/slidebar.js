document.addEventListener('DOMContentLoaded', () => {
    // Xử lý chuyển tab trong sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const pageId = item.dataset.page;
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
            item.classList.add('active');
            document.getElementById(pageId).classList.add('active');
        });
    });

    // Ví dụ cách gửi lệnh từ sidebar đến content script
    // Bạn sẽ đặt logic này trong các file script-builder.js, autoclicker.js...
    // Ví dụ, trong script-builder.js, hàm runScript sẽ gọi hàm này
    window.runStepOnPage = function(step) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'executeStep', step: step }, (response) => {
                if (response && response.success) {
                    resolve(response.result);
                } else {
                    reject(new Error(response?.error || 'Lệnh thực thi thất bại'));
                }
            });
        });
    };
});