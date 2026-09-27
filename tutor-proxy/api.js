/**
 * The course's small API, next to the tutor in the same Worker (paths under /api/).
 * Storage is a D1 database bound as env.DB (schema.sql). Nothing here stores IP addresses.
 *
 *   POST /api/sync               create a private sync code             -> { code }
 *   GET  /api/sync/:code         read the progress saved under a code    -> { data, updated }
 *   PUT  /api/sync/:code         save progress under a code ({ data })   -> { updated }
 *   POST /api/stats              anonymous answer counts: { events: [{ q, ok }] } (also sent as text/plain by sendBeacon)
 *   GET  /api/stats              the counts, for the instructor page; needs "Authorization: Bearer <STATS_TOKEN>"
 *   POST /api/cert               record a certificate: { name, modules, lessons, correct, date } -> { id }
 *   GET  /api/cert/:id           read a recorded certificate (public, for verification)
 *
 * A sync code is 20 random characters (100 bits) from an unambiguous alphabet, so codes cannot be guessed.
 * Requests are limited per visitor by env.API_LIMITER (separate from the tutor's limit).
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';           // no I, L, O, U, 0, 1
const CODE_RE = /^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{20}$/;
const QID_RE = /^[a-z]+:[\w.:|\-]{1,80}$/i;
const MAX_SYNC_BYTES = 512 * 1024;

function reply(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
function randomCode(n, alphabet) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];     // 30 symbols: bias is negligible for this use
  return out;
}
function normaliseCode(raw) { return String(raw || '').toUpperCase().replace(/[\s-]/g, ''); }
async function readJson(request, limit) {
  const text = await request.text();
  if (text.length > limit) throw new Error('too large');
  return JSON.parse(text);
}
function clean(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').slice(0, max); }

export async function handleApi(request, env, cors) {
  const url = new URL(request.url);
  const parts = url.pathname.replace(/\/+$/, '').split('/').slice(2);     // ['sync', code] etc.
  const method = request.method;
  if (!env.DB) return reply({ error: { message: 'The course API has no database configured.' } }, 503, cors);

  if (env.API_LIMITER) {
    const ip = request.headers.get('CF-Connecting-IP') || 'anonymous';
    const { success } = await env.API_LIMITER.limit({ key: 'api:' + ip });
    if (!success) return reply({ error: { message: 'Too many requests. Please wait a minute.' } }, 429, cors);
  }
  const now = Date.now();

  // ---------------------------------------------------------------- sync
  if (parts[0] === 'sync') {
    if (method === 'POST' && parts.length === 1) {
      const code = randomCode(20, ALPHABET);
      await env.DB.prepare('INSERT INTO sync (code, data, updated, created) VALUES (?, ?, ?, ?)').bind(code, '{}', now, now).run();
      return reply({ code }, 201, cors);
    }
    const code = normaliseCode(parts[1]);
    if (!CODE_RE.test(code)) return reply({ error: { message: 'That is not a valid sync code.' } }, 400, cors);
    if (method === 'GET') {
      const row = await env.DB.prepare('SELECT data, updated FROM sync WHERE code = ?').bind(code).first();
      if (!row) return reply({ error: { message: 'No progress is saved under that code.' } }, 404, cors);
      return reply({ data: JSON.parse(row.data), updated: row.updated }, 200, cors);
    }
    if (method === 'PUT') {
      let body;
      try { body = await readJson(request, MAX_SYNC_BYTES); } catch (e) { return reply({ error: { message: 'Progress too large or not JSON.' } }, 413, cors); }
      const data = JSON.stringify(body.data || {});
      const res = await env.DB.prepare('UPDATE sync SET data = ?, updated = ? WHERE code = ?').bind(data, now, code).run();
      if (!res.meta || !res.meta.changes) return reply({ error: { message: 'No progress is saved under that code.' } }, 404, cors);
      return reply({ updated: now }, 200, cors);
    }
    return reply({ error: { message: 'Method not allowed.' } }, 405, cors);
  }

  // ---------------------------------------------------------------- anonymous answer counts
  if (parts[0] === 'stats') {
    if (method === 'POST') {
      let body;
      try { body = await readJson(request, 64 * 1024); } catch (e) { return reply({ error: { message: 'Bad request.' } }, 400, cors); }
      const events = Array.isArray(body.events) ? body.events.slice(0, 200) : [];
      const stmts = [];
      for (const ev of events) {
        if (!ev || !QID_RE.test(String(ev.q))) continue;
        const ok = ev.ok ? 1 : 0;
        stmts.push(env.DB.prepare('INSERT INTO stats (qid, right, wrong, updated) VALUES (?, ?, ?, ?) ON CONFLICT(qid) DO UPDATE SET right = right + excluded.right, wrong = wrong + excluded.wrong, updated = excluded.updated')
          .bind(String(ev.q), ok, 1 - ok, now));
      }
      if (stmts.length) await env.DB.batch(stmts);
      return reply({ stored: stmts.length }, 200, cors);
    }
    if (method === 'GET') {
      const auth = request.headers.get('Authorization') || '';
      if (!env.STATS_TOKEN || auth !== 'Bearer ' + env.STATS_TOKEN) return reply({ error: { message: 'Not authorised.' } }, 401, cors);
      const { results } = await env.DB.prepare('SELECT qid, right, wrong, updated FROM stats ORDER BY qid').all();
      const learners = await env.DB.prepare('SELECT COUNT(*) AS n FROM sync').first();
      const certs = await env.DB.prepare('SELECT COUNT(*) AS n FROM certs').first();
      return reply({ stats: results, synced_learners: learners ? learners.n : 0, certificates: certs ? certs.n : 0 }, 200, cors);
    }
    return reply({ error: { message: 'Method not allowed.' } }, 405, cors);
  }

  // ---------------------------------------------------------------- certificates
  if (parts[0] === 'cert') {
    if (method === 'POST' && parts.length === 1) {
      let body;
      try { body = await readJson(request, 8 * 1024); } catch (e) { return reply({ error: { message: 'Bad request.' } }, 400, cors); }
      const name = clean(body.name, 60).trim();
      const modules = (Array.isArray(body.modules) ? body.modules : []).slice(0, 12).map((m) => ({
        number: Math.max(0, Math.min(99, parseInt(m.number, 10) || 0)), title: clean(m.title, 80), color: /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#2a78d6'
      }));
      if (!name || !modules.length) return reply({ error: { message: 'A certificate needs a name and at least one passed module.' } }, 400, cors);
      const record = { name, modules, lessons: Math.max(0, parseInt(body.lessons, 10) || 0), correct: Math.max(0, parseInt(body.correct, 10) || 0),
                       date: clean(body.date, 40), issued: new Date(now).toISOString().slice(0, 10) };
      const id = randomCode(10, ALPHABET);
      await env.DB.prepare('INSERT INTO certs (id, data, created) VALUES (?, ?, ?)').bind(id, JSON.stringify(record), now).run();
      return reply({ id, record }, 201, cors);
    }
    if (method === 'GET' && parts[1]) {
      const id = normaliseCode(parts[1]);
      if (!/^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{10}$/.test(id)) return reply({ error: { message: 'That is not a certificate id.' } }, 400, cors);
      const row = await env.DB.prepare('SELECT data, created FROM certs WHERE id = ?').bind(id).first();
      if (!row) return reply({ error: { message: 'No certificate with that id.' } }, 404, cors);
      return reply({ id, record: JSON.parse(row.data), created: row.created }, 200, cors);
    }
    return reply({ error: { message: 'Method not allowed.' } }, 405, cors);
  }
  return reply({ error: { message: 'Not found.' } }, 404, cors);
}
