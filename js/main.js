/*
   main.js — Portfolio Scripts
   Sections:
     1. Mobile nav & theme toggle
     2. Active nav link on scroll
     3. Project rows — scroll triggered animations
     4. Chat with my CV widget (CV context + projects fetched live from Supabase)
*/


/* 
   1. MOBILE NAV TOGGLE
 */

const menuBtn    = document.getElementById('menuBtn');
const mobileMenu = document.getElementById('mobileMenu');

if (menuBtn) {
  menuBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
  });
  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => mobileMenu.classList.add('hidden'));
  });
}

const themeToggle = document.getElementById('themeToggle');
const themeIcon   = document.querySelector('.theme-icon');
const storedTheme = localStorage.getItem('theme');

function applyTheme(theme) {
  document.body.classList.toggle('dark', theme === 'dark');
  if (themeIcon) themeIcon.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  localStorage.setItem('theme', theme);
}

applyTheme(storedTheme === 'dark' ? 'dark' : 'light');

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const next = document.body.classList.contains('dark') ? 'light' : 'dark';
    applyTheme(next);
  });
}


/*  2. ACTIVE NAV LINK HIGHLIGHT ON SCROLL */

const sections = document.querySelectorAll('section[id], header[id]');
const navLinks  = document.querySelectorAll('a[href^="#"]');

const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(link => {
        link.style.color =
          link.getAttribute('href') === '#' + entry.target.id
            ? '#3d6e5f'
            : '';
      });
    }
  });
}, { threshold: 0.5 });

sections.forEach(section => sectionObserver.observe(section));


/* 
   3. PROJECT ROWS — SCROLL TRIGGERED ANIMATIONS
   Adds .in-view when each row enters viewport,
   triggering all CSS transitions in styles.css */

function initProjectObserver() {
  const projRows = document.querySelectorAll('.proj-row');

  const projObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        projObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -48px 0px'
  });

  projRows.forEach(row => projObserver.observe(row));

  window.addEventListener('scroll', () => {
    projRows.forEach(row => {
      if (!row.classList.contains('in-view')) {
        const rect = row.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.88) {
          row.classList.add('in-view');
        }
      }
    });
  }, { passive: true });
}


/* 
   4. CHAT WITH MY CV WIDGET
   CV context AND projects fetched live from
   Supabase via /api/data on every page load.
   Dashboard edits reflect instantly.
 */

const CHAT_ENDPOINT = '/api/chat';
const DATA_ENDPOINT = '/api/data';

// Fallback used if the API is unreachable
const FALLBACK_CV_CONTEXT = `
CANDIDATE: Camila Michele
ROLE TARGET: Mobile Developer, UI/UX Designer, Full-Stack Developer

PROFILE:
Passionate tech student with strong expertise in mobile development, user interface design,
and dedicated to creating impactful technology solutions. Shown track record of winning
hackathons, building intuitive digital experiences, and leading small teams.

TECHNICAL SKILLS:
- Mobile Development: Flutter, iOS Development, Android Development
- UI/UX Design: Figma, Wireframing, Prototyping, Design Systems
- Frontend Development: HTML/CSS, Flutter
- Backend Development: Firebase, Supabase/PostgreSQL, Django
- Agile Leadership / Scrum Master
- Agile Software Development

AVAILABILITY: Open to internships, collaborations, and exciting new projects.
CONTACT: michelecamila100@gmail.com | +254 759 068 658
`.trim();

let chatHistory = [];
let isTyping    = false;
let cvLoaded    = false;


/*  Boot: fetch CV + projects then init chat  */

async function initChat() {
  try {
    const [cvRes, projRes] = await Promise.all([
      fetch(`${DATA_ENDPOINT}?action=get_cv`),
      fetch(`${DATA_ENDPOINT}?action=get_projects`),
    ]);

    const cvData   = await cvRes.json();
    const projData = await projRes.json();

    const cv       = cvData.cv;
    const projects = projData.projects || [];

    if (cv) {
      const cvContext = buildCvContext(cv, projects);
      chatHistory = [{ role: 'system', content: buildSystemPrompt(cvContext) }];
    } else {
      chatHistory = [{ role: 'system', content: buildSystemPrompt(FALLBACK_CV_CONTEXT) }];
    }
  } catch (err) {
    console.warn('[chat] Could not fetch CV context, using fallback.', err.message);
    chatHistory = [{ role: 'system', content: buildSystemPrompt(FALLBACK_CV_CONTEXT) }];
  }

  cvLoaded = true;
  showChatUI();
}


