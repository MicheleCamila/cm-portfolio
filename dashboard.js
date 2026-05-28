/* 
   Sections:
     1. Password gate (stored in Supabase, never in code)
     2. Panel navigation
     3. Profile panel
     4. Skills panel
     5. Projects panel
     6. CV context panel
     7. Settings / change password
     8. Helpers */

const DEV_MODE = true; // set to false 

const PANELS = {
  overview:    'Overview',
  profile:     'Profile',
  skills:      'Skills',
  projects:    'Projects',
  'cv-context':'CV & Chat Context',
  settings:    'Settings',
};

/*  State  */
let projects  = [];
let skills    = [];   // array of strings
let editingId = null;

/* 
   1. PASSWORD GATE
   Password hash is saved in Supabase (dashboard_settings table).
   On first visit there is no hash - user sets one.
   sessionStorage caches the verified hash for the tab lifetime.
 */

async function hashStr(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function checkAuth() {
  let storedHash = null;
  try {
    const res  = await fetch('/api/data?action=get_setting&key=dashboard_password_hash');
    const data = await res.json();
    storedHash = data.value || null;
  } catch (e) { /* API not yet available*/ }

  if (!storedHash) {
    showSetupMode();
  } else {
    const session = sessionStorage.getItem('cm_dash_auth');
    if (session === storedHash) {
      unlockDashboard();
    } else {
      showLoginMode();
    }
  }
}

function showSetupMode() {
  document.getElementById('login-setup-banner').style.display = 'block';
  document.getElementById('login-field-confirm').style.display = 'block';
  document.getElementById('login-password-label').textContent  = 'Set a Password';
  document.getElementById('login-password').placeholder = 'Choose a strong password';
  document.getElementById('login-btn').textContent  = 'Set Password & Enter →';
  document.getElementById('login-note').textContent = 'You will use this password every time you access the dashboard.';
  document.getElementById('login-screen').classList.add('show');
  setTimeout(() => document.getElementById('login-password').focus(), 100);
}

function showLoginMode() {
  document.getElementById('login-screen').classList.add('show');
  setTimeout(() => document.getElementById('login-password').focus(), 100);
}

async function submitLogin() {
  const passwordInput = document.getElementById('login-password').value;
  const confirmInput  = document.getElementById('login-confirm').value;
  const isSetup = document.getElementById('login-field-confirm').style.display !== 'none';

  if (!passwordInput) {
    setLoginError('Please enter a password.');
    return;
  }

  if (isSetup) {
    if (passwordInput.length < 8) {
      setLoginError('Password must be at least 8 characters.');
      shakeInput('login-password');
      return;
    }
    if (passwordInput !== confirmInput) {
      setLoginError('Passwords do not match.');
      shakeInput('login-confirm');
      return;
    }
    // Save hash to Supabase
    const hash = await hashStr(passwordInput);
    try {
      await api('save_setting', 'POST', { key: 'dashboard_password_hash', value: hash });
      sessionStorage.setItem('cm_dash_auth', hash);
      document.getElementById('login-error').textContent = '';
      unlockDashboard();
    } catch (e) {
      setLoginError('Could not save password: ' + e.message);
    }
  } else {
    // Verify against stored hash
    let storedHash = null;
    try {
      const res  = await fetch('/api/data?action=get_setting&key=dashboard_password_hash');
      const data = await res.json();
      storedHash = data.value;
    } catch (e) {
      setLoginError('Could not reach server. Check your connection.');
      return;
    }
    const inputHash = await hashStr(passwordInput);
    if (inputHash === storedHash) {
      sessionStorage.setItem('cm_dash_auth', storedHash);
      document.getElementById('login-error').textContent = '';
      unlockDashboard();
    } else {
      setLoginError('Incorrect password. Try again.');
      shakeInput('login-password');
      document.getElementById('login-password').value = '';
    }
  }
}

function setLoginError(msg) {
  document.getElementById('login-error').textContent = msg;
}

function shakeInput(id) {
  const el = document.getElementById(id);
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
  el.focus();
}

function unlockDashboard() {
  document.getElementById('login-screen').classList.remove('show');
  document.getElementById('main').style.display    = 'flex';
  document.getElementById('sidebar').style.display = 'flex';
  init();
}

function logout() {
  sessionStorage.removeItem('cm_dash_auth');
  document.getElementById('main').style.display    = 'none';
  document.getElementById('sidebar').style.display = 'none';
  document.getElementById('login-password').value  = '';
  document.getElementById('login-error').textContent = '';
  showLoginMode();
}

async function changePassword() {
  const current  = document.getElementById('pw-current').value;
  const newPw    = document.getElementById('pw-new').value;
  const confirm  = document.getElementById('pw-confirm').value;

  if (!current || !newPw || !confirm) { showToast('Fill in all password fields.', true); return; }
  if (newPw.length < 8)               { showToast('New password must be at least 8 characters.', true); return; }
  if (newPw !== confirm)              { showToast('New passwords do not match.', true); return; }

  // Verify current password
  let storedHash = null;
  try {
    const res  = await fetch('/api/data?action=get_setting&key=dashboard_password_hash');
    const data = await res.json();
    storedHash = data.value;
  } catch (e) { showToast('Could not verify current password.', true); return; }

  const currentHash = await hashStr(current);
  if (currentHash !== storedHash) { showToast('Current password is incorrect.', true); return; }

  const newHash = await hashStr(newPw);
  try {
    await api('save_setting', 'POST', { key: 'dashboard_password_hash', value: newHash });
    sessionStorage.setItem('cm_dash_auth', newHash);
    document.getElementById('pw-current').value = '';
    document.getElementById('pw-new').value     = '';
    document.getElementById('pw-confirm').value = '';
    showToast('Password updated successfully.');
    logActivity('Password changed', 'green');
  } catch (e) {
    showToast('Failed to update password: ' + e.message, true);
  }
}

/* 
   2. PANEL NAVIGATION
 */

function showPanel(name, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('panel-title').textContent = PANELS[name] || name;
  document.getElementById('sidebar').classList.remove('open');
}

/* 
   3. PROFILE PANEL
   Reads/writes to cv_context (reuses same Supabase row)
 */

async function loadProfile() {
  loader('profile', true);
  try {
    const data = await api('get_cv');
    const cv   = data.cv;
    if (cv) {
      document.getElementById('profile-name').value         = cv.name || '';
      document.getElementById('profile-email').value        = cv.email || '';
      document.getElementById('profile-role').value         = cv.role_target || '';
      document.getElementById('profile-bio').value          = cv.profile || '';
      document.getElementById('profile-github').value       = cv.github || '';
      document.getElementById('profile-linkedin').value     = cv.linkedin || '';
      document.getElementById('profile-phone').value        = cv.phone || '';
      document.getElementById('profile-availability').value = cv.availability || '';
      updateProfilePreview();
    }
    loader('profile', false);
    setStatus(true);
  } catch (e) {
    loader('profile', false);
    showError('profile', 'Failed to load profile: ' + e.message);
    setStatus(false);
  }
}

function updateProfilePreview() {
  const name = document.getElementById('profile-name').value.trim() || 'Camila Michele';
  const role = document.getElementById('profile-role').value.trim() || 'Mobile Developer · UI/UX Designer';
  document.getElementById('profile-preview-name').textContent = name;
  document.getElementById('profile-preview-role').textContent = role;
  // Initials
  const parts    = name.split(' ').filter(Boolean);
  const initials = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : name.slice(0, 2);
  document.getElementById('profile-avatar-initials').textContent = initials.toUpperCase();
}

async function saveProfile() {
  // Merge profile fields into cv_context
  const payload = {
    name:         document.getElementById('profile-name').value.trim(),
    email:        document.getElementById('profile-email').value.trim(),
    role_target:  document.getElementById('profile-role').value.trim(),
    profile:      document.getElementById('profile-bio').value.trim(),
    github:       document.getElementById('profile-github').value.trim(),
    linkedin:     document.getElementById('profile-linkedin').value.trim(),
    phone:        document.getElementById('profile-phone').value.trim(),
    availability: document.getElementById('profile-availability').value.trim(),
    // preserve existing skills/cv fields
    skills:       document.getElementById('cv-skills')?.value.trim() || '',
  };
  setBtnLoading('profile-save-btn', true, 'Save Changes');
  try {
    await api('save_cv', 'POST', payload);
    showToast('Profile saved.');
    logActivity('Profile updated', 'green');
    // keep cv panel in sync
    syncCvFromProfile(payload);
  } catch (e) {
    showToast('Save failed: ' + e.message, true);
  } finally {
    setBtnLoading('profile-save-btn', false, 'Save Changes');
  }
}

function syncCvFromProfile(p) {
  if (document.getElementById('cv-name'))         document.getElementById('cv-name').value         = p.name;
  if (document.getElementById('cv-email'))        document.getElementById('cv-email').value        = p.email;
  if (document.getElementById('cv-role'))         document.getElementById('cv-role').value         = p.role_target;
  if (document.getElementById('cv-profile'))      document.getElementById('cv-profile').value      = p.profile;
  if (document.getElementById('cv-github'))       document.getElementById('cv-github').value       = p.github;
  if (document.getElementById('cv-linkedin'))     document.getElementById('cv-linkedin').value     = p.linkedin;
  if (document.getElementById('cv-phone'))        document.getElementById('cv-phone').value        = p.phone;
  if (document.getElementById('cv-availability')) document.getElementById('cv-availability').value = p.availability;
}

/*  4. SKILLS PANEL*/

async function loadSkills() {
  loader('skills', true);
  try {
    const data = await api('get_cv');
    const raw  = data.cv?.skills || '';
    // Skills are stored one per line in cv_context.skills
    skills = raw.split('\n').map(s => s.trim()).filter(Boolean);
    renderSkillTags();
    updateSkillStats();
    loader('skills', false);
  } catch (e) {
    loader('skills', false);
    showError('skills', 'Failed to load skills: ' + e.message);
  }
}

function renderSkillTags() {
  const grid = document.getElementById('skills-grid');
  if (!skills.length) {
    grid.innerHTML = '<p class="loading-text">No skills yet. Add one below.</p>';
    return;
  }
  grid.innerHTML = skills.map((s, i) => `
    <span class="skill-tag">
      ${esc(s)}
      <button class="skill-tag-remove" onclick="removeSkill(${i})" title="Remove">✕</button>
    </span>`).join('');
}

function addSkillTag() {
  const input = document.getElementById('skill-input');
  const val   = input.value.trim();
  if (!val) return;
  if (skills.includes(val)) { showToast('Skill already added.', true); return; }
  skills.push(val);
  input.value = '';
  renderSkillTags();
  updateSkillStats();
}

function removeSkill(index) {
  skills.splice(index, 1);
  renderSkillTags();
  updateSkillStats();
}

async function saveSkills() {
  // Read the current cv data first so we don't wipe other fields
  setBtnLoading('skills-save-btn', true, 'Save Skills');
  try {
    const data = await api('get_cv');
    const cv   = data.cv || {};
    const payload = {
      ...cv,
      skills: skills.join('\n'),
    };
    await api('save_cv', 'POST', payload);
    showToast('Skills saved.');
    logActivity('Skills updated', 'green');
    updateSkillStats();
    // Keep cv-skills textarea in sync
    if (document.getElementById('cv-skills')) {
      document.getElementById('cv-skills').value = skills.join('\n');
    }
  } catch (e) {
    showToast('Save failed: ' + e.message, true);
  } finally {
    setBtnLoading('skills-save-btn', false, 'Save Skills');
  }
}

function updateSkillStats() {
  const count = skills.length;
  const statEl  = document.getElementById('stat-skills');
  const profEl  = document.getElementById('profile-stat-skills');
  if (statEl)  statEl.textContent  = count;
  if (profEl)  profEl.textContent  = count;
}

/* 5. PROJECTS PANEL */

async function loadProjects() {
  loader('projects', true);
  loader('overview', true);
  try {
    const data = await api('get_projects');
    projects = data.projects || [];
    renderProjects();
    renderOverview();
    document.getElementById('stat-projects').textContent = projects.length;
    const profEl = document.getElementById('profile-stat-projects');
    if (profEl) profEl.textContent = projects.length;
    loader('projects', false);
    loader('overview', false);
    setStatus(true);
  } catch (e) {
    loader('projects', false);
    loader('overview', false);
    showError('projects', 'Failed to load projects: ' + e.message);
    showError('overview', 'API error: ' + e.message + ' — check Supabase env vars in Vercel.');
    setStatus(false);
  }
}

function renderProjects() {
  const tbody = document.getElementById('projects-tbody');
  if (!projects.length) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="icon">◈</div><p>No projects yet. Click "Add Project".</p></div></td></tr>';
    return;
  }
  tbody.innerHTML = projects.map(p => `
    <tr>
      <td>
        <strong>${esc(p.name)}</strong>
        ${p.stack ? '<br><span class="project-stack">' + esc(p.stack) + '</span>' : ''}
      </td>
      <td><span class="tag ${typeClass(p.type)}">${esc(p.type)}</span></td>
      <td><span class="tag ${statusClass(p.status)}">${esc(p.status)}</span></td>
      <td>${p.award ? '<span class="tag tag-award">' + esc(p.award) + '</span>' : '<span class="no-award">—</span>'}</td>
      <td class="col-actions">
        <button class="btn btn-ghost btn-sm" onclick="openProjectModal('${p.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProject('${p.id}','${esc(p.name)}')" style="margin-left:4px;">Delete</button>
      </td>
    </tr>`).join('');
}

