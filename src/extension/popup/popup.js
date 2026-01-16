// ===== CONFIGURATION =====
const API_BASE_URL = "http://localhost:3000";

// ===== STATE =====
let token = null;
let studentCode = "popup_user";
let userName = "User";
let conversationHistory = [];

// ===== DOM ELEMENTS =====
const messagesEl = document.getElementById("chat-messages");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const clearBtn = document.getElementById("clear-btn");
const statusIndicator = document.getElementById("status-indicator");
const botAvatar = document.getElementById("bot-avatar");

// ===== INITIALIZATION =====
document.addEventListener("DOMContentLoaded", async () => {
  // Set avatar
  botAvatar.src = chrome.runtime.getURL("icon.png");

  // Load saved chat
  loadChat();

  // Check API key and get token
  await initializeSession();

  // Bind events
  bindEvents();
});

// ===== EVENT BINDINGS =====
function bindEvents() {
  formEl.addEventListener("submit", handleSubmit);
  clearBtn.addEventListener("click", clearHistory);

  inputEl.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  });
}

// ===== SESSION INITIALIZATION =====
async function initializeSession() {
  updateStatus(false);

  // Check server health
  const isHealthy = await checkServerHealth();
  if (!isHealthy) {
    addSystemMessage("Không thể kết nối server. Vui lòng kiểm tra backend đang chạy tại localhost:3000");
    return;
  }

  // Check if user has API key
  const hasApiKey = await checkUserApiKey();
  if (!hasApiKey) {
    showApiKeyPopup();
    return;
  }

  // Get token
  await getToken();
}

// ===== SERVER HEALTH CHECK =====
async function checkServerHealth() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return res.ok;
  } catch (error) {
    console.error("Health check failed:", error);
    return false;
  }
}

// ===== CHECK USER API KEY =====
async function checkUserApiKey() {
  try {
    const res = await fetch(`${API_BASE_URL}/check-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentCode })
    });

    const data = await res.json();
    return data.exists && data.hasApiKey;
  } catch (error) {
    console.error("Check user failed:", error);
    return false;
  }
}

// ===== GET TOKEN =====
async function getToken() {
  try {
    const res = await fetch(`${API_BASE_URL}/get-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentCode })
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const data = await res.json();
    token = data.token;
    updateStatus(true);
    console.log("Token received:", token);
  } catch (error) {
    console.error("Get token failed:", error);
    updateStatus(false);
    addSystemMessage("Không thể lấy token từ server.");
  }
}

