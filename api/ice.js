// Hands the game TURN relay servers for voice calls. Set in the Vercel project settings either
//   TURN_URLS (comma separated, e.g. turn:relay1.expressturn.com:3478), TURN_USERNAME, TURN_CREDENTIAL  (free static relay), or
//   CF_TURN_KEY_ID and CF_TURN_API_TOKEN  (Cloudflare, short-lived credentials).
// Without them this returns an empty list and the game falls back to STUN only.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const empty = () => res.status(200).json({ iceServers: [] });
  const origin = req.headers.origin || req.headers.referer || '';
  if (origin && !/^https:\/\/(isha-yatra[\w-]*\.vercel\.app)(\/|$)/.test(origin)) return empty();
  const { TURN_URLS, TURN_USERNAME, TURN_CREDENTIAL } = process.env;
  if (TURN_URLS && TURN_USERNAME && TURN_CREDENTIAL) {
    const urls = TURN_URLS.split(',').map(u => u.trim()).filter(Boolean);
    return res.status(200).json({ iceServers: [{ urls, username: TURN_USERNAME, credential: TURN_CREDENTIAL }] });
  }
  const id = process.env.CF_TURN_KEY_ID, token = process.env.CF_TURN_API_TOKEN;
  if (!id || !token) return empty();
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(id)}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 7200 }),
    });
    if (!r.ok) return empty();
    const j = await r.json();
    const list = [].concat(j.iceServers || []).map(s => {
      // browsers refuse port 53, so drop those addresses
      const urls = [].concat(s.urls || []).filter(u => !/:53(\?|$)/.test(u));
      return urls.length ? { urls, username: s.username, credential: s.credential } : null;
    }).filter(Boolean);
    res.status(200).json({ iceServers: list });
  } catch (_) { empty(); }
};