function renderOverview() {
  const el = document.getElementById('overview-projects-list');
  if (!projects.length) { el.innerHTML = '<p class="loading-text">No projects yet.</p>'; return; }
  el.innerHTML = projects.slice(0, 6).map(p => `
    <div class="overview-project-row">
      <span class="tag ${typeClass(p.type)}">${esc(p.type.split('·')[0].trim())}</span>
      <span class="overview-project-name">${esc(p.name)}</span>
      <span class="tag ${statusClass(p.status)} overview-project-status">${esc(p.status)}</span>
    </div>`).join('') +
    (projects.length > 6 ? `<p class="overview-more">+${projects.length - 6} more</p>` : '');
}

function openProjectModal(id) {
  editingId = id || null;
  document.getElementById('modal-title').textContent = id ? 'Edit Project' : 'Add Project';
  if (id) {
    const p = projects.find(x => x.id === id);
    if (!p) return;
    document.getElementById('modal-name').value   = p.name;
    document.getElementById('modal-type').value   = p.type;
    document.getElementById('modal-status').value = p.status;
    document.getElementById('modal-desc').value   = p.description;
    document.getElementById('modal-stack').value  = p.stack;
    document.getElementById('modal-award').value  = p.award;
    document.getElementById('modal-link').value   = p.link || '';
  } else {
    ['modal-name','modal-desc','modal-stack','modal-award','modal-link']
      .forEach(f => document.getElementById(f).value = '');
    document.getElementById('modal-type').value   = 'Web Application';
    document.getElementById('modal-status').value = 'Live';
  }
  document.getElementById('modal-backdrop').classList.add('show');
  setTimeout(() => document.getElementById('modal-name').focus(), 100);
}