// ===== RELEASE TOKEN =====
async function releaseToken() {
  if (!token) return;

  try {
    await fetch(`${API_BASE_URL}/release-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, studentCode }),
      keepalive: true
    });
  } catch (error) {
    console.warn("Release token failed:", error);
  }
}

// ===== API KEY POPUP =====
function showApiKeyPopup(isUpdate = false, errorMsg = "") {
  // Remove existing popup
  const existing = document.querySelector(".api-popup-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "api-popup-overlay";

  const title = isUpdate ? "Cập nhật API Key" : "Cấu hình API Key";
  const errorHtml = errorMsg ? `<div class="api-message error">${errorMsg}</div>` : "";

  overlay.innerHTML = `
    <div class="api-popup">
      <h3>${title}</h3>
      <p>
        Để sử dụng chatbot, bạn cần cung cấp Gemini API key.<br><br>
        <strong>Hướng dẫn:</strong><br>
        1. Truy cập: <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a><br>
        2. Nhấn "Create API key"<br>
        3. Copy và dán vào ô bên dưới
      </p>
      ${errorHtml}
      <input type="text" id="api-key-input" placeholder="Nhập Gemini API key...">
      <div id="api-popup-message" class="api-message"></div>
      <div class="api-popup-buttons">
        ${!isUpdate ? '<button type="button" class="cancel-btn" id="api-cancel-btn">Hủy</button>' : ''}
        <button type="button" class="save-btn" id="api-save-btn">${isUpdate ? 'Cập nhật' : 'Lưu'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const apiInput = document.getElementById("api-key-input");
  const saveBtn = document.getElementById("api-save-btn");
  const cancelBtn = document.getElementById("api-cancel-btn");
  const messageDiv = document.getElementById("api-popup-message");

  apiInput.focus();

  saveBtn.addEventListener("click", async () => {
    const apiKey = apiInput.value.trim();
    if (!apiKey) {
      showPopupMessage(messageDiv, "Vui lòng nhập API key!", "error");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Đang kiểm tra...";

    try {
      // Test API key
      const testRes = await fetch(`${API_BASE_URL}/test-api-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey })
      });

      const testData = await testRes.json();

      if (!testData.success) {
        showPopupMessage(messageDiv, "API key không hợp lệ: " + (testData.message || testData.error), "error");
        saveBtn.disabled = false;
        saveBtn.textContent = isUpdate ? 'Cập nhật' : 'Lưu';
        return;
      }

      // Save API key
      const saveRes = await fetch(`${API_BASE_URL}/save-api-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentCode, name: userName, apiKey })
      });

      const saveData = await saveRes.json();

      if (saveData.success) {
        showPopupMessage(messageDiv, "API key đã được lưu!", "success");
        setTimeout(() => {
          overlay.remove();
          getToken();
        }, 1000);
      } else {
        showPopupMessage(messageDiv, "Lỗi khi lưu: " + saveData.error, "error");
        saveBtn.disabled = false;
        saveBtn.textContent = isUpdate ? 'Cập nhật' : 'Lưu';
      }
    } catch (error) {
      showPopupMessage(messageDiv, "Lỗi kết nối: " + error.message, "error");
      saveBtn.disabled = false;
      saveBtn.textContent = isUpdate ? 'Cập nhật' : 'Lưu';
    }
  });

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      overlay.remove();
    });
  }
}

function showPopupMessage(div, text, type) {
  div.className = `api-message ${type}`;
  div.textContent = text;
}

// ===== UPDATE STATUS =====
function updateStatus(connected) {
  statusIndicator.textContent = connected ? "🟢" : "🔴";
  statusIndicator.title = connected ? "Đã kết nối" : "Chưa kết nối";
}

// ===== HANDLE SUBMIT =====
async function handleSubmit(e) {
  e.preventDefault();

  const text = inputEl.value.trim();
  if (!text) return;

  if (!token) {
    addSystemMessage("Chưa có token. Vui lòng đợi kết nối server.");
    return;
  }

  // Disable input
  setInputState(false);

  // Add user message
  addUserMessage(text);
  inputEl.value = "";

  // Add typing indicator
  const typingId = addTypingIndicator();

  // Call API
  await sendToAPI(text, typingId);

  // Enable input
  setInputState(true);
  inputEl.focus();
}

