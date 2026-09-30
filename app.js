const STORAGE_KEYS = {
  apiKey: "edugenie-gemini-key",
  sessions: "edugenie-sessions",
};

const elements = {
  welcomeView: document.querySelector("#welcome-view"),
  chatView: document.querySelector("#chat-view"),
  welcomeInput: document.querySelector("#welcome-input"),
  chatInput: document.querySelector("#chat-input"),
  welcomeSubject: document.querySelector("#welcome-subject"),
  chatSubject: document.querySelector("#chat-subject"),
  welcomeMode: document.querySelector("#welcome-mode"),
  chatMode: document.querySelector("#chat-mode"),
  messages: document.querySelector("#chat-messages"),
  sessionList: document.querySelector("#session-list"),
  settingsDialog: document.querySelector("#settings-dialog"),
  apiKey: document.querySelector("#api-key"),
  settingsStatus: document.querySelector("#settings-status"),
  connectionCard: document.querySelector("#connection-card"),
  connectionLabel: document.querySelector("#connection-label"),
  toast: document.querySelector("#toast"),
};

let sessions = loadSessions();
let activeSessionId = null;
let isSending = false;
let pendingMessage = null;
let toastTimer;

function loadSessions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.sessions) || "[]");
    return Array.isArray(saved) ? saved.filter((session) => Array.isArray(session.messages)) : [];
  } catch {
    return [];
  }
}

function getApiKey() {
  try {
    return localStorage.getItem(STORAGE_KEYS.apiKey) || "";
  } catch {
    return "";
  }
}

function saveSessions() {
  localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(sessions));
  renderSessionList();
}

function updateConnectionState() {
  const connected = Boolean(getApiKey());
  elements.connectionCard.classList.toggle("connected", connected);
  elements.connectionLabel.textContent = connected ? "Gemini connected" : "Gemini not connected";
}

function createSession() {
  const session = {
    id: crypto.randomUUID(),
    title: "New learning session",
    subject: "General",
    mode: "Tutor",
    messages: [],
    updatedAt: Date.now(),
  };
  sessions.unshift(session);
  activeSessionId = session.id;
  saveSessions();
  return session;
}

function activeSession() {
  return sessions.find((session) => session.id === activeSessionId);
}

function renderSessionList() {
  elements.sessionList.replaceChildren();
  document.querySelector("#history-count").textContent = String(sessions.length);

  if (sessions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-history";
    empty.textContent = "Your conversations will find a home here.";
    elements.sessionList.append(empty);
    return;
  }

  for (const session of sessions.slice(0, 40)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `session-item${session.id === activeSessionId ? " selected" : ""}`;
    button.setAttribute("aria-label", `Open session: ${session.title}`);
    const icon = document.createElement("span");
    icon.textContent = "◷";
    const title = document.createElement("span");
    title.textContent = session.title;
    button.append(icon, title);
    button.addEventListener("click", () => openSession(session.id));
    elements.sessionList.append(button);
  }
}

function openSession(id) {
  activeSessionId = id;
  const session = activeSession();
  if (!session) return;
  elements.welcomeView.classList.add("hidden");
  elements.chatView.classList.remove("hidden");
  document.querySelector("#breadcrumb-current").textContent = session.title;
  elements.chatSubject.value = session.subject || "General";
  elements.chatMode.value = session.mode || "Tutor";
  renderMessages(session);
  renderSessionList();
}

function startNewSession() {
  activeSessionId = null;
  elements.messages.replaceChildren();
  elements.welcomeView.classList.remove("hidden");
  elements.chatView.classList.add("hidden");
  elements.welcomeInput.value = "";
  elements.welcomeSubject.value = "General";
  elements.welcomeMode.value = "Tutor";
  document.querySelector("#breadcrumb-current").textContent = "Learning desk";
  renderSessionList();
  elements.welcomeInput.focus();
}

function appendInlineText(container, value) {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  for (const match of value.matchAll(pattern)) {
    container.append(document.createTextNode(value.slice(lastIndex, match.index)));
    const token = match[0];
    const node = token.startsWith("`") ? document.createElement("code") : document.createElement(token.startsWith("**") ? "strong" : "em");
    node.textContent = token.startsWith("**") ? token.slice(2, -2) : token.slice(1, -1);
    container.append(node);
    lastIndex = match.index + token.length;
  }
  container.append(document.createTextNode(value.slice(lastIndex)));
}

