const { kvGet } = require('./_lib');
module.exports = async (req, res) => {
  try {
    const data = (await kvGet('jobs')) || { updated: null, jobs: [] };
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    res.status(200).json(data);
  } catch (e) { res.status(200).json({ updated: null, jobs: [], note: e.message }); }
};
