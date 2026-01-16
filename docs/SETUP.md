# Hướng dẫn Cài đặt

## Yêu cầu hệ thống

- Node.js >= 18.0.0
- npm >= 9.0.0
- Chrome hoặc Edge (phiên bản mới nhất)

## Cài đặt Dependencies

```bash
npm install
```

## Cấu hình Environment

1. Copy file `.env.example` sang `.env`:
```bash
cp configs/.env.example .env
```

2. Cập nhật các giá trị trong file `.env`:
```
GEMINI_API_KEY=your_actual_api_key
PORT=3000
```

## Khởi động Server

### Development mode (với auto-reload):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

Server sẽ chạy tại: `http://localhost:3000`

## Cài đặt Extension

1. Mở Chrome/Edge
2. Truy cập:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
3. Bật **Developer mode**
4. Click **"Load unpacked"**
5. Chọn thư mục `src/extension`

## Lấy Gemini API Key

1. Truy cập: [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Đăng nhập tài khoản Google
3. Click **"Create API key"**
4. Copy và lưu API key

## Khắc phục lỗi thường gặp

### "Không thể kết nối server"
- Kiểm tra server đang chạy: `npm start`
- Kiểm tra port 3000 không bị chiếm

### "API key không hợp lệ"
- Tạo API key mới tại Google AI Studio
- Kiểm tra API key trong file `.env`

### Extension không hiện
- Reload extension trong chrome://extensions/
- Kiểm tra Developer mode đã bật
