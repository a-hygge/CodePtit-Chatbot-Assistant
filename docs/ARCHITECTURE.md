# Kiến trúc Dự án

## Tổng quan

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Popup     │  │  Content    │  │    Background       │ │
│  │   (UI)      │  │  Script     │  │    Service Worker   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │            │
└─────────┼────────────────┼─────────────────────┼────────────┘
          │                │                     │
          └────────────────┼─────────────────────┘
                           │ HTTP
                           ▼
          ┌────────────────────────────────┐
          │        Backend Server          │
          │       (Node.js/Express)        │
          │                                │
          │  ┌──────────────────────────┐ │
          │  │    Google Gemini AI      │ │
          │  └──────────────────────────┘ │
          └────────────────────────────────┘
```

## Thành phần

### 1. Chrome Extension (`src/extension/`)

#### Background Service Worker
- **File:** `background/background.js`
- **Chức năng:** Xử lý events, quản lý lifecycle extension

#### Content Script
- **Files:** `content/content.js`, `content/content.css`
- **Chức năng:** Inject vào trang web, tạo chatbot widget, đọc context từ trang

#### Popup
- **Files:** `popup/popup.html`, `popup/popup.js`, `popup/popup.css`
- **Chức năng:** Giao diện popup khi click icon extension

### 2. Backend Server (`src/server/`)

#### Main Entry
- **File:** `index.js`
- **Framework:** Express.js
- **Port:** 3000 (configurable)

#### Chức năng chính:
- Quản lý API keys
- Session token management
- Proxy requests tới Google Gemini AI
- Rate limiting

## Data Flow

```
1. User nhập câu hỏi
        │
        ▼
2. Extension gửi request tới Backend
        │
        ▼
3. Backend validate token & API key
        │
        ▼
4. Backend gọi Google Gemini AI
        │
        ▼
5. Nhận response từ Gemini
        │
        ▼
6. Backend trả response cho Extension
        │
        ▼
7. Extension hiển thị câu trả lời
```

## Security

- API keys được lưu trữ an toàn trong backend
- Session tokens có thời hạn
- CORS configured cho domain cụ thể
- Rate limiting để chống abuse

## Storage

### Chrome Storage API
- User preferences
- Conversation history (local)

### Backend (In-memory)
- Session tokens
- API key cache
