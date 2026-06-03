import './style.css';

// === Dynamic viewport height (shrinks when mobile keyboard opens) ===
function updateAppHeight() {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${h}px`);
}
updateAppHeight();
window.addEventListener('resize', updateAppHeight, { passive: true });
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateAppHeight, { passive: true });
}

// === Navigation ===
const menuBtn = document.querySelector('.menu-btn');
const cancelBtn = document.querySelector('.cancel-btn');
const navBar = document.querySelector('.navbar');
const body = document.querySelector('body');

menuBtn.onclick = function () {
  menuBtn.style.opacity = '0';
  menuBtn.style.pointerEvents = 'none';
  navBar.classList.add('active');
  body.style.overflow = 'hidden';
};
cancelBtn.onclick = function () {
  menuBtn.style.opacity = '1';
  menuBtn.style.pointerEvents = 'auto';
  navBar.classList.remove('active');
  body.style.overflow = 'auto';
};

// Sticky navigation
const nav = document.querySelector('nav');
window.onscroll = function () {
  if (document.documentElement.scrollTop > 20) {
    nav.classList.add('sticky');
  } else {
    nav.classList.remove('sticky');
  }
};

// Close side nav when a menu link is clicked
const navLinks = document.querySelectorAll('.menu li a');
for (let i = 0; i < navLinks.length; i++) {
  navLinks[i].addEventListener('click', () => {
    menuBtn.style.opacity = '1';
    menuBtn.style.pointerEvents = 'auto';
    navBar.classList.remove('active');
    body.style.overflow = 'auto';
  });
}

// === Backend URL ===
// Vite replaces import.meta.env.VITE_* at build time with the value from .env.local / CI secret.
// Empty string → same-origin (only happens in local dev where Express serves both).
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

// 'checking' while the /health ping is in flight, 'ready' on success, 'offline' on timeout/error.
// If there is no separate backend (local dev), we skip the ping and go straight to 'ready'.
let backendState = !API_BASE ? 'ready' : 'checking';
const backendReadyCallbacks = [];

// === Wake up the Render backend in the background ===
// Fires once on page load. Purpose: trigger Render's cold-start early so the backend is
// (hopefully) warm by the time the user opens the chat.
// Does NOT block page render. Does NOT show any error if the backend is asleep.
(async function wakeBackend() {
  if (!API_BASE) return;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${API_BASE}/health`, { method: 'GET', signal: controller.signal });
    clearTimeout(timeoutId);
    backendState = res.ok ? 'ready' : 'offline';
  } catch {
    backendState = 'offline';
  }
  backendReadyCallbacks.forEach(cb => cb());
  backendReadyCallbacks.length = 0;
})();

