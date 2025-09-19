// Side Navigation JS Code
let menuBtn = document.querySelector(".menu-btn");
let cancelBtn = document.querySelector(".cancel-btn");
let navBar = document.querySelector(".navbar");
let body = document.querySelector("body");


menuBtn.onclick = function(){
    menuBtn.style.opacity = "0";
    menuBtn.style.pointerEvents = "none";
    navBar.classList.add("active");
    body.style.overflow = "hidden";
}
cancelBtn.onclick = function(){
    menuBtn.style.opacity = "1";
    menuBtn.style.pointerEvents = "auto";
    navBar.classList.remove("active");
    body.style.overflow = "auto";
}

// Sticky Navigation Menu JS Code
let val;
let nav = document.querySelector("nav");
window.onscroll = function() {
    if(document.documentElement.scrollTop > 20){
        nav.classList.add("sticky");
    }else{
        nav.classList.remove("sticky");
    }
}

// Side Navgetion Closed When Clicked
let navLinks = document.querySelectorAll(".menu li a");
for (var i = 0; i < navLinks.length; i++) {
    navLinks[i].addEventListener("click" , ()=>{
    menuBtn.style.opacity = "1";
    menuBtn.style.pointerEvents = "auto";
    navBar.classList.remove("active");
    body.style.overflow = "auto";
    });
}


// ===== Chat Modal + Bot Wiring =====
(function () {
  const overlay = document.getElementById('chatOverlay');        
  if (!overlay) return; 

  function ensureClientId() {
  let id = localStorage.getItem('clientId');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random());
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
  }
  function closeChat() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocused) lastFocused.focus();
  }

  // UI helpers
  function appendMessage(text, who = 'bot') {
    const bubble = document.createElement('div');
    bubble.className = `msg ${who}`;
    bubble.textContent = text;
    chatBody.appendChild(bubble);
    chatBody.scrollTop = chatBody.scrollHeight;
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

  // NEW: רינדור בועות הצעה
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
      // אם תרצה לשלוח אוטומטית:
      // handleSend();
    });
    wrap.appendChild(btn);
  });

  suggestionsBox.appendChild(wrap);
}

  async function askBot(userText) {
    try {
        const res = await fetch('/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: userText, clientId: ensureClientId() })
            });
        if (res.ok) {
            const data = await res.json();
        if (Array.isArray(data.suggestions)) {
            renderSuggestions(data.suggestions);
          } else {
            renderSuggestions([]);
          }
        if (data && typeof data.answer === 'string' && data.answer.trim()) {
            return data.answer.trim();
          }
        }
    } catch (_) { /* ניפול לפתרון המקומי */ }

    return "לא מצאתי תשובה כרגע, נסה לנסח אחרת 🙂";
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

  // : איפוס שיחה
  async function resetConversation() {
  const clientId = ensureClientId();
  await fetch('/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId })
  });
  chatBody.innerHTML = '';
  renderSuggestions([]);
  appendMessage('התחלנו שיחה חדשה ✨', 'bot');
  }
  if (resetBtn) resetBtn.addEventListener('click', resetConversation);

  openers.forEach(btn => btn.addEventListener('click', openChat));
  if (closeBtn) closeBtn.addEventListener('click', closeChat);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeChat(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeChat();
  });

  if (input && sendBtn) {
    input.addEventListener('input', () => {
      const has = input.value.trim().length > 0;
      sendBtn.disabled = !has;
      sendBtn.classList.toggle('enabled', has);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    });
    sendBtn.addEventListener('click', handleSend);
  }
})();

// שם משתנה שונה
const kbInput = document.querySelector('.chat-input input');
if (kbInput) {
  kbInput.addEventListener('focus', () => {
    setTimeout(() => {
      kbInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 300);
  });
}






