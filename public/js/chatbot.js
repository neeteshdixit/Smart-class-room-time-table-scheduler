const chatbotShell = document.getElementById("chatbotShell");
const chatbotToggleBtn = document.getElementById("chatbotToggleBtn");
const chatbotCloseBtn = document.getElementById("chatbotCloseBtn");
const chatbotPanel = document.getElementById("chatbotPanel");
const chatbotMessages = document.getElementById("chatbotMessages");
const chatbotForm = document.getElementById("chatbotForm");
const chatbotInput = document.getElementById("chatbotInput");
const chatbotSendBtn = document.getElementById("chatbotSendBtn");

function appendChatMessage(role, text) {
  if (!chatbotMessages) return;
  const bubble = document.createElement("div");
  bubble.className = `chatbot-bubble ${role === "user" ? "chatbot-bubble-user" : "chatbot-bubble-bot"}`;
  bubble.textContent = String(text || "").trim();
  chatbotMessages.appendChild(bubble);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

function setChatbotOpen(isOpen) {
  if (!chatbotPanel || !chatbotToggleBtn) return;
  chatbotPanel.classList.toggle("d-none", !isOpen);
  chatbotToggleBtn.setAttribute("aria-expanded", String(Boolean(isOpen)));
  chatbotToggleBtn.textContent = isOpen ? "Assistant Open" : "Ask Assistant";
  if (isOpen && chatbotInput) {
    chatbotInput.focus();
  }
}

async function sendChatMessage(messageText) {
  const trimmed = String(messageText || "").trim();
  if (!trimmed) return;

  appendChatMessage("user", trimmed);
  appendChatMessage("bot", "Typing...");

  chatbotSendBtn.disabled = true;
  chatbotInput.disabled = true;

  try {
    const response = await apiRequest("/chat", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ message: trimmed }),
    });

    const typingBubble = chatbotMessages?.lastElementChild;
    if (typingBubble) {
      typingBubble.remove();
    }
    appendChatMessage("bot", response?.reply || "I could not generate a response. Please try again.");
  } catch (err) {
    const typingBubble = chatbotMessages?.lastElementChild;
    if (typingBubble) {
      typingBubble.remove();
    }
    appendChatMessage("bot", err?.message || "Unable to contact assistant right now.");
  } finally {
    chatbotSendBtn.disabled = false;
    chatbotInput.disabled = false;
    chatbotInput.value = "";
    chatbotInput.focus();
  }
}

if (chatbotShell && chatbotToggleBtn && chatbotPanel && chatbotMessages && chatbotForm && chatbotInput && chatbotSendBtn) {
  setChatbotOpen(false);
  appendChatMessage("bot", "Hi! I can help with faculty setup, subject setup, timetable generation, and fixing errors.");

  chatbotToggleBtn.addEventListener("click", () => {
    const isOpen = chatbotPanel.classList.contains("d-none");
    setChatbotOpen(isOpen);
  });

  if (chatbotCloseBtn) {
    chatbotCloseBtn.addEventListener("click", () => setChatbotOpen(false));
  }

  chatbotForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await sendChatMessage(chatbotInput.value);
  });
}
