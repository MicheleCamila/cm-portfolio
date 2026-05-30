/**
 * api/upload.js
 * Place at: api/upload.js
 *
 * Receives multipart/form-data with a "file" field,
 * uploads it to the "project-images" Supabase Storage bucket,
 * and returns the public URL.
 */

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET               = 'project-images';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed.' });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase environment variables are not set.' });
  }

  try {
    const { file, mimeType, originalName } = await parseForm(req);

    // Build a safe unique filename
    const safeName = originalName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-_]/g, '');
    const filename = `${Date.now()}-${safeName}`;

    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filename}`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type':  mimeType,
          'x-upsert':      'true',
        },
        body: file,
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error('Storage upload failed: ' + err.slice(0, 200));
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`;
    return res.status(200).json({ url: publicUrl });

  } catch (err) {
    console.error('[api/upload.js]', err.message);
    return res.status(500).json({ error: err.message || 'Upload failed.' });
  }
};

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data',  chunk => chunks.push(chunk));
    req.on('error', reject);
    req.on('end',   () => {
      try {
        const body          = Buffer.concat(chunks);
        const contentType   = req.headers['content-type'] || '';
        const boundaryMatch = contentType.match(/boundary=(.+)$/);
        if (!boundaryMatch) throw new Error('No boundary found in Content-Type.');

        const boundary = '--' + boundaryMatch[1];
        const parts    = splitBuffer(body, Buffer.from('\r\n' + boundary));

        for (const part of parts) {
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd === -1) continue;
          const headerStr = part.slice(0, headerEnd).toString();
          const fileBody  = part.slice(headerEnd + 4);
          if (!headerStr.includes('filename=')) continue;

          const nameMatch    = headerStr.match(/filename="([^"]+)"/);
          const originalName = nameMatch ? nameMatch[1] : 'upload.jpg';
          const ctMatch      = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);
          const mimeType     = ctMatch ? ctMatch[1].trim() : 'image/jpeg';

          // Strip trailing multipart boundary marker if present
          const clean = fileBody.slice(-4).toString() === '\r\n--'
            ? fileBody.slice(0, -4)
            : fileBody;

          return resolve({ file: clean, mimeType, originalName });
        }
        reject(new Error('No file found in form data.'));
      } catch (e) { reject(e); }
    });
  });
}

function splitBuffer(buf, delimiter) {
  const parts = [];
  let start = 0;
  let pos   = buf.indexOf(delimiter, start);
  while (pos !== -1) {
    parts.push(buf.slice(start, pos));
    start = pos + delimiter.length;
    pos   = buf.indexOf(delimiter, start);
  }
  parts.push(buf.slice(start));
  return parts;
}