// ===== Chat Modal + Bot Wiring =====
(function () {
  const overlay = document.getElementById('chatOverlay');
  if (!overlay) return;

  function ensureClientId() {
    let id = localStorage.getItem('clientId');
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random();
      localStorage.setItem('clientId', id);
    }
    return id;
  }

  const openers = document.querySelectorAll('.open-chat-btn');
  const closeBtn = overlay.querySelector('[data-close-chat]');
  const chatBody = overlay.querySelector('.chat-body');
  const input = overlay.querySelector('.chat-input input');
  const sendBtn = overlay.querySelector('.send-btn');
  const suggestionsBox = overlay.querySelector('.chat-suggestions');
  const resetBtn = overlay.querySelector('[data-reset-chat]');
  let lastFocused = null;
  let typingEl = null;

  function openChat() {
    lastFocused = document.activeElement;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => input && input.focus(), 60);
    if (chatBody.children.length === 0) showInitialGreeting();
  }
  function closeChat() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocused) lastFocused.focus();
  }

  function appendMessage(text, who = 'bot') {
    const bubble = document.createElement('div');
    bubble.className = `msg ${who}`;
    bubble.textContent = text;
    chatBody.appendChild(bubble);
    chatBody.scrollTop = chatBody.scrollHeight;
    return bubble;
  }

  const GREETING = 'היי, תשאל אותי כל מה שתרצה עלי, על הפרוייקטים שעשיתי ואפילו שאלות כלליות';

  function showInitialGreeting() {
    if (backendState === 'checking') {
      // Backend ping still in flight — show a waiting message and swap it to the
      // real greeting once the ping resolves (success or timeout).
      const waitEl = appendMessage('⏳ רגע אחד, הבוט מתעורר...', 'bot');
      backendReadyCallbacks.push(() => { waitEl.textContent = GREETING; });
    } else {
      appendMessage(GREETING, 'bot');
    }
  }

  function setTyping(on) {
    if (on) {
      if (typingEl) return;
      typingEl = document.createElement('div');
      typingEl.className = 'msg bot';
      typingEl.textContent = 'Typing…';
      typingEl.style.opacity = '0.7';
      chatBody.appendChild(typingEl);
      chatBody.scrollTop = chatBody.scrollHeight;
    } else {
      if (typingEl) {
        typingEl.remove();
        typingEl = null;
      }
    }
  }

  function renderSuggestions(items = []) {
    if (!suggestionsBox) return;
    suggestionsBox.innerHTML = '';
    if (!items.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'suggestions-wrap';
    items.forEach(txt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'suggestion-chip';
      btn.textContent = txt;
      btn.addEventListener('click', () => {
        input.value = txt;
        sendBtn.disabled = false;
        sendBtn.classList.add('enabled');
      });
      wrap.appendChild(btn);
    });
    suggestionsBox.appendChild(wrap);
  }

  async function askBot(userText) {
    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userText, clientId: ensureClientId() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.suggestions)) renderSuggestions(data.suggestions);
        else renderSuggestions([]);
        if (data && typeof data.answer === 'string' && data.answer.trim()) {
          return data.answer.trim();
        }
      }
    } catch {
      // Network error — backend is likely sleeping (Render free tier cold start)
      return 'הבוט מתעורר... אנא נסה שוב בעוד כמה שניות 😴';
    }
    return 'לא מצאתי תשובה כרגע, נסה לנסח אחרת 🙂';
  }

  async function handleSend() {
    const text = (input.value || '').trim();
    if (!text) return;

    sendBtn.disabled = true;
    sendBtn.classList.remove('enabled');
    appendMessage(text, 'user');
    input.value = '';
    input.focus();

    setTyping(true);
    renderSuggestions([]);
    const reply = await askBot(text);
    setTyping(false);
    appendMessage(reply, 'bot');

    sendBtn.disabled = !input.value.trim();
    if (input.value.trim()) sendBtn.classList.add('enabled');
  }

  async function resetConversation() {
    const clientId = ensureClientId();
    await fetch(`${API_BASE}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId }),
    });
    chatBody.innerHTML = '';
    renderSuggestions([]);
    appendMessage('התחלנו שיחה חדשה ✨', 'bot');
  }
  if (resetBtn) resetBtn.addEventListener('click', resetConversation);

  openers.forEach(btn =>
    btn.addEventListener('click', e => {
      e.preventDefault();
      openChat();
    })
  );
  if (closeBtn) closeBtn.addEventListener('click', closeChat);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeChat(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeChat();
  });

  if (input && sendBtn) {
    input.addEventListener('input', () => {
      const has = input.value.trim().length > 0;
      sendBtn.disabled = !has;
      sendBtn.classList.toggle('enabled', has);
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    });
    sendBtn.addEventListener('click', handleSend);
  }
})();

// Auto-hide scrollbar
let scrollHideTimer;
window.addEventListener('scroll', () => {
  document.documentElement.classList.add('is-scrolling');
  clearTimeout(scrollHideTimer);
  scrollHideTimer = setTimeout(() => {
    document.documentElement.classList.remove('is-scrolling');
  }, 1000);
}, { passive: true });

// 3D card tilt — desktop (pointer: fine) only
if (window.matchMedia('(pointer: fine)').matches) {
  document.querySelectorAll('.projects .boxes .box').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const rotX = ((y - cy) / cy) * -10;
      const rotY = ((x - cx) / cx) * 10;
      card.style.transform = `perspective(700px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.03,1.03,1.03)`;
      card.style.setProperty('--mx', `${(x / rect.width) * 100}%`);
      card.style.setProperty('--my', `${(y / rect.height) * 100}%`);
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

// 360° spin on click — all project cards
document.querySelectorAll('.projects .boxes .box').forEach(card => {
  card.addEventListener('click', e => {
    if (e.target.closest('.project-link')) return;
    if (card.classList.contains('card-spin')) return;
    card.style.transform = '';
    card.classList.add('card-spin');
    card.addEventListener('animationend', () => {
      card.classList.remove('card-spin');
    }, { once: true });
  });
});
