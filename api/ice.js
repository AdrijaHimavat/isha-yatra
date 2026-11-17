// Hands the game short-lived TURN relay credentials for voice calls.
// The Cloudflare key stays on the server: set CF_TURN_KEY_ID and CF_TURN_API_TOKEN in the Vercel project settings.
// Without them this returns an empty list and the game falls back to STUN only.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const empty = () => res.status(200).json({ iceServers: [] });
  const origin = req.headers.origin || req.headers.referer || '';
  if (origin && !/^https:\/\/(isha-yatra[\w-]*\.vercel\.app)(\/|$)/.test(origin)) return empty();
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
