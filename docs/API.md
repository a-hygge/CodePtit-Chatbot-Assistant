# API Documentation

## Base URL

```
http://localhost:3000
```

## Endpoints

### Health Check

Kiểm tra server hoạt động.

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### Check User

Kiểm tra user đã có API key chưa.

```http
POST /check-user
```

**Request Body:**
```json
{
  "userId": "string"
}
```

**Response:**
```json
{
  "hasApiKey": true,
  "message": "User has API key configured"
}
```

---

### Test API Key

Kiểm tra API key hợp lệ.

```http
POST /test-api-key
```

**Request Body:**
```json
{
  "apiKey": "string"
}
```

**Response:**
```json
{
  "valid": true,
  "message": "API key is valid"
}
```

---

### Save API Key

Lưu API key cho user.

```http
POST /save-api-key
```

**Request Body:**
```json
{
  "userId": "string",
  "apiKey": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "API key saved successfully"
}
```

---

### Get Token

Lấy session token mới.

```http
POST /get-token
```

**Request Body:**
```json
{
  "userId": "string"
}
```

**Response:**
```json
{
  "token": "uuid-string",
  "expiresAt": "2024-01-01T01:00:00.000Z"
}
```

---

### Release Token

Giải phóng session token.

```http
POST /release-token
```

**Request Body:**
```json
{
  "token": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token released"
}
```

---

### Ask AI

Gửi câu hỏi và nhận trả lời từ AI.

```http
POST /api/ask
```

**Request Body:**
```json
{
  "token": "string",
  "question": "string",
  "context": "string (optional)",
  "conversationHistory": []
}
```

**Response:**
```json
{
  "answer": "AI response here",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Error Responses

Tất cả errors trả về format:

```json
{
  "error": true,
  "message": "Error description",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_TOKEN` | Token không hợp lệ hoặc hết hạn |
| `INVALID_API_KEY` | API key không hợp lệ |
| `RATE_LIMITED` | Vượt quá giới hạn request |
| `SERVER_ERROR` | Lỗi server nội bộ |
