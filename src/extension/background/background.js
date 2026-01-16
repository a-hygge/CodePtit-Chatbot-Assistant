chrome.runtime.onInstalled.addListener(() => {
  console.log("PTIT Chatbot Extension đã được cài đặt.");
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getIconUrl") {
    sendResponse({ url: chrome.runtime.getURL("icon.png") });
  }
  return true;
});