async function saveProject() {
  const name = document.getElementById('modal-name').value.trim();
  if (!name) { showToast('Project name is required.', true); return; }
  const payload = {
    id:          editingId || undefined,
    name,
    type:        document.getElementById('modal-type').value,
    status:      document.getElementById('modal-status').value,
    description: document.getElementById('modal-desc').value.trim(),
    stack:       document.getElementById('modal-stack').value.trim(),
    award:       document.getElementById('modal-award').value.trim(),
    link:        document.getElementById('modal-link').value.trim(),
  };
  setBtnLoading('modal-save-btn', true, 'Save Project');
  try {
    await api('save_project', 'POST', payload);
    showToast(editingId ? 'Project updated.' : 'Project added.');
    logActivity((editingId ? 'Updated: ' : 'Added: ') + name, 'green');
    closeModal();
    await loadProjects();
  } catch (e) {
    showToast('Save failed: ' + e.message, true);
  } finally {
    setBtnLoading('modal-save-btn', false, 'Save Project');
  }
}

async function deleteProject(id, name) {
  if (!confirm('Delete "' + name + '"? This cannot be undone.')) return;
  try {
    await api('delete_project', 'POST', { id });
    showToast('Project deleted.');
    logActivity('Deleted: ' + name, 'red');
    await loadProjects();
  } catch (e) {
    showToast('Delete failed: ' + e.message, true);
  }
}

