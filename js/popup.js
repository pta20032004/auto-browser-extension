document.addEventListener('DOMContentLoaded', function() {
    const openPopup = (url, width = 420, height = 600) => {
        chrome.windows.create({
            // Đường dẫn bây giờ phải bao gồm thư mục 'pages'
            url: chrome.runtime.getURL(`pages/${url}`),
            type: 'popup',
            width: width,
            height: height
        });
        window.close();
    };

    document.getElementById('openAutoClicker').addEventListener('click', () => {
        openPopup('autoclicker.html', 380, 420);
    });

    document.getElementById('openScriptManager').addEventListener('click', () => {
        openPopup('scripts.html', 500, 650);
    });

    document.getElementById('openFileManager').addEventListener('click', () => {
        openPopup('files.html', 550, 650);
    });
});