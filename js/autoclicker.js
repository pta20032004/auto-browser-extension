document.addEventListener('DOMContentLoaded', () => {
    const startSelectionBtn = document.getElementById('startSelection');
    const startClickingBtn = document.getElementById('startClicking');
    const stopClickingBtn = document.getElementById('stopClicking');
    const delayInput = document.getElementById('delay');
    const coordsDisplay = document.getElementById('coordsDisplay');
    const xCoordEl = document.getElementById('xCoord');
    const yCoordEl = document.getElementById('yCoord');

    let currentCoords = null;

    // Bắt đầu chọn vị trí
    startSelectionBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                alert('Không tìm thấy tab nào đang hoạt động.');
                return;
            }
            chrome.tabs.sendMessage(tabs[0].id, { action: "startPicking" });
            // Không đóng cửa sổ này để người dùng có thể thấy tọa độ được cập nhật
        });
    });

    // Bắt đầu click
    startClickingBtn.addEventListener('click', () => {
        if (!currentCoords) {
            alert('Vui lòng chọn vị trí trước khi bắt đầu.');
            return;
        }
        const delay = parseInt(delayInput.value) || 1000;
        chrome.runtime.sendMessage({
            action: "start",
            interval: delay
        });
    });

    // Dừng click
    stopClickingBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: "stop" });
    });

    // Lắng nghe thông tin tọa độ được cập nhật từ background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "updateCoords") {
            updateCoords(request.coords);
        }
    });

    // Load tọa độ đã lưu khi mở popup
    const loadSavedCoords = () => {
        chrome.storage.local.get(['coords'], (result) => {
            if (result.coords) {
                updateCoords(result.coords);
            }
        });
    };
    
    function updateCoords(coords) {
        currentCoords = coords;
        xCoordEl.textContent = coords.x;
        yCoordEl.textContent = coords.y;
        coordsDisplay.style.display = 'block';
    }

    loadSavedCoords();
});