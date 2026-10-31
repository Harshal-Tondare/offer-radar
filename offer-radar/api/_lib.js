// Shared helpers: Claude + web search, JSON extraction, tiny Redis (Upstash REST) store.
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const GROUPS = {
  service: {
    label: 'Service-based',
    names: 'TCS, Infosys, Wipro, Cognizant, Accenture, Capgemini, HCLTech, Tech Mahindra, LTIMindtree, Mphasis, Hexaware, Persistent, Coforge, Genpact, Deloitte, EY GDS, Zensar, Birlasoft'
  },
  product: {
    label: 'Product / MNC',
    names: 'Google, Microsoft, Amazon, Salesforce, Adobe, Oracle, Cisco, Walmart Global Tech, Atlassian, Intuit, SAP, Flipkart, PayPal, Uber'
  },
  startup: {
    label: 'Startup',
    names: 'funded startups and scale-ups hiring freshers in India (Bengaluru, Hyderabad, Pune, Delhi NCR, Chennai)'
  }
};

async function claude(prompt) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      max_tokens: 2000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const j = await r.json();
  if (!r.ok) throw new Error((j.error && j.error.message) || 'Anthropic API error');
  return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
}

function extractJson(t) {
  const m = String(t).replace(/```json|```/g, '').match(/[\[{][\s\S]*[\]}]/);
  if (!m) throw new Error('No JSON in model reply');
  return JSON.parse(m[0]);
}

const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

function jobsPrompt(group, query) {
  const g = GROUPS[group] || GROUPS.service;
  return `Search the web for fresher or internship openings in India that accept the graduating batch of 2027, at ${g.label} companies (${g.names}). ${clip(query, 80)}
Prefer official careers pages or reputable job boards; only include roles that look currently open. Return ONLY a JSON array of up to 8 objects with keys: s ("sde","data" or "ai"), t (title), c (company), l (location), u (real https URL you found), b (batch text), n (one-line note). No other text.`;
}

function processPrompt(company, role) {
  return `Search the web for the current hiring process of ${clip(company, 60)} for freshers/interns in India (batch 2027), role: ${clip(role, 100)}.
Return ONLY a JSON array of exactly 5 items [title,[up to 3 short bullet strings]] with titles in this order: Eligibility Criteria, Application & Pathways, Online Assessment, Technical Interview, HR / Final Round. State uncertainty plainly. No other text.`;
}

function toRow(x, group) {
  const url = clip(x.u, 400);
  if (!/^https:\/\//.test(url) || !x.t || !x.c) return null;
  const s = ['sde', 'data', 'ai'].includes(x.s) ? x.s : 'sde';
  const row = [s, clip(x.t, 120), clip(x.c, 60), clip(x.l || 'India', 60), 'Job / Internship', 'Web search', url,
    clip(x.b || '2027', 40), 'Found ' + new Date().toDateString().slice(4), clip(x.n, 200)];
  row[10] = (GROUPS[group] || GROUPS.service).label;
  return row;
}

async function kv(cmd) {
  if (!KV_URL || !KV_TOKEN) return null;
  const r = await fetch(KV_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + KV_TOKEN }, body: JSON.stringify(cmd) });
  const j = await r.json();
  return j.result;
}
async function kvGet(k) { const v = await kv(['GET', k]); return v ? JSON.parse(v) : null; }
async function kvSet(k, v) { return kv(['SET', k, JSON.stringify(v)]); }

async function mergeJobs(rows) {
  const cur = (await kvGet('jobs')) || { jobs: [] };
  const key = d => (d[1] + '|' + d[2]).toLowerCase();
  const seen = new Set(), out = [];
  rows.concat(cur.jobs).forEach(d => { const k = key(d); if (!seen.has(k)) { seen.add(k); out.push(d); } });
  const next = { updated: new Date().toISOString(), jobs: out.slice(0, 150) };
  await kvSet('jobs', next);
  return next;
}

module.exports = { GROUPS, claude, extractJson, jobsPrompt, processPrompt, toRow, kvGet, kvSet, mergeJobs, hasKv: () => !!(KV_URL && KV_TOKEN) };