function closeModal() {
  document.getElementById('modal-backdrop').classList.remove('show');
  editingId = null;
}

/*  6. CV CONTEXT PANEL */

async function loadCv() {
  loader('cv', true);
  try {
    const data = await api('get_cv');
    const cv   = data.cv;
    if (cv) {
      document.getElementById('cv-name').value         = cv.name || '';
      document.getElementById('cv-role').value         = cv.role_target || '';
      document.getElementById('cv-profile').value      = cv.profile || '';
      document.getElementById('cv-skills').value       = cv.skills || '';
      document.getElementById('cv-email').value        = cv.email || '';
      document.getElementById('cv-phone').value        = cv.phone || '';
      document.getElementById('cv-availability').value = cv.availability || '';
      document.getElementById('cv-github').value       = cv.github || '';
      document.getElementById('cv-linkedin').value     = cv.linkedin || '';
    }
    loader('cv', false);
    setStatus(true);
  } catch (e) {
    loader('cv', false);
    showError('cv', 'Failed to load CV context: ' + e.message);
    setStatus(false);
  }
}

async function saveCv() {
  const payload = {
    name:         document.getElementById('cv-name').value.trim(),
    role_target:  document.getElementById('cv-role').value.trim(),
    profile:      document.getElementById('cv-profile').value.trim(),
    skills:       document.getElementById('cv-skills').value.trim(),
    email:        document.getElementById('cv-email').value.trim(),
    phone:        document.getElementById('cv-phone').value.trim(),
    availability: document.getElementById('cv-availability').value.trim(),
    github:       document.getElementById('cv-github').value.trim(),
    linkedin:     document.getElementById('cv-linkedin').value.trim(),
  };
  setBtnLoading('cv-save-btn', true, 'Save to Supabase');
  try {
    await api('save_cv', 'POST', payload);
    showToast('CV context saved. Live site updated.');
    logActivity('CV context updated', 'green');
  } catch (e) {
    showToast('Save failed: ' + e.message, true);
  } finally {
    setBtnLoading('cv-save-btn', false, 'Save to Supabase');
  }
}

