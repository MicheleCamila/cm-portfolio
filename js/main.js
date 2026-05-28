/*
   main.js — Portfolio Scripts
   Sections:
     1. Mobile nav & theme toggle
     2. Active nav link on scroll
     3. Project rows scroll animations
     4. Dynamic content — fetches profile, skills, projects
        from Supabase via /api/data on every page load
     5. Chat with my CV widget
*/


/* 1. MOBILE NAV TOGGLE*/

const menuBtn    = document.getElementById('menuBtn');
const mobileMenu = document.getElementById('mobileMenu');

if (menuBtn) {
  menuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => mobileMenu.classList.add('hidden'));
  });
}

const themeToggle = document.getElementById('themeToggle');
const themeIcon   = document.querySelector('.theme-icon');

function applyTheme(theme) {
  document.body.classList.toggle('dark', theme === 'dark');
  if (themeIcon) themeIcon.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  localStorage.setItem('theme', theme);
}

applyTheme(localStorage.getItem('theme') === 'dark' ? 'dark' : 'light');

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    applyTheme(document.body.classList.contains('dark') ? 'light' : 'dark');
  });
}


/* 2. ACTIVE NAV LINK ON SCROLL */

const sections = document.querySelectorAll('section[id], header[id]');
const navLinks  = document.querySelectorAll('a[href^="#"]');

const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(link => {
        link.style.color =
          link.getAttribute('href') === '#' + entry.target.id ? '#3d6e5f' : '';
      });
    }
  });
}, { threshold: 0.5 });

sections.forEach(s => sectionObserver.observe(s));


/* 3. PROJECT ROW SCROLL ANIMATIONS */

function initProjectObserver() {
  const rows = document.querySelectorAll('.proj-row');
  const obs  = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -48px 0px' });

  rows.forEach(r => obs.observe(r));

  window.addEventListener('scroll', () => {
    document.querySelectorAll('.proj-row:not(.in-view)').forEach(row => {
      if (row.getBoundingClientRect().top < window.innerHeight * 0.88) {
        row.classList.add('in-view');
      }
    });
  }, { passive: true });
}


/* 
   4. DYNAMIC CONTENT — Supabase
   Fetches CV (profile + skills + contact) and
   projects, then renders them into the page.
   Falls back to existing static HTML if API fails. */

const DATA_ENDPOINT = '/api/data';

async function loadDynamicContent() {
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
      renderProfile(cv);
      renderSkills(cv);
      renderContact(cv);
    }

    renderProjects(projects);
    initChatWithData(cv, projects);

  } catch (err) {
    console.warn('[portfolio] API fetch failed, keeping static HTML.', err.message);
    // Static HTML already in the DOM — just init animations and chat fallback
    initProjectObserver();
    initChatWithData(null, []);
  }
}

/*  Profile (hero name, tagline, about bio)  */
function renderProfile(cv) {
  // Nav name
  const navName = document.getElementById('nav-name');
  if (navName && cv.name) navName.textContent = cv.name;

  // Hero heading
  const heroName = document.getElementById('hero-name');
  if (heroName && cv.name) heroName.textContent = cv.name.toUpperCase();

  // Hero subheading / role
  const heroRole = document.getElementById('hero-role');
  if (heroRole && cv.role_target) heroRole.textContent = cv.role_target;

  // About bio
  const aboutBio = document.getElementById('about-bio');
  if (aboutBio && cv.profile) aboutBio.textContent = cv.profile;

  // About name heading
  const aboutName = document.getElementById('about-name');
  if (aboutName && cv.name) aboutName.textContent = cv.name;
}

/* Skills badges  */
function renderSkills(cv) {
  const container = document.getElementById('skills-badges-container');
  if (!container || !cv.skills) return;

  const lines = cv.skills.split('\n').map(s => s.trim()).filter(Boolean);
  if (!lines.length) return;

  container.innerHTML = lines
    .map(s => `<div class="skill-badge">${escHtml(s)}</div>`)
    .join('');
}

