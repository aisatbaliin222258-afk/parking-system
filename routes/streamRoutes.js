const express = require('express');
const router = express.Router();
const streamManager = require('../controllers/streamManager');

// Start or reuse HLS stream for given RTSP URL
// Returns a redirect to the playlist under /streams/:id/index.m3u8
router.get('/hls', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url query parameter' });

  try {
    const result = await streamManager.startStream(url);
    const playlistPath = `/streams/${result.id}/index.m3u8`;
    // Redirect client to actual static playlist so HLS.js can load it
    return res.redirect(302, playlistPath);
  } catch (err) {
    console.error('Error starting stream for', url, err && err.message);
    if (err && err.code === 'INVALID_URL') return res.status(400).json({ error: 'Invalid RTSP URL' });
    if (err && err.code === 'LIMIT') return res.status(429).json({ error: 'Max concurrent streams reached' });
    return res.status(500).json({ error: 'Failed to start stream', detail: err && err.message });
  }
});

// Optional: stop a stream by URL or id
router.post('/stop', express.json(), async (req, res) => {
  const { id, url } = req.body || {};
  if (!id && !url) return res.status(400).json({ error: 'Provide id or url to stop' });
  try {
    let ok = false;
    if (id) ok = await streamManager.stopStreamById(id);
    else ok = await streamManager.stopStreamByUrl(url);
    return res.json({ stopped: ok });
  } catch (err) {
    console.error('Error stopping stream', err);
    return res.status(500).json({ error: 'Failed to stop stream' });
  }
});

module.exports = router;
