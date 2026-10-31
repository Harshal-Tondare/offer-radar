// Daily cron: refreshes one company group per day (service -> product -> startup).
const L = require('./_lib');
module.exports = async (req, res) => {
  const sec = process.env.CRON_SECRET;
  if (sec && req.headers.authorization !== 'Bearer ' + sec) return res.status(401).json({ error: 'unauthorized' });
  try {
    const keys = ['service', 'product', 'startup'];
    const group = keys.includes(req.query && req.query.group) ? req.query.group : keys[Math.floor(Date.now() / 864e5) % 3];
    const raw = L.extractJson(await L.claude(L.jobsPrompt(group, '')));
    const rows = (Array.isArray(raw) ? raw : []).map(x => L.toRow(x, group)).filter(Boolean);
    const out = await L.mergeJobs(rows);
    res.status(200).json({ group, added: rows.length, total: out.jobs.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
