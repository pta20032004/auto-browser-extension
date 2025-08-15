# Auto Clicker & Automation Suite

Chrome Extension cho phép tự động hóa các thao tác trên web với giao diện thân thiện và quản lý file tích hợp.

## 🌟 Tính năng chính

### 1. Auto Clicker (Tự động Click)
- Chọn vị trí click bằng cách point-and-click
- Tùy chỉnh thời gian delay giữa các click
- Bắt đầu/dừng auto click dễ dàng

### 2. Script Builder (Xây dựng kịch bản)
- Giao diện drag-and-drop để tạo kịch bản tự động hóa
- Hỗ trợ nhiều loại hành động:
  - **Click**: Tọa độ hoặc CSS selector
  - **Type**: Nhập text vào input fields
  - **Press**: Nhấn phím (Enter, Tab, arrows, etc.)
  - **Wait**: Chờ một khoảng thời gian hoặc element xuất hiện
  - **Scroll**: Di chuyển trang
  - **Hover**: Di chuột qua element
  - **Select**: Chọn option trong dropdown
  - **Check/Uncheck**: Tương tác với checkbox/radio
  - **Get Text/Attribute**: Lấy dữ liệu từ trang
  - **Navigate**: Đi tới URL hoặc reload trang

### 3. File Manager (Quản lý File)
- Upload file và thư mục lên IndexedDB
- Xem trước file text, code, images
- Tải xuống file đã lưu
- Xóa file/thư mục
- Theo dõi dung lượng đã sử dụng

## 📁 Cấu trúc File

```
├── manifest.json          # Cấu hình extension
├── popup.html             # Giao diện chính
├── popup.js               # Logic giao diện và tab navigation
├── styles.css             # Styling cho UI
├── background.js          # Service worker và API automation
├── content.js             # Script chạy trên webpage
├── indexeddb-helper.js    # Quản lý IndexedDB
├── script-builder.js      # Logic xây dựng kịch bản
├── file-manager.js        # Logic quản lý file
└── icons/                 # Icon cho extension
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 🚀 Hướng dẫn cài đặt

1. Tải về hoặc clone code về máy
2. Mở Chrome và đi tới `chrome://extensions/`
3. Bật "Developer mode" ở góc trên bên phải
4. Click "Load unpacked" và chọn thư mục chứa extension
5. Extension sẽ xuất hiện trong toolbar của Chrome

## 📖 Hướng dẫn sử dụng

### Tab Auto Clicker

1. **Chọn vị trí**: Click "Bắt đầu chọn vị trí" → Click vào vị trí muốn auto-click trên trang web
2. **Thiết lập delay**: Nhập thời gian chờ giữa các click (milliseconds)
3. **Bắt đầu**: Click "Bắt đầu Click" để chạy auto clicker
4. **Dừng**: Click "Dừng Click" để dừng

### Tab Kịch Bản

1. **Thêm bước**: Click "Thêm Bước" để thêm hành động mới
2. **Chọn loại hành động**: Chọn từ dropdown (click, type, wait, etc.)
3. **Điền thông số**: Nhập CSS selector, text, thời gian chờ, v.v.
4. **Sắp xếp**: Dùng nút ↑↓ để sắp xếp thứ tự các bước
5. **Chỉnh sửa**: Click "Sửa" để chỉnh sửa bước đã tạo
6. **Lưu kịch bản**: Click "Lưu Kịch Bản" để lưu vào database
7. **Chạy**: Click "Chạy Kịch Bản" để thực thi

### Tab Quản Lý File

1. **Upload thư mục**: Click "Tải Lên Thư Mục" để upload cả thư mục
2. **Upload files**: Click "Tải Lên Files" để upload file riêng lẻ
3. **Xem file**: Click "Xem" để preview nội dung file
4. **Tải xuống**: Click "Tải" để download file về máy
5. **Xóa**: Click "Xóa" để xóa file/thư mục

## 🔧 API Documentation

### Background Script API

Extension cung cấp AutomationAPI tương tự Playwright:

```javascript
// Click element
await ChromeAutomation.click('button#submit');

// Fill input
await ChromeAutomation.fill('input[name="username"]', 'myusername');

// Type với delay
await ChromeAutomation.type('textarea', 'Hello world', { delay: 100 });

// Press key
await ChromeAutomation.press('Enter');

// Wait for element
await ChromeAutomation.waitForSelector('.loading', { timeout: 10000 });

// Get text content
const text = await ChromeAutomation.textContent('h1');

// Navigate
await ChromeAutomation.goto('https://example.com');
```

### File Manager Utils

Truy cập file đã upload từ automation script:

```javascript
// Đọc nội dung file
const content = await FileManagerUtils.getFileContent('data.txt');

// List files trong thư mục
const files = await FileManagerUtils.listFiles('my-folder');
```

### Popup Utils

Điều khiển popup từ script:

```javascript
// Switch tab
PopupUtils.switchToTab('automation');

// Get/Set coordinates
const coords = await PopupUtils.getCurrentCoords();
PopupUtils.setCoords(100, 200);

// Control auto clicker
PopupUtils.startAutoClicker(500);
PopupUtils.stopAutoClicker();
```

## 🔍 CSS Selector Examples

Sử dụng CSS selector để target elements:

```css
/* By ID */
#button-id

/* By class */
.button-class

/* By attribute */
input[type="email"]
input[placeholder="Search..."]

/* By text content */
button:contains("Submit")

/* Nested elements */
.form-container input[type="text"]
div.modal button.primary

/* Nth child */
.list-item:nth-child(2)
tr:first-child td:last-child
```

## ⚡ Performance Tips

1. **Sử dụng timeout hợp lý**: Không set timeout quá cao để tránh waiting lâu
2. **CSS selector hiệu quả**: Dùng selector specific để tránh target nhầm element
3. **Thêm delay giữa actions**: Cho phép trang web kịp render
4. **Kiểm tra element visibility**: Dùng `waitForSelector` trước khi interact
5. **Limit file size**: Không upload file quá lớn vào IndexedDB

## 🐛 Troubleshooting

### Lỗi thường gặp:

1. **"Không tìm thấy element"**
   - Kiểm tra CSS selector có đúng không
   - Đảm bảo element đã load xong
   - Thử increase timeout

2. **"Không thể kích hoạt trên trang này"**
   - Extension không hoạt động trên chrome:// pages
   - Thử trên trang web thường

3. **Script chạy không đúng**
   - Kiểm tra thứ tự các bước
   - Thêm wait step giữa các action
   - Test từng bước riêng lẻ

4. **File upload failed**
   - Kiểm tra file size
   - Đảm bảo browser hỗ trợ file type

## 🔒 Security & Privacy

- Extension chỉ chạy trên tab active hiện tại
- Không thu thập dữ liệu cá nhân
- File được lưu local trong IndexedDB của browser
- Không gửi data lên server ngoài

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

MIT License - xem file LICENSE để biết thêm chi tiết.

## 📞 Support

Nếu gặp vấn đề hoặc có góp ý, vui lòng tạo issue trên GitHub repository.

---

**Phiên bản**: 2.0  
**Tác giả**: Auto Clicker Team  
**Cập nhật**: 2024