function renderMarkdown(text, container) {
  const lines = text.replace(/\r/g, "").split("\n");
  let paragraph = [];
  let list = null;
  let codeLines = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const node = document.createElement("p");
    appendInlineText(node, paragraph.join(" "));
    container.append(node);
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    container.append(list);
    list = null;
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      flushParagraph();
      flushList();
      if (codeLines) {
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        code.textContent = codeLines.join("\n");
        pre.append(code);
        container.append(pre);
        codeLines = null;
      } else {
        codeLines = [];
      }
      continue;
    }
    if (codeLines) {
      codeLines.push(line);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const node = document.createElement(heading[1].length === 1 ? "h2" : "h3");
      appendInlineText(node, heading[2]);
      container.append(node);
      continue;
    }
    const listItem = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      const ordered = /^\s*\d+\./.test(line);
      if (!list || list.tagName !== (ordered ? "OL" : "UL")) {
        flushList();
        list = document.createElement(ordered ? "ol" : "ul");
      }
      const item = document.createElement("li");
      appendInlineText(item, listItem[1]);
      list.append(item);
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      const node = document.createElement("blockquote");
      appendInlineText(node, quote[1]);
      container.append(node);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  if (codeLines) {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = codeLines.join("\n");
    pre.append(code);
    container.append(pre);
  }
}

function renderMessages(session) {
  elements.messages.replaceChildren();
  for (const message of session.messages) {
    const row = document.createElement("article");
    row.className = `message ${message.role === "user" ? "user-message" : "assistant-message"}`;
    if (message.role === "user") {
      const body = document.createElement("div");
      body.className = "message-body";
      body.textContent = message.text;
      row.append(body);
    } else {
      const avatar = document.createElement("span");
      avatar.className = "message-avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = "e";
      const body = document.createElement("div");
      body.className = "message-body";
      const meta = document.createElement("div");
      meta.className = "message-meta";
      meta.textContent = "EduGenie";
      body.append(meta);
      renderMarkdown(message.text, body);
      row.append(avatar, body);
    }
    elements.messages.append(row);
  }
  elements.messages.scrollTop = elements.messages.scrollHeight;
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

function addTypingIndicator() {
  const row = document.createElement("div");
  row.className = "message assistant-message typing-message";
  row.setAttribute("aria-label", "EduGenie is thinking");
  const avatar = document.createElement("span");
  avatar.className = "message-avatar";
  avatar.textContent = "e";
  avatar.setAttribute("aria-hidden", "true");
  const dots = document.createElement("div");
  dots.className = "typing-dots";
  dots.innerHTML = "<span></span><span></span><span></span>";
  row.append(avatar, dots);
  elements.messages.append(row);
  row.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function buildSystemInstruction(session) {
  const modeGuidance = {
    Tutor: "Be a patient, encouraging tutor. Help the learner reason their way to understanding; explain step by step and invite them to think, instead of simply doing their homework for them.",
    "Explain simply": "Explain ideas in clear, everyday language as if to a curious beginner. Use one concrete analogy, define any necessary terms, and build up complexity gradually.",
    "Quiz me": "Act as a friendly quizmaster. Ask exactly one question at a time, wait for the learner's answer, then explain the answer and continue with the next question. Start by asking a relevant question.",
    "Study plan": "Create a realistic, encouraging study plan with small timed steps, breaks, and a brief review. Ask one clarifying question only if essential; otherwise make reasonable assumptions explicit.",
  };
  return `You are EduGenie, a warm and thoughtful learning assistant. The learner's subject is ${session.subject}. ${modeGuidance[session.mode] || modeGuidance.Tutor} Adapt to the learner's level, explain jargon, and be honest when uncertain. Use readable Markdown where useful. Do not claim to be a human teacher.`;
}

function friendlyApiError(error, status) {
  if (status === 400 || status === 403) return "Google rejected this request. Check that your API key is correct and that Gemini API access is enabled for it.";
  if (status === 429) return "Gemini is receiving too many requests right now. Wait a moment and try again.";
  if (status === 404) return "The Gemini model could not be found. Check the model or API version in the request.";
  if (error instanceof TypeError) return "Could not reach Gemini. Check your internet connection and try again.";
  return error.message || "Something went wrong while contacting Gemini. Please try again.";
}

async function askGemini(session) {
  const apiKey = getApiKey();
  const contents = session.messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.text }],
  }));
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemInstruction(session) }] },
      contents,
      generationConfig: { temperature: 0.65, maxOutputTokens: 2048 },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiMessage = data.error?.message;
    throw Object.assign(new Error(apiMessage || friendlyApiError(new Error(), response.status)), { status: response.status });
  }
  const answer = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
  if (!answer) throw new Error("Gemini returned an empty response. Try asking in a different way.");
  return answer;
}