/*  Contact section  */
function renderContact(cv) {
  const emailLink = document.getElementById('contact-email-link');
  const emailText = document.getElementById('contact-email-text');
  const phoneEl   = document.getElementById('contact-phone');
  const githubEl  = document.getElementById('contact-github');
  const linkedinEl= document.getElementById('contact-linkedin');
  const bioEl     = document.getElementById('contact-bio');

  if (emailLink && cv.email) emailLink.href = 'mailto:' + cv.email;
  if (emailText && cv.email) emailText.textContent = cv.email;
  if (phoneEl   && cv.phone) phoneEl.textContent   = cv.phone;
  if (githubEl  && cv.github) {
    githubEl.href = cv.github;
  }
  if (linkedinEl && cv.linkedin) {
    linkedinEl.href = cv.linkedin;
  }
  if (bioEl && cv.availability) bioEl.textContent = cv.availability;
}

/*  Projects  */
function renderProjects(projects) {
  const container = document.getElementById('projects-container');
  if (!container) return;

  if (!projects.length) {
    container.innerHTML = '<p style="text-align:center;color:#8ab5a8;padding:60px 0;font-size:14px;">No projects yet.</p>';
    initProjectObserver();
    return;
  }

  const bgClasses = ['EduEats-bg','intellisecure-bg','elaundry-bg','jambosec-bg','smartmarket-bg'];

  function getBg(type, i) {
    if (!type) return bgClasses[i % bgClasses.length];
    const t = type.toLowerCase();
    if (t.includes('ai') || t.includes('cyber')) return 'intellisecure-bg';
    if (t.includes('mobile'))                    return 'smartmarket-bg';
    return bgClasses[i % bgClasses.length];
  }

  container.innerHTML = projects.map((p, i) => {
    const reverse  = i % 2 !== 0;
    const bg       = getBg(p.type, i);
    const imgHtml  = p.image_url
      ? `<img src="${escHtml(p.image_url)}" alt="${escHtml(p.name)} screenshot" class="screen-image">`
      : `<div class="screen-label">${escHtml(p.name)}</div><div class="screen-sub">${escHtml(p.type)}</div>`;

    return `
      <article class="proj-row${reverse ? ' proj-row--reverse' : ''}">
        <div class="proj-mockup-wrap">
          <div class="proj-mockup">
            <div class="laptop-frame">
              <div class="laptop-screen">
                <div class="screen-placeholder ${bg}">${imgHtml}</div>
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
          ${p.link  ? `<a href="${escHtml(p.link)}" target="_blank" rel="noopener" class="proj-arrow" aria-label="View project">↗</a>` : ''}
        </div>
      </article>`;
  }).join('');

  initProjectObserver();
}