/*  Build CV context string from Supabase data  */

function buildCvContext(cv, projects) {
  const projectLines = projects.map((p, i) => {
    const lines = [`${i + 1}. ${p.name.toUpperCase()} — ${p.type}`];
    if (p.award)       lines.push(`   Achievement: ${p.award}`);
    if (p.description) lines.push(`   Description: ${p.description}`);
    if (p.stack)       lines.push(`   Stack: ${p.stack}`);
    if (p.link)        lines.push(`   Link: ${p.link}`);
    return lines.join('\n');
  }).join('\n\n');

  return `
CANDIDATE: ${cv.name}
ROLE TARGET: ${cv.role_target}

PROFILE:
${cv.profile}

TECHNICAL SKILLS:
${cv.skills}

SELECTED PROJECTS:

${projectLines || 'No projects listed yet.'}

CONTACT:
Email: ${cv.email}
Phone: ${cv.phone}
GitHub: ${cv.github}
LinkedIn: ${cv.linkedin}

AVAILABILITY: ${cv.availability}
`.trim();
}


/*  Build system prompt  */

function buildSystemPrompt(cvContext) {
  return `You are a helpful AI assistant representing the candidate described in the CV below.
Answer questions about the candidate's skills, projects, experience, and background in a friendly,
professional, and enthusiastic tone. Speak in first person as if you are the candidate.
Keep answers concise (2-4 sentences max unless the question needs more detail).
If asked something not covered in the CV, say you can discuss it in person.
Never make up information not in the CV.

${cvContext}`;
}


/*  Show chat UI  */

function showChatUI() {
  document.getElementById('api-key-prompt').style.display = 'none';
  const ui = document.getElementById('chat-ui');
  if (ui) ui.style.display = 'flex';
}


/*  Panel open / close  */

const bubble = document.getElementById('chat-bubble');
const panel  = document.getElementById('chat-panel');

if (bubble && panel) {
  bubble.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('open');
    bubble.classList.toggle('open', isOpen);
    if (isOpen) {
      setTimeout(() => document.getElementById('chat-input')?.focus(), 300);
    }
  });
}


/*  Send message  */

const input   = document.getElementById('chat-input');
const sendBtn = document.getElementById('chat-send');

if (input) {
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 80) + 'px';
  });
}

if (sendBtn) {
  sendBtn.addEventListener('click', sendMessage);
}

function sendSuggestion(btn) {
  if (!input) return;
  input.value = btn.textContent;
  document.getElementById('suggestions').style.display = 'none';
  sendMessage();
}

async function sendMessage() {
  if (!input) return;
  const text = input.value.trim();
  if (!text || isTyping) return;

  if (!cvLoaded) {
    appendMessage('bot', '⏳ Just a moment, loading my profile…');
    return;
  }

  input.value = '';
  input.style.height = 'auto';
  const suggestionsEl = document.getElementById('suggestions');
  if (suggestionsEl) suggestionsEl.style.display = 'none';

  appendMessage('user', text);
  chatHistory.push({ role: 'user', content: text });

  // Log for dashboard interactions panel
  logInteraction(text);

  showTyping();
  if (sendBtn) sendBtn.disabled = true;
  isTyping = true;

  try {
    const res = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:       'gpt-3.5-turbo',
        messages:    chatHistory,
        temperature: 0.7,
        max_tokens:  300,
      })
    });

    const data = await res.json();

    if (!res.ok) {
      const message = data.error?.message || 'Unable to get a response.';
      hideTyping();
      appendMessage('bot', `⚠️ Error: ${message}`);
    } else {
      const reply = data.choices?.[0]?.message?.content?.trim()
        || "Sorry, I couldn't get a response.";
      chatHistory.push({ role: 'assistant', content: reply });
      hideTyping();
      appendMessage('bot', reply);
    }

  } catch (err) {
    hideTyping();
    appendMessage('bot', '⚠️ Network error. Please try again.');
  }

  if (sendBtn) sendBtn.disabled = false;
  isTyping = false;
}