async function sendMessage(rawText, subject, mode) {
  const text = rawText.trim();
  if (!text || isSending) return;

  if (!getApiKey()) {
    pendingMessage = { text, subject, mode, input: activeSession() ? elements.chatInput : elements.welcomeInput };
    elements.apiKey.value = "";
    elements.settingsStatus.textContent = "Connect a Gemini API key to start your learning session.";
    elements.settingsDialog.showModal();
    elements.apiKey.focus();
    return;
  }

  let session = activeSession();
  if (!session) session = createSession();
  session.subject = subject;
  session.mode = mode;
  session.messages.push({ role: "user", text });
  if (session.messages.length === 1) session.title = text.length > 42 ? `${text.slice(0, 39).trimEnd()}…` : text;
  session.updatedAt = Date.now();
  elements.chatSubject.value = subject;
  elements.chatMode.value = mode;
  elements.welcomeView.classList.add("hidden");
  elements.chatView.classList.remove("hidden");
  document.querySelector("#breadcrumb-current").textContent = session.title;
  renderMessages(session);
  saveSessions();

  isSending = true;
  document.querySelectorAll(".send-button").forEach((button) => { button.disabled = true; });
  addTypingIndicator();
  try {
    const answer = await askGemini(session);
    session.messages.push({ role: "assistant", text: answer });
  } catch (error) {
    const safeMessage = friendlyApiError(error, error.status);
    session.messages.push({ role: "assistant", text: `**A quick connection hiccup.** ${safeMessage}\n\nYour question is saved above. Once Gemini is ready, send it again.` });
  } finally {
    isSending = false;
    document.querySelectorAll(".send-button").forEach((button) => { button.disabled = false; });
    document.querySelector(".typing-message")?.remove();
    session.updatedAt = Date.now();
    saveSessions();
    renderMessages(session);
  }
}

function handleComposer(input, subjectSelect, modeSelect) {
  const text = input.value;
  if (!text.trim() || isSending) return;
  input.value = "";
  input.style.height = "";
  sendMessage(text, subjectSelect.value, modeSelect.value);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function openSettings() {
  elements.apiKey.value = getApiKey();
  elements.settingsStatus.textContent = "";
  elements.settingsDialog.showModal();
}

document.querySelector("#new-chat").addEventListener("click", startNewSession);
document.querySelector("#open-settings").addEventListener("click", openSettings);
document.querySelector("#top-settings").addEventListener("click", openSettings);
document.querySelector("#profile-settings").addEventListener("click", openSettings);
document.querySelector("#learn-nav").addEventListener("click", startNewSession);
document.querySelector("#history-nav").addEventListener("click", () => {
  if (sessions.length) openSession(sessions[0].id);
  else showToast("Your recent sessions will appear here.");
});

document.querySelector("#welcome-send").addEventListener("click", () => handleComposer(elements.welcomeInput, elements.welcomeSubject, elements.welcomeMode));
document.querySelector("#chat-send").addEventListener("click", () => handleComposer(elements.chatInput, elements.chatSubject, elements.chatMode));

for (const [input, subject, mode] of [
  [elements.welcomeInput, elements.welcomeSubject, elements.welcomeMode],
  [elements.chatInput, elements.chatSubject, elements.chatMode],
]) {
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleComposer(input, subject, mode);
    }
  });
  input.addEventListener("input", () => {
    if (input === elements.chatInput) {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 130)}px`;
    }
  });
}

document.querySelectorAll(".suggestion").forEach((button) => {
  button.addEventListener("click", () => {
    const subject = button.dataset.subject || "General";
    const mode = button.dataset.mode || "Tutor";
    elements.welcomeSubject.value = subject;
    elements.welcomeMode.value = mode;
    elements.welcomeInput.value = button.dataset.prompt;
    elements.welcomeInput.focus();
  });
});

document.querySelector("#toggle-key").addEventListener("click", (event) => {
  const showing = elements.apiKey.type === "text";
  elements.apiKey.type = showing ? "password" : "text";
  event.currentTarget.textContent = showing ? "Show" : "Hide";
  event.currentTarget.setAttribute("aria-label", showing ? "Show API key" : "Hide API key");
});

document.querySelector("#save-key").addEventListener("click", () => {
  const key = elements.apiKey.value.trim();
  if (!key) {
    elements.settingsStatus.textContent = "Paste a Gemini API key to connect.";
    elements.apiKey.focus();
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEYS.apiKey, key);
    updateConnectionState();
    elements.settingsStatus.textContent = "";
    elements.settingsDialog.close();
    showToast("Gemini connected. Ready when you are.");
    if (pendingMessage) {
      const queuedMessage = pendingMessage;
      pendingMessage = null;
      queuedMessage.input.value = "";
      sendMessage(queuedMessage.text, queuedMessage.subject, queuedMessage.mode);
    }
  } catch {
    elements.settingsStatus.textContent = "Your browser could not save this key. Check your local storage settings.";
  }
});

document.querySelector("#remove-key").addEventListener("click", () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.apiKey);
  } catch {
    elements.settingsStatus.textContent = "Your browser could not remove the saved key.";
    return;
  }
  elements.apiKey.value = "";
  elements.settingsStatus.textContent = "";
  updateConnectionState();
  elements.settingsDialog.close();
  showToast("Gemini key removed from this browser.");
});

elements.settingsDialog.addEventListener("click", (event) => {
  if (event.target === elements.settingsDialog) elements.settingsDialog.close();
});
elements.settingsDialog.addEventListener("close", () => {
  if (!pendingMessage) return;
  pendingMessage.input.value = pendingMessage.text;
  pendingMessage = null;
});

renderSessionList();
updateConnectionState();