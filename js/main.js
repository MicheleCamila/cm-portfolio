/*
   Sections:
     1. Mobile nav
     2. Active nav link on scroll
     3. Chat with my CV widget
    */


/* 1. MOBILE NAV TOGGLE*/

const menuBtn    = document.getElementById('menuBtn');
const mobileMenu = document.getElementById('mobileMenu');

menuBtn.addEventListener('click', () => {
  mobileMenu.classList.toggle('hidden');
});

// Close dropdown when any link inside it is clicked
mobileMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => mobileMenu.classList.add('hidden'));
});

const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.querySelector('.theme-icon');
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


/* 
   2. ACTIVE NAV LINK HIGHLIGHT ON SCROLL
   Uses IntersectionObserver to detect which
   section is currently in the viewport.
    */
const sections = document.querySelectorAll('section[id], header[id]');
const navLinks  = document.querySelectorAll('a[href^="#"]');

const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(link => {
        link.style.color =
          link.getAttribute('href') === '#' + entry.target.id
            ? '#3d6e5f'   // sage-500 — active
            : '';          // reset to CSS default
      });
    }
  });
}, { threshold: 0.5 });

sections.forEach(section => sectionObserver.observe(section));


/* 
   PROJECT ROWS - SCROLL TRIGGERED ANIMATIONS
   Adds .in-view to each .proj-row as it enters
   the viewport, triggering all CSS transitions:
   slide-in mockup, staggered text, float, shimmer,
   badge pulse, ghost number, progress dot.
    */
const projRows = document.querySelectorAll('.proj-row');

const projObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      projObserver.unobserve(entry.target); // keep state, stop watching
    }
  });
}, {
  threshold: 0.15,
  rootMargin: '0px 0px -48px 0px'
});

projRows.forEach(row => projObserver.observe(row));

// Fallback: also fire on scroll for fast-scrolling users
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


/* 
   3. CHAT WITH MY CV WIDGET
   Powered by OpenAI.

   Secure setup:
   - Store OPENAI_API_KEY in Vercel environment variables.
   - Do not hardcode the key in frontend code.
   - The browser calls the serverless /api/chat route.
*/

const API_ENDPOINT = '/api/chat';


const CV_CONTEXT = `
CANDIDATE: CAMILA MICHELE
ROLE TARGET: Mobile Developer, UI/UX Designer, Full-Stack Developer

PROFILE:
Passionate tech student with strong expertise in mobile development, user interface design,
and dedicated to creating impactful technology solutions. Shown track record of winning
hackathons, building intuitive digital experiences, and leading small teams. Open minded to
opportunities across diverse sectors to leverage technical skills.

TECHNICAL SKILLS:
- Mobile Development: Flutter, iOS Development, Android Development
- UI/UX Design: Figma, Wireframing, Prototyping, Design Systems
- Frontend Development: HTML/CSS, Flutter
- Backend Development: Firebase, Supabase
- Agile Leadership / Scrum Master
- Agile Software Development

SOFT SKILLS:
Team Collaboration, Project Management, Agile/Scrum, Adaptability, Problem Solving,
Communication, Leadership

SELECTED PROJECTS:

1. KUZURURA — Innovative Transport System
   Role: Team Lead
   Description: Built a smart transportation web application featuring real-time GPS tracking,
   route optimization, fare calculation, and driver-passenger matching system. Integrated
   payment gateways. Estimated Impact: Improve public transport efficiency for millions of
   commuters when optimized.

2. INTELLISECURE — AI Powered SMS Fraud Detection System
   Achievement: Won 3rd place overall AND 1st place in Cybersecurity category at Inter
   University Hackathon 2025 with team members.
   Description: IntelliSecure leverages AI to analyze SMS messages in real-time, detecting
   fraudulent patterns before users can fall victim. The system learns continuously from user
   feedback, adapting to new threats instantly. Features: instant push notifications, realtime
   SMS scanning, fine-tuned GPT 3.5 model, user feedback loop.

3. E-Laundry — Laundry Management System for Egerton University
   A web-based platform that streamlines the laundry order and management process at Egerton University. 
   The platform enables students to submit and track laundry orders online while giving management staff a dashboard to process orders,
   assign workloads, and generate reports. The goal is to improve service efficiency, eliminate manual record-keeping, reduce revenue leakage,
   and create a transparent order history for every student.

4. Smart Market — Your AI business companion
    NYOTA  is offering business support to enable MSMESs to grow and create jobs. Smart Market is a mobile application that connects potential beneficiaries with local suppliers, customers, and business resources.
    The app provides a platform for users to list products/services, access market information, network with other enterpreneurs.
    Market intelligence means understanding your business environment what your customers want, 
    what competitors are doing, how prices are shifting and the ongoing trends
    Smart Market uses AI to automatically collect, analyze and interpret this data so that MSMES can make smarter, 
    faster, impactful and more profitable decision. 
AVAILABILITY: Open to internships, collaborations, and exciting new projects.
`;

const SYSTEM_PROMPT = `You are a helpful AI assistant representing the candidate described in the CV below.
Answer questions about the candidate's skills, projects, experience, and background in a friendly,
professional, and enthusiastic tone. Speak in first person as if you are the candidate.
Keep answers concise (2-4 sentences max unless the question needs more detail).
If asked something not covered in the CV, say you can discuss it in person.
Never make up information not in the CV.

${CV_CONTEXT}`;


// 3c. STATE

let chatHistory = [{ role: 'system', content: SYSTEM_PROMPT }];
let isTyping    = false;

showChatUI();



// 3d. SHOW CHAT UI

function showChatUI() {
  document.getElementById('api-key-prompt').style.display = 'none';
  const ui = document.getElementById('chat-ui');
  ui.style.display = 'flex';
}


// 3e. PANEL OPEN / CLOSE

const bubble = document.getElementById('chat-bubble');
const panel  = document.getElementById('chat-panel');

bubble.addEventListener('click', () => {
  const isOpen = panel.classList.toggle('open');
  bubble.classList.toggle('open', isOpen);

  if (isOpen) {
    setTimeout(() => document.getElementById('chat-input')?.focus(), 300);
  }
});


// 3f. SEND MESSAGE

const input   = document.getElementById('chat-input');
const sendBtn = document.getElementById('chat-send');

// Send on Enter (Shift+Enter = new line)
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Auto-grow textarea
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 80) + 'px';
});

sendBtn.addEventListener('click', sendMessage);

// Called by suggestion chip buttons in index.html
function sendSuggestion(btn) {
  input.value = btn.textContent;
  document.getElementById('suggestions').style.display = 'none';
  sendMessage();
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text || isTyping) return;

  input.value = '';
  input.style.height = 'auto';
  document.getElementById('suggestions').style.display = 'none';

  appendMessage('user', text);
  chatHistory.push({ role: 'user', content: text });

  showTyping();
  sendBtn.disabled = true;
  isTyping = true;

  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: chatHistory,
        temperature: 0.7,
        max_tokens: 300,
      })
    });

    const data = await res.json();

    if (!res.ok) {
      const message = data.error?.message || 'Unable to get a response from OpenAI.';
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

  sendBtn.disabled = false;
  isTyping = false;
}


// 3g. DOM HELPERS
// ------------------------------------------

function appendMessage(role, text) {
  const msgs = document.getElementById('chat-messages');
  const now  = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const div  = document.createElement('div');
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
  const div  = document.createElement('div');
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