/* 7. SETTINGS / DIAGNOSTICS */

async function testConnection() {
  try {
    await api('get_projects');
    showToast('Connection successful! Supabase is reachable.');
    setStatus(true);
  } catch (e) {
    showToast('Connection failed: ' + e.message, true);
    setStatus(false);
  }
}

async function refreshAll() {
  showToast('Refreshing…');
  await Promise.all([loadProjects(), loadCv(), loadProfile(), loadSkills()]);
  showToast('All data refreshed.');
}

/*  8. HELPERS */

async function api(action, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch('/api/data?action=' + action, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API error ' + res.status);
  return data;
}

async function init() {
  await Promise.all([loadProjects(), loadCv(), loadProfile(), loadSkills()]);
}

function loader(panel, on) {
  const el = document.getElementById(panel + '-loader');
  if (el) el.classList.toggle('done', !on);
}

function showError(panel, msg) {
  const el = document.getElementById(panel + '-error');
  if (!el) return;
  el.textContent = '⚠ ' + msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 10000);
}

function setStatus(ok) {
  const el = document.getElementById('api-status');
  el.textContent     = ok ? 'Connected' : 'Error';
  el.style.color      = ok ? '' : '#c0392b';
  el.style.background = ok ? '' : '#fff0f0';
  el.style.borderColor = ok ? '' : '#f5c6c6';
}

function setBtnLoading(id, loading, label) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled    = loading;
  btn.textContent = loading ? 'Saving…' : label;
}

let toastTimer;
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = isError ? 'error show' : 'show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

function logActivity(msg, dot = '') {
  const list = document.getElementById('activity-list');
  const li   = document.createElement('li');
  const now  = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  li.innerHTML = `<div class="activity-dot ${dot}"></div><div><div>${esc(msg)}</div><div class="activity-time">${now}</div></div>`;
  list.prepend(li);
  while (list.children.length > 8) list.removeChild(list.lastChild);
}

function toggleSection(header) {
  const body = header.nextElementSibling;
  body.classList.toggle('open');
  const h4 = header.querySelector('h4');
  h4.textContent = body.classList.contains('open')
    ? h4.textContent.replace('▶', '▼')
    : h4.textContent.replace('▼', '▶');
}

function typeClass(t) {
  if (!t) return 'tag-web';
  const l = t.toLowerCase();
  if (l.includes('mobile')) return 'tag-mobile';
  if (l.includes('ai'))     return 'tag-ai';
  return 'tag-web';
}

function statusClass(s) {
  if (s === 'Live')        return 'tag-web';
  if (s === 'In Progress') return 'tag-inprogress';
  return 'tag-mobile';
}

function esc(str) {
  return (str || '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

/*  Keyboard / click bindings  */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('main').style.display    = 'none';
  document.getElementById('sidebar').style.display = 'none';

  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitLogin();
  });
  document.getElementById('login-confirm').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitLogin();
  });
  document.getElementById('skill-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addSkillTag();
  });
  document.getElementById('modal-backdrop').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });

  checkAuth();
});