/*  Interaction logging (readable in dashboard)  */

function logInteraction(question) {
  try {
    const log = JSON.parse(localStorage.getItem('cm_chat_log') || '[]');
    log.push({
      q: question,
      t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    if (log.length > 200) log.splice(0, log.length - 200);
    localStorage.setItem('cm_chat_log', JSON.stringify(log));
  } catch (e) { /* localStorage unavailable — skip */ }
}


/*  DOM helpers  */

function appendMessage(role, text) {
  const msgs = document.getElementById('chat-messages');
  if (!msgs) return;
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.innerHTML = `
    <div class="msg-bubble">${escapeHtml(text)}</div>
    <span class="msg-time">${now}</span>
  `;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function showTyping() {
  const msgs = document.getElementById('chat-messages');
  if (!msgs) return;
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.id = 'typing-msg';
  div.innerHTML = `
    <div class="msg-bubble typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function hideTyping() {
  document.getElementById('typing-msg')?.remove();
}

function escapeHtml(str) {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/\n/g, '<br>');
}


/*
   PROJECTS — fetch from Supabase and render
   into the #projects-container in index.html
 */

async function loadPortfolioProjects() {
  const container = document.getElementById('projects-container');
  if (!container) return; // section not present on this page

  try {
    const res  = await fetch(`${DATA_ENDPOINT}?action=get_projects`);
    const data = await res.json();
    const projects = data.projects || [];

    if (!projects.length) {
      container.innerHTML = '<p style="text-align:center;color:#5a8a7a;padding:40px 0;">No projects yet.</p>';
      return;
    }

    container.innerHTML = projects.map((p, i) => {
      const isReverse  = i % 2 !== 0;
      const bgClass    = getBgClass(p.type, i);
      const imageHtml  = p.image_url
        ? `<img src="${p.image_url}" alt="${escHtml(p.name)} screenshot" class="screen-image">`
        : `<div class="screen-label">${escHtml(p.name)}</div>
           <div class="screen-sub">${escHtml(p.type)}</div>`;

      return `
        <article class="proj-row${isReverse ? ' proj-row--reverse' : ''}">
          <div class="proj-mockup-wrap">
            <div class="proj-mockup">
              <div class="laptop-frame">
                <div class="laptop-screen">
                  <div class="screen-placeholder ${bgClass}">
                    ${imageHtml}
                  </div>
                </div>
                <div class="laptop-base"></div>
                <div class="laptop-foot"></div>
              </div>
            </div>
          </div>
          <div class="proj-info">
            <span class="proj-type">${escHtml(p.type)}</span>
            <h3 class="proj-title">
              ${escHtml(p.name)}
              ${p.award ? `<span class="proj-award">${escHtml(p.award)}</span>` : ''}
            </h3>
            <p class="proj-desc">${escHtml(p.description)}</p>
            ${p.stack ? `<p class="proj-achievement">${escHtml(p.stack)}</p>` : ''}
            ${p.link  ? `<a href="${p.link}" target="_blank" rel="noopener" class="proj-arrow" aria-label="View project">↗</a>` : ''}
          </div>
        </article>
      `;
    }).join('');

    // Re-run the scroll observer now that rows exist in the DOM
    initProjectObserver();

  } catch (err) {
    console.warn('[portfolio] Could not load projects from API, keeping static HTML.', err.message);
    // Static HTML already in the DOM as fallback — just init the observer
    initProjectObserver();
  }
}

function getBgClass(type, index) {
  const classes = ['EduEats-bg', 'intellisecure-bg', 'elaundry-bg', 'jambosec-bg', 'smartmarket-bg'];
  if (!type) return classes[index % classes.length];
  const t = type.toLowerCase();
  if (t.includes('ai') || t.includes('cyber')) return 'intellisecure-bg';
  if (t.includes('mobile'))                    return 'smartmarket-bg';
  return classes[index % classes.length];
}

function escHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


/* 
   KICK OFF
 */

// Fetch projects (renders into #projects-container if it exists)
loadPortfolioProjects();

// Init chat widget (fetches CV + projects for the AI)
initChat();
