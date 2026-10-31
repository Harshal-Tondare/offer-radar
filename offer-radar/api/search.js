const L = require('./_lib');
const hits = new Map(); // simple per-IP limit: 10 live searches / hour / instance
function limited(ip) {
  const now = Date.now(), a = (hits.get(ip) || []).filter(t => now - t < 3600e3);
  a.push(now); hits.set(ip, a); return a.length > 10;
}
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || 'x';
  try {
    if (b.kind === 'process') {
      const ck = 'proc:' + String(b.company).toLowerCase().slice(0, 60);
      const hit = await L.kvGet(ck);
      if (hit && Date.now() - hit.t < 7 * 864e5) return res.status(200).json({ data: hit.data, cached: true });
      if (limited(ip)) return res.status(429).json({ error: 'Too many searches, try again later.' });
      const data = L.extractJson(await L.claude(L.processPrompt(b.company, b.role)));
      if (!Array.isArray(data)) throw new Error('Bad format');
      await L.kvSet(ck, { t: Date.now(), data });
      return res.status(200).json({ data });
    }
    if (b.kind === 'jobs') {
      if (limited(ip)) return res.status(429).json({ error: 'Too many searches, try again later.' });
      const group = /startup/i.test(b.type) ? 'startup' : /product/i.test(b.type) ? 'product' : 'service';
      const raw = L.extractJson(await L.claude(L.jobsPrompt(group, b.query)));
      const rows = (Array.isArray(raw) ? raw : []).map(x => L.toRow(x, group)).filter(Boolean);
      if (L.hasKv()) await L.mergeJobs(rows);
      return res.status(200).json({ data: rows });
    }
    res.status(400).json({ error: 'Unknown kind' });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
