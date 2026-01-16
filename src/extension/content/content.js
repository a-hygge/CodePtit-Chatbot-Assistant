(function() {
  console.log("PTIT Chatbot: Content script loaded");

  const API_BASE_URL = "http://localhost:3000";

  const SELECTORS = {
    problem: {
      nav: ['.submit__nav', '.submit_nav', '[class*="nav"]'],
      description: ['.submit__des', '.submit_des', '[class*="des"]'],
      requirements: ['.submit__req', '.submit_req', '[class*="req"]'],
      constraints: ['.submit__pad', '.submit_pad', '[class*="pad"]'],
      examples: ['.card-body', '.examples']
    },
    user: {
      name: ['.nav__profile__menu__name', '.nav__profile_menu_name', '[class*="profile__menu__name"]'],
      code: ['.nav__profile__menu__code', '.nav__profile_menu_code', '[class*="profile__menu__code"]']
    }
  };

  let token = null;
  let studentCode = "unknown";
  let userName = "User";
  let conversationHistory = [];
  let isChatExpanded = false;
  let currentMode = "practice";
  let userType = "student";

  function init() {
    if (document.getElementById("ptit-chatbot-container")) return;

    getUserInfo();
    createChatUI();
    bindEvents();
    loadChat();

    const modeInfo = getModeInfo();
    console.log("PTIT Chatbot: Initialized for", userName, studentCode);
    console.log("PTIT Chatbot: User type:", userType, "| Mode:", modeInfo.name);
  }

  function getUserInfo() {
    const getBySelectors = (selectors) => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim()) return el.innerText.trim();
      }
      return "";
    };

    userName = getBySelectors(SELECTORS.user.name) || "User";
    studentCode = getBySelectors(SELECTORS.user.code) || "unknown";

    userType = detectUserType(studentCode);

    currentMode = detectMode();
  }

  function detectUserType(code) {
    if (!code || code === "unknown") return "student";

    if (/\d/.test(code)) {
      return "student";
    }

    if (/^[A-Za-z]+$/.test(code)) {
      return "teacher";
    }

    return "student";
  }

  function detectMode() {
    const url = window.location.href;

    if (userType === "teacher") {
      return "teacher";
    }

    const timeleft = document.querySelector("#timeleft");
    if (timeleft) {
      return "exam";
    }

    return "practice";
  }

  function getModeInfo() {
    if (userType === "teacher") {
      return {
        name: "Hướng dẫn nghiệp vụ",
        color: "#2e7d32",
        icon: "📚"
      };
    }

    if (currentMode === "exam") {
      return {
        name: "Thực hành",
        color: "#ff9800",
        icon: "📝"
      };
    }

    return {
      name: "Luyện tập",
      color: "#c62828",
      icon: "💡"
    };
  }

  function createChatUI() {
    const toggleBtn = document.createElement("div");
    toggleBtn.id = "ptit-chat-toggle";
    toggleBtn.innerHTML = "🤖";
    toggleBtn.title = "Mở PTIT Chatbot";
    document.body.appendChild(toggleBtn);

    const modeInfo = getModeInfo();

    const greeting = getGreetingMessage();

    const container = document.createElement("div");
    container.id = "ptit-chatbot-container";
    container.innerHTML = `
      <div class="ptit-chat-header" id="ptit-chat-header">
        <span class="ptit-header-title">PTIT Chatbot</span>
        <div class="ptit-header-controls">
          <span class="ptit-header-btn" id="ptit-clear-btn" title="Xóa lịch sử">🗑️</span>
          <span class="ptit-header-btn ptit-status" id="ptit-status" title="Trạng thái">🔴</span>
          <span class="ptit-header-btn" id="ptit-minimize-btn" title="Thu nhỏ">➖</span>
        </div>
      </div>
      <div class="ptit-mode-badge" id="ptit-mode-badge" style="background: ${modeInfo.color}">
        <span class="ptit-mode-icon">${modeInfo.icon}</span>
        <span class="ptit-mode-name">${modeInfo.name}</span>
      </div>
      <div class="ptit-chat-messages" id="ptit-chat-messages">
        <div class="ptit-msg ptit-msg-bot">
          <img class="ptit-avatar" src="${chrome.runtime.getURL('icon.png')}" alt="Bot">
          <div class="ptit-bubble ptit-bubble-bot">
            ${greeting}
          </div>
        </div>
      </div>
      <form class="ptit-chat-form" id="ptit-chat-form">
        <input type="text" id="ptit-chat-input" placeholder="${getInputPlaceholder()}" autocomplete="off">
        <button type="submit" id="ptit-send-btn">➤</button>
      </form>
    `;
    document.body.appendChild(container);
  }

  function getGreetingMessage() {
    if (userType === "teacher") {
      return `Xin chào <strong>${userName}</strong>! Mình là trợ lý hỗ trợ nghiệp vụ của PTIT. Thầy/Cô có thể hỏi mình về các quy trình, nghiệp vụ, hoặc bất kỳ vấn đề nào cần hỗ trợ.`;
    }

    if (currentMode === "exam") {
      return `Xin chào <strong>${userName}</strong>! Bạn đang ở chế độ <strong>Thực hành</strong>. Mình sẽ giúp bạn hiểu đề bài nhưng không đưa code trực tiếp.`;
    }

    return `Xin chào <strong>${userName}</strong>! Bạn đang ở chế độ <strong>Luyện tập</strong>. Mình có thể hỗ trợ đầy đủ và giúp bạn giải bài tập.`;
  }

  function getInputPlaceholder() {
    if (userType === "teacher") {
      return "Nhập câu hỏi về nghiệp vụ...";
    }
    return "Nhập câu hỏi...";
  }

  function bindEvents() {
    const toggleBtn = document.getElementById("ptit-chat-toggle");
    const minimizeBtn = document.getElementById("ptit-minimize-btn");
    const clearBtn = document.getElementById("ptit-clear-btn");
    const form = document.getElementById("ptit-chat-form");

    toggleBtn.addEventListener("click", expandChat);
    minimizeBtn.addEventListener("click", collapseChat);
    clearBtn.addEventListener("click", clearHistory);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("ptit-chat-input");
      const text = input.value.trim();
      if (text) {
        await sendMessage(text);
        input.value = "";
      }
    });

    setupUrlChangeListener();
  }

  function setupUrlChangeListener() {
    window.addEventListener("popstate", handleUrlChange);

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function() {
      originalPushState.apply(this, arguments);
      handleUrlChange();
    };

    history.replaceState = function() {
      originalReplaceState.apply(this, arguments);
      handleUrlChange();
    };

    setupTimeleftObserver();
  }

  function setupTimeleftObserver() {
    const checkInterval = setInterval(() => {
      const newMode = detectMode();
      if (newMode !== currentMode) {
        handleModeChange(newMode);
      }
    }, 2000);

    setTimeout(() => clearInterval(checkInterval), 60000);
  }

  function handleUrlChange() {
    const newMode = detectMode();
    if (newMode !== currentMode) {
      handleModeChange(newMode);
    }
  }

  async function handleModeChange(newMode) {
    const oldMode = currentMode;
    currentMode = newMode;

    clearChatOnModeChange(oldMode, newMode);

    updateModeBadge();

    if (newMode === 'exam' || newMode === 'teacher') {
      updateStatus(true);
    } else if (newMode === 'practice') {
      const hasApiKey = await checkUserApiKey();
      if (hasApiKey) {
        await getToken();
      } else {
        updateStatus(false);
      }
    }
  }

  function clearChatOnModeChange(oldMode, newMode) {
    conversationHistory = [];

    localStorage.removeItem("ptit-chat-content");

    const messagesEl = document.getElementById("ptit-chat-messages");
    if (messagesEl) {
      const modeInfo = getModeInfo();
      const greeting = getGreetingMessage();

      messagesEl.innerHTML = `
        <div class="ptit-mode-change-notice">
          Đã chuyển sang chế độ: <strong>${modeInfo.name}</strong>
          <br><small>Lịch sử trò chuyện đã được xóa</small>
        </div>
        <div class="ptit-msg ptit-msg-bot">
          <img class="ptit-avatar" src="${chrome.runtime.getURL('icon.png')}" alt="Bot">
          <div class="ptit-bubble ptit-bubble-bot">
            ${greeting}
          </div>
        </div>
      `;
    }
  }

  function updateModeBadge() {
    const badge = document.getElementById("ptit-mode-badge");
    if (badge) {
      const modeInfo = getModeInfo();
      badge.style.background = modeInfo.color;
      badge.innerHTML = `
        <span class="ptit-mode-icon">${modeInfo.icon}</span>
        <span class="ptit-mode-name">${modeInfo.name}</span>
      `;
    }
  }

  async function expandChat() {
    if (isChatExpanded) return;
    isChatExpanded = true;

    const toggleBtn = document.getElementById("ptit-chat-toggle");
    const container = document.getElementById("ptit-chatbot-container");

    toggleBtn.style.display = "none";
    container.classList.add("ptit-expanded");

    if (currentMode === 'exam' || currentMode === 'teacher') {
      updateStatus(true);
      console.log("Mode", currentMode, "- Using shared API keys");
    } else {
      const hasApiKey = await checkUserApiKey();
      if (hasApiKey) {
        await getToken();
      } else {
        showApiKeyPopup();
      }
    }

    document.getElementById("ptit-chat-input").focus();
  }

  function collapseChat() {
    isChatExpanded = false;

    const toggleBtn = document.getElementById("ptit-chat-toggle");
    const container = document.getElementById("ptit-chatbot-container");

    toggleBtn.style.display = "flex";
    container.classList.remove("ptit-expanded");

    releaseToken();
    token = null;
  }

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

  async function getToken() {
    try {
      const res = await fetch(`${API_BASE_URL}/get-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentCode })
      });
      const data = await res.json();
      token = data.token;
      updateStatus(true);
      console.log("Token received:", token);
    } catch (error) {
      console.error("Get token failed:", error);
      updateStatus(false);
      addBotMessage("Không thể kết nối server. Vui lòng kiểm tra backend.");
    }
  }

  async function releaseToken() {
    if (!token) return;
    try {
      await fetch(`${API_BASE_URL}/release-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, studentCode }),
        keepalive: true
      });
    } catch (e) {
      console.warn("Release token error:", e);
    }
  }

  function updateStatus(connected) {
    const status = document.getElementById("ptit-status");
    if (status) {
      status.textContent = connected ? "🟢" : "🔴";
      status.title = connected ? "Đã kết nối" : "Chưa kết nối";
    }
  }

  async function sendMessage(text) {
    const input = document.getElementById("ptit-chat-input");
    const sendBtn = document.getElementById("ptit-send-btn");

    if (currentMode === 'practice' && !token) {
      addBotMessage("Chế độ Luyện tập cần API key. Vui lòng nhập API key của bạn.");
      showApiKeyPopup();
      return;
    }

    input.disabled = true;
    sendBtn.disabled = true;

    addUserMessage(text);

    let finalPrompt = text;
    if (userType === "student" && currentMode === "exam" && isQuestionPage()) {
      const problem = extractProblem();
      if (problem.description) {
        finalPrompt = buildContextPrompt(problem, text);
        addContextInfo("Đã đọc thông tin đề bài...");
      }
    }

    let mode = currentMode;

    const typingId = addTyping();

    try {
      conversationHistory.push({ role: "user", parts: [{ text: finalPrompt }] });

      const res = await fetch(`${API_BASE_URL}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          token,
          history: conversationHistory.slice(0, -1),
          mode: mode
        })
      });

      removeTyping(typingId);

      if (!res.ok) {
        conversationHistory.pop();
        const err = await res.json().catch(() => ({}));
        if (res.status === 429 || res.status === 403 || res.status === 400) {
          showApiKeyPopup(true, err.error || "API key có vấn đề");
        }
        throw new Error(err.error || `Error ${res.status}`);
      }

      const data = await res.json();
      const reply = data.reply || "Không có phản hồi.";

      conversationHistory.push({ role: "model", parts: [{ text: reply }] });
      addBotMessage(reply, true);
      saveChat();

    } catch (error) {
      removeTyping(typingId);
      conversationHistory.pop();
      addBotMessage(`Lỗi: ${error.message}`);
    }

    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  }

  function isQuestionPage() {
    return window.location.href.includes('/student/question/');
  }

  function extractProblem() {
    const getText = (selectors) => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim().length > 10) return el.innerText.trim();
      }
      return "";
    };

    return {
      nav: getText(SELECTORS.problem.nav),
      description: getText(SELECTORS.problem.description),
      requirements: getText(SELECTORS.problem.requirements),
      constraints: getText(SELECTORS.problem.constraints),
      examples: getText(SELECTORS.problem.examples)
    };
  }

  function buildContextPrompt(problem, userText) {
    const parts = ["[THÔNG TIN BÀI TẬP]"];
    if (problem.nav) parts.push(`Tiêu đề: ${problem.nav}`);
    if (problem.description) parts.push(`Đề bài: ${problem.description}`);
    if (problem.requirements) parts.push(`Yêu cầu: ${problem.requirements}`);
    if (problem.constraints) parts.push(`Ràng buộc: ${problem.constraints}`);
    if (problem.examples) parts.push(`Ví dụ: ${problem.examples}`);
    parts.push("[KẾT THÚC THÔNG TIN BÀI TẬP]\n");
    parts.push(userText);
    return parts.join("\n");
  }

  function addUserMessage(text) {
    const messagesEl = document.getElementById("ptit-chat-messages");
    const div = document.createElement("div");
    div.className = "ptit-msg ptit-msg-user";
    div.innerHTML = `<div class="ptit-bubble ptit-bubble-user">${escapeHtml(text)}</div>`;
    messagesEl.appendChild(div);
    scrollToBottom();
  }

  function addBotMessage(text, scrollToTop = false) {
    const messagesEl = document.getElementById("ptit-chat-messages");
    const div = document.createElement("div");
    div.className = "ptit-msg ptit-msg-bot";
    div.innerHTML = `
      <img class="ptit-avatar" src="${chrome.runtime.getURL('icon.png')}" alt="Bot">
      <div class="ptit-bubble ptit-bubble-bot">${formatMessage(text)}</div>
    `;
    messagesEl.appendChild(div);

    if (scrollToTop) {
      setTimeout(() => div.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } else {
      scrollToBottom();
    }
  }

  function addContextInfo(text) {
    const messagesEl = document.getElementById("ptit-chat-messages");
    const div = document.createElement("div");
    div.className = "ptit-context-info";
    div.textContent = text;
    messagesEl.appendChild(div);
  }

  function addTyping() {
    const id = "typing-" + Date.now();
    const messagesEl = document.getElementById("ptit-chat-messages");
    const div = document.createElement("div");
    div.className = "ptit-msg ptit-msg-bot";
    div.id = id;
    div.innerHTML = `
      <img class="ptit-avatar" src="${chrome.runtime.getURL('icon.png')}" alt="Bot">
      <div class="ptit-bubble ptit-bubble-bot">
        <div class="ptit-typing"><span></span><span></span><span></span></div>
      </div>
    `;
    messagesEl.appendChild(div);
    scrollToBottom();
    return id;
  }

  function removeTyping(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function scrollToBottom() {
    const messagesEl = document.getElementById("ptit-chat-messages");
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function formatMessage(text) {
    text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    text = text.replace(/\[VIDEO:([^\]]+)\]\(([^)]+)\)/g, (match, title, url) => {
      const videoId = extractYouTubeId(url);
      if (videoId) {
        const thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        return `
          <a href="${url}" target="_blank" class="ptit-video-preview">
            <div class="ptit-video-thumbnail">
              <img src="${thumbnail}" alt="${title}">
              <div class="ptit-video-play">▶</div>
            </div>
            <div class="ptit-video-title">${title}</div>
          </a>
        `;
      }
      return `<a href="${url}" target="_blank">${title}</a>`;
    });

    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    text = text.replace(/(?<!href="|">)(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>');

    text = text.replace(/\n/g, '<br>');
    return text;
  }

  function extractYouTubeId(url) {
    const patterns = [
      /youtube\.com\/live\/([^?&]+)/,
      /youtube\.com\/watch\?v=([^&]+)/,
      /youtu\.be\/([^?&]+)/,
      /youtube\.com\/embed\/([^?&]+)/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function saveChat() {
    const messagesEl = document.getElementById("ptit-chat-messages");
    localStorage.setItem("ptit-chat-content", JSON.stringify({
      html: messagesEl.innerHTML,
      history: conversationHistory
    }));
  }

  function loadChat() {
    const saved = localStorage.getItem("ptit-chat-content");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        const messagesEl = document.getElementById("ptit-chat-messages");
        if (data.html) {
          messagesEl.innerHTML = data.html;
          messagesEl.querySelectorAll('.ptit-avatar').forEach(img => {
            img.src = chrome.runtime.getURL('icon.png');
          });
        }
        if (data.history) conversationHistory = data.history;
      } catch (e) {
        console.error("Load chat error:", e);
      }
    }
  }

  function clearHistory() {
    if (!confirm("Xóa toàn bộ lịch sử?")) return;
    conversationHistory = [];
    const messagesEl = document.getElementById("ptit-chat-messages");
    const greeting = getGreetingMessage();
    messagesEl.innerHTML = `
      <div class="ptit-msg ptit-msg-bot">
        <img class="ptit-avatar" src="${chrome.runtime.getURL('icon.png')}" alt="Bot">
        <div class="ptit-bubble ptit-bubble-bot">
          ${greeting}
        </div>
      </div>
    `;
    localStorage.removeItem("ptit-chat-content");
  }

  function showApiKeyPopup(isUpdate = false, errorMsg = "") {
    const existing = document.getElementById("ptit-api-popup");
    if (existing) existing.remove();

    const popup = document.createElement("div");
    popup.id = "ptit-api-popup";
    popup.innerHTML = `
      <div class="ptit-api-popup-content">
        <h3>${isUpdate ? 'Cập nhật' : 'Cấu hình'} API Key</h3>
        <p>Truy cập <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a> để lấy API key</p>
        ${errorMsg ? `<div class="ptit-api-error">${errorMsg}</div>` : ''}
        <input type="text" id="ptit-api-input" placeholder="Nhập Gemini API key...">
        <div id="ptit-api-msg"></div>
        <div class="ptit-api-btns">
          ${!isUpdate ? '<button id="ptit-api-cancel">Hủy</button>' : ''}
          <button id="ptit-api-save" class="primary">${isUpdate ? 'Cập nhật' : 'Lưu'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(popup);

    const apiInput = document.getElementById("ptit-api-input");
    const saveBtn = document.getElementById("ptit-api-save");
    const cancelBtn = document.getElementById("ptit-api-cancel");
    const msgDiv = document.getElementById("ptit-api-msg");

    apiInput.focus();

    saveBtn.addEventListener("click", async () => {
      const apiKey = apiInput.value.trim();
      if (!apiKey) {
        msgDiv.textContent = "Vui lòng nhập API key!";
        msgDiv.style.color = "#c62828";
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = "Đang kiểm tra...";

      try {
        const testRes = await fetch(`${API_BASE_URL}/test-api-key`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey })
        });
        const testData = await testRes.json();

        if (!testData.success) {
          msgDiv.textContent = "API key không hợp lệ: " + (testData.message || testData.error);
          msgDiv.style.color = "#c62828";
          saveBtn.disabled = false;
          saveBtn.textContent = isUpdate ? 'Cập nhật' : 'Lưu';
          return;
        }

        await fetch(`${API_BASE_URL}/save-api-key`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentCode, name: userName, apiKey })
        });

        msgDiv.textContent = "Đã lưu thành công!";
        msgDiv.style.color = "#2e7d32";
        setTimeout(() => {
          popup.remove();
          getToken();
        }, 1000);
      } catch (error) {
        msgDiv.textContent = "Lỗi: " + error.message;
        msgDiv.style.color = "#c62828";
        saveBtn.disabled = false;
        saveBtn.textContent = isUpdate ? 'Cập nhật' : 'Lưu';
      }
    });

    if (cancelBtn) cancelBtn.addEventListener("click", () => popup.remove());
  }

  window.addEventListener("beforeunload", releaseToken);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