// ===== SEND TO API =====
async function sendToAPI(question, typingId) {
  try {
    // Add to history
    conversationHistory.push({
      role: "user",
      parts: [{ text: question }]
    });

    const res = await fetch(`${API_BASE_URL}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: question,
        token,
        history: conversationHistory.slice(0, -1)
      })
    });

    // Remove typing indicator
    removeTypingIndicator(typingId);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      conversationHistory.pop();

      // Handle API key errors
      if (res.status === 400 || res.status === 403 || res.status === 429) {
        const errorMsg = getApiErrorMessage(res.status, errorData);
        addBotMessage(errorMsg);
        showApiKeyPopup(true, errorMsg);
        return;
      }

      throw new Error(errorData.error || `Server error: ${res.status}`);
    }

    const data = await res.json();
    const reply = data.reply || "Không có phản hồi.";

    // Add to history
    conversationHistory.push({
      role: "model",
      parts: [{ text: reply }]
    });

    // Add bot message and scroll to it
    addBotMessage(reply, true);
    saveChat();

  } catch (error) {
    removeTypingIndicator(typingId);
    conversationHistory.pop();
    console.error("API error:", error);
    addBotMessage(`Lỗi: ${error.message}`);
  }
}

// ===== GET API ERROR MESSAGE =====
function getApiErrorMessage(status, errorData) {
  switch (status) {
    case 400:
      return "API key không hợp lệ hoặc sai định dạng.";
    case 403:
      return "API key không có quyền truy cập hoặc đã bị vô hiệu hóa.";
    case 429:
      return "API key đã vượt quá giới hạn yêu cầu. Vui lòng đợi hoặc tạo API key mới.";
    default:
      return errorData?.error || `Lỗi API (${status})`;
  }
}

// ===== ADD USER MESSAGE =====
function addUserMessage(text) {
  const msgDiv = document.createElement("div");
  msgDiv.className = "message user-message";
  msgDiv.innerHTML = `<div class="user-message-bubble">${escapeHtml(text)}</div>`;
  messagesEl.appendChild(msgDiv);
  scrollToBottom();
}

// ===== ADD BOT MESSAGE =====
function addBotMessage(text, scrollToTop = false) {
  const msgDiv = document.createElement("div");
  msgDiv.className = "message bot-message-wrapper";

  const formattedText = formatMessage(text);

  msgDiv.innerHTML = `
    <img class="avatar" src="${chrome.runtime.getURL('icon.png')}" alt="Bot">
    <div class="bot-message">${formattedText}</div>
  `;

  messagesEl.appendChild(msgDiv);

  // Scroll to the START of this message (not bottom)
  if (scrollToTop) {
    setTimeout(() => {
      msgDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  } else {
    scrollToBottom();
  }
}

// ===== ADD SYSTEM MESSAGE =====
function addSystemMessage(text) {
  const msgDiv = document.createElement("div");
  msgDiv.className = "system-message";
  msgDiv.textContent = text;
  messagesEl.appendChild(msgDiv);
  scrollToBottom();
}

// ===== ADD TYPING INDICATOR =====
function addTypingIndicator() {
  const id = "typing-" + Date.now();
  const msgDiv = document.createElement("div");
  msgDiv.className = "message bot-message-wrapper";
  msgDiv.id = id;
  msgDiv.innerHTML = `
    <img class="avatar" src="${chrome.runtime.getURL('icon.png')}" alt="Bot">
    <div class="bot-message">
      <div class="typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;
  messagesEl.appendChild(msgDiv);
  scrollToBottom();
  return id;
}

// ===== REMOVE TYPING INDICATOR =====
function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ===== FORMAT MESSAGE =====
function formatMessage(text) {
  // Code blocks
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

  // Inline code
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Links markdown style
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Plain URLs
  text = text.replace(/(?<!href="|">)(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>');

  // Line breaks
  text = text.replace(/\n/g, '<br>');

  return text;
}

// ===== ESCAPE HTML =====
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ===== SCROLL TO BOTTOM =====
function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ===== SET INPUT STATE =====
function setInputState(enabled) {
  inputEl.disabled = !enabled;
  sendBtn.disabled = !enabled;
}

// ===== SAVE CHAT =====
function saveChat() {
  const data = {
    html: messagesEl.innerHTML,
    history: conversationHistory
  };
  localStorage.setItem("ptit-chat-popup", JSON.stringify(data));
}

// ===== LOAD CHAT =====
function loadChat() {
  const saved = localStorage.getItem("ptit-chat-popup");
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data.html) {
        messagesEl.innerHTML = data.html;
        // Update avatar src after loading
        messagesEl.querySelectorAll('.avatar').forEach(img => {
          img.src = chrome.runtime.getURL('icon.png');
        });
      }
      if (data.history) {
        conversationHistory = data.history;
      }
    } catch (e) {
      console.error("Load chat failed:", e);
    }
  }
}

// ===== CLEAR HISTORY =====
function clearHistory() {
  if (confirm("Bạn có chắc muốn xóa toàn bộ lịch sử?")) {
    conversationHistory = [];
    messagesEl.innerHTML = `
      <div class="message bot-message-wrapper">
        <img class="avatar" src="${chrome.runtime.getURL('icon.png')}" alt="Bot">
        <div class="bot-message">
          Xin chào! Mình là trợ lý AI của PTIT. Mình có thể giúp gì cho bạn?
        </div>
      </div>
    `;
    localStorage.removeItem("ptit-chat-popup");
  }
}

// ===== CLEANUP ON CLOSE =====
window.addEventListener("beforeunload", () => {
  releaseToken();
});