function escHtml(str) {
  return (str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}


/* 
   5. CHAT WIDGET
   Uses the CV data already fetched above —
   no second API call needed.
 */

const CHAT_ENDPOINT = '/api/chat';

const FALLBACK_CV = `
CANDIDATE: Camila Michele
ROLE TARGET: Mobile Developer, UI/UX Designer, Full-Stack Developer
PROFILE: Passionate tech student with expertise in mobile development and UI/UX design.
AVAILABILITY: Open to internships, collaborations, and exciting new projects.
CONTACT: michelecamila100@gmail.com | +254 759 068 658
`.trim();

let chatHistory = [];
let isTyping    = false;
let cvLoaded    = false;

function initChatWithData(cv, projects) {
  let context = FALLBACK_CV;

  if (cv) {
    const projectLines = projects.map((p, i) => {
      const lines = [`${i+1}. ${p.name.toUpperCase()} — ${p.type}`];
      if (p.award)       lines.push(`   Achievement: ${p.award}`);
      if (p.description) lines.push(`   Description: ${p.description}`);
      if (p.stack)       lines.push(`   Stack: ${p.stack}`);
      return lines.join('\n');
    }).join('\n\n');

    context = `
CANDIDATE: ${cv.name}
ROLE TARGET: ${cv.role_target}

PROFILE:
${cv.profile}

TECHNICAL SKILLS:
${cv.skills}

SELECTED PROJECTS:
${projectLines || 'None listed yet.'}

CONTACT:
Email: ${cv.email}
Phone: ${cv.phone}
GitHub: ${cv.github}
LinkedIn: ${cv.linkedin}

AVAILABILITY: ${cv.availability}`.trim();
  }

  chatHistory = [{
    role: 'system',
    content: `You are a helpful AI assistant representing the candidate described in the CV below.
Answer questions about skills, projects, experience, and background in a friendly, professional tone.
Speak in first person as if you are the candidate.
Keep answers concise (2-4 sentences unless more detail is needed).
If asked something not in the CV, say you can discuss it in person.
Never make up information not in the CV.

${context}`
  }];

  cvLoaded = true;
  showChatUI();
}

function showChatUI() {
  document.getElementById('api-key-prompt').style.display = 'none';
  const ui = document.getElementById('chat-ui');
  if (ui) ui.style.display = 'flex';
}

const bubble = document.getElementById('chat-bubble');
const panel  = document.getElementById('chat-panel');

if (bubble && panel) {
  bubble.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('open');
    bubble.classList.toggle('open', isOpen);
    if (isOpen) setTimeout(() => document.getElementById('chat-input')?.focus(), 300);
  });
}

const input   = document.getElementById('chat-input');
const sendBtn = document.getElementById('chat-send');

if (input) {
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 80) + 'px';
  });
}
if (sendBtn) sendBtn.addEventListener('click', sendMessage);

function sendSuggestion(btn) {
  if (!input) return;
  input.value = btn.textContent;
  const s = document.getElementById('suggestions');
  if (s) s.style.display = 'none';
  sendMessage();
}

async function sendMessage() {
  if (!input) return;
  const text = input.value.trim();
  if (!text || isTyping) return;
  if (!cvLoaded) { appendMessage('bot','⏳ Loading profile, one moment…'); return; }

  input.value = '';
  input.style.height = 'auto';
  const s = document.getElementById('suggestions');
  if (s) s.style.display = 'none';

  appendMessage('user', text);
  chatHistory.push({ role: 'user', content: text });
  logInteraction(text);
  showTyping();
  if (sendBtn) sendBtn.disabled = true;
  isTyping = true;

  try {
    const res  = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model:'gpt-3.5-turbo', messages:chatHistory, temperature:0.7, max_tokens:300 })
    });
    const data = await res.json();
    if (!res.ok) {
      hideTyping();
      appendMessage('bot', '⚠️ Error: ' + (data.error?.message || 'Unable to get a response.'));
    } else {
      const reply = data.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't get a response.";
      chatHistory.push({ role:'assistant', content:reply });
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

function logInteraction(q) {
  try {
    const log = JSON.parse(localStorage.getItem('cm_chat_log') || '[]');
    log.push({ q, t: new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) });
    if (log.length > 200) log.splice(0, log.length - 200);
    localStorage.setItem('cm_chat_log', JSON.stringify(log));
  } catch(e) {}
}

function appendMessage(role, text) {
  const msgs = document.getElementById('chat-messages');
  if (!msgs) return;
  const now = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.innerHTML = `<div class="msg-bubble">${escapeHtml(text)}</div><span class="msg-time">${now}</span>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function showTyping() {
  const msgs = document.getElementById('chat-messages');
  if (!msgs) return;
  const div = document.createElement('div');
  div.className = 'msg bot'; div.id = 'typing-msg';
  div.innerHTML = `<div class="msg-bubble typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function hideTyping() { document.getElementById('typing-msg')?.remove(); }

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}


/* 
   BOOT — single entry point
 */
loadDynamicContent();
