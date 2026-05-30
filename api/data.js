/**
 * api/data.js — Portfolio Data API
 * Routes:
 *   GET  ?action=get_projects
 *   GET  ?action=get_cv
 *   GET  ?action=get_setting&key=<key>
 *   POST ?action=save_project      (includes image_url)
 *   POST ?action=delete_project    { id }
 *   POST ?action=reorder_projects  { ids: [] }
 *   POST ?action=save_cv
 *   POST ?action=save_setting      { key, value }
 */

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabase(method, path, body, isUpsert) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase environment variables are not set.');
  }
  let prefer = '';
  if (isUpsert) {
    prefer = 'return=representation,resolution=merge-duplicates';
  } else if (method === 'POST' || method === 'PATCH') {
    prefer = 'return=representation';
  }
  const headers = {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  };
  if (prefer) headers['Prefer'] = prefer;

  const res  = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  if (text && text.trim()) {
    try { data = JSON.parse(text); }
    catch (e) { throw new Error('Invalid JSON from Supabase: ' + text.slice(0, 120)); }
  }
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || ('Supabase error ' + res.status);
    throw new Error(msg);
  }
  return data;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = req.query.action;
  if (!action) return res.status(400).json({ error: 'Missing ?action= parameter.' });

  try {

    if (action === 'get_projects' && req.method === 'GET') {
      const rows = await supabase('GET', '/projects?select=*&order=sort_order.asc,created_at.asc');
      return res.status(200).json({ projects: rows || [] });
    }

    if (action === 'get_cv' && req.method === 'GET') {
      const rows = await supabase('GET', '/cv_context?select=*&id=eq.1');
      return res.status(200).json({ cv: (rows && rows[0]) || null });
    }

    if (action === 'get_setting' && req.method === 'GET') {
      const key = req.query.key;
      if (!key) return res.status(400).json({ error: 'key is required.' });
      const rows = await supabase('GET', '/dashboard_settings?select=value&key=eq.' + encodeURIComponent(key));
      return res.status(200).json({ value: (rows && rows[0] && rows[0].value) || null });
    }

    if (action === 'save_project' && req.method === 'POST') {
      const body = req.body || {};
      if (!body.name) return res.status(400).json({ error: 'name is required.' });
      const payload = {
        name:        body.name.trim(),
        type:        (body.type        || 'Web Application').trim(),
        status:      (body.status      || 'Live').trim(),
        description: (body.description || '').trim(),
        stack:       (body.stack       || '').trim(),
        award:       (body.award       || '').trim(),
        link:        (body.link        || '').trim(),
        image_url:   (body.image_url   || '').trim(),  // ← screenshot URL
        sort_order:  body.sort_order != null ? body.sort_order : 0,
      };
      let result;
      if (body.id) {
        result = await supabase('PATCH', '/projects?id=eq.' + body.id, payload);
      } else {
        result = await supabase('POST', '/projects', payload);
      }
      return res.status(200).json({ project: Array.isArray(result) ? result[0] : result });
    }

    if (action === 'delete_project' && req.method === 'POST') {
      const body = req.body || {};
      if (!body.id) return res.status(400).json({ error: 'id is required.' });
      await supabase('DELETE', '/projects?id=eq.' + body.id);
      return res.status(200).json({ deleted: body.id });
    }

    if (action === 'reorder_projects' && req.method === 'POST') {
      const body = req.body || {};
      if (!Array.isArray(body.ids)) return res.status(400).json({ error: 'ids must be an array.' });
      await Promise.all(
        body.ids.map(function(id, index) {
          return supabase('PATCH', '/projects?id=eq.' + id, { sort_order: index + 1 });
        })
      );
      return res.status(200).json({ reordered: true });
    }

    if (action === 'save_cv' && req.method === 'POST') {
      const body = req.body || {};
      const payload = {
        id:           1,
        name:         (body.name         || '').trim(),
        role_target:  (body.role_target  || '').trim(),
        profile:      (body.profile      || '').trim(),
        skills:       (body.skills       || '').trim(),
        email:        (body.email        || '').trim(),
        phone:        (body.phone        || '').trim(),
        availability: (body.availability || '').trim(),
        github:       (body.github       || '').trim(),
        linkedin:     (body.linkedin     || '').trim(),
      };
      const result = await supabase('POST', '/cv_context?on_conflict=id', payload, true);
      return res.status(200).json({ cv: Array.isArray(result) ? result[0] : result });
    }

    if (action === 'save_setting' && req.method === 'POST') {
      const body = req.body || {};
      if (!body.key)   return res.status(400).json({ error: 'key is required.' });
      if (!body.value) return res.status(400).json({ error: 'value is required.' });
      const result = await supabase('POST', '/dashboard_settings?on_conflict=key', { key: body.key, value: body.value }, true);
      return res.status(200).json({ setting: Array.isArray(result) ? result[0] : result });
    }

    return res.status(400).json({ error: 'Unknown action: ' + action });

  } catch (err) {
    console.error('[api/data.js]', err.message);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};