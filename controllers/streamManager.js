const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const STREAMS_DIR = path.join(__dirname, '..', 'streams');
const MAX_STREAMS = parseInt(process.env.MAX_STREAMS || '8', 10);
const INACTIVITY_TIMEOUT = parseInt(process.env.STREAM_INACTIVITY_SEC || '120', 10) * 1000; // ms

if (!fs.existsSync(STREAMS_DIR)) fs.mkdirSync(STREAMS_DIR, { recursive: true });

const streams = new Map(); // id -> {url, folder, proc, lastAccess, starting}

function idFromUrl(url) {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 12);
}

function validateRtspUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'rtsp:';
  } catch (err) {
    return false;
  }
}

async function startStream(url) {
  if (!validateRtspUrl(url)) {
    const e = new Error('Invalid RTSP URL');
    e.code = 'INVALID_URL';
    throw e;
  }

  const id = idFromUrl(url);
  if (streams.has(id)) {
    const s = streams.get(id);
    s.lastAccess = Date.now();
    return { id, folder: s.folder };
  }

  if (streams.size >= MAX_STREAMS) {
    const e = new Error('Max streams limit reached');
    e.code = 'LIMIT';
    throw e;
  }

  const folder = path.join(STREAMS_DIR, id);
  await fs.promises.mkdir(folder, { recursive: true });

  const playlistPath = path.join(folder, 'index.m3u8');
  const segmentPattern = path.join(folder, 'segment_%03d.ts');

  // Build ffmpeg args
  const args = [
    '-rtsp_transport', 'tcp',
    '-i', url,
    '-fflags', '+genpts',
    '-analyzeduration', '2000000',
    '-probesize', '2000000',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-profile:v', 'main',
    '-crf', '23',
    '-g', '50',
    '-sc_threshold', '0',
    '-c:a', 'aac',
    '-ar', '44100',
    '-b:a', '128k',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '3',
    '-hls_flags', 'delete_segments+append_list',
    '-hls_segment_filename', segmentPattern,
    playlistPath
  ];

  const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });

  const s = {
    url,
    id,
    folder,
    proc,
    lastAccess: Date.now(),
    playlistPath,
    starting: true,
    lastError: null
  };

  streams.set(id, s);

  proc.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    s.lastError = text;
    console.log(`[ffmpeg:${id}]`, text.replace(/\n$/, ''));
  });

  proc.on('exit', (code, signal) => {
    console.warn(`ffmpeg process for ${id} exited code=${code} signal=${signal}`);
    if (streams.has(id)) {
      const existing = streams.get(id);
      if (existing.proc && existing.proc.pid === proc.pid) {
        existing.proc = null;
      }
    }
  });

  proc.on('error', (err) => {
    console.error(`ffmpeg spawn error for ${id}:`, err);
    s.lastError = err.message;
  });

  // Wait for playlist to be created (simple poll)
  const start = Date.now();
  const timeout = 15000; // 15s to first playlist
  while (Date.now() - start < timeout) {
    try {
      if (fs.existsSync(playlistPath) && fs.statSync(playlistPath).size > 0) {
        s.starting = false;
        return { id, folder };
      }
    } catch (err) {
      // ignore
    }
    // sleep 500ms
    await new Promise((r) => setTimeout(r, 500));
  }

  s.starting = false;
  const err = new Error('FFmpeg did not produce playlist in time');
  err.code = 'FFMPEG_NO_PLAYLIST';
  throw err;
}

async function stopStreamById(id) {
  const s = streams.get(id);
  if (!s) return false;
  try {
    if (s.proc && !s.proc.killed) {
      s.proc.kill('SIGTERM');
      setTimeout(() => {
        try { if (s.proc && !s.proc.killed) s.proc.kill('SIGKILL'); } catch(e){}
      }, 5000);
    }
  } catch (e) {
    console.warn('Error killing ffmpeg proc', e);
  }
  streams.delete(id);
  try {
    await fs.promises.rm(s.folder, { recursive: true, force: true });
  } catch (e) {
    console.warn('Failed to remove stream folder', s.folder, e);
  }
  return true;
}

async function stopStreamByUrl(url) {
  const id = idFromUrl(url);
  return stopStreamById(id);
}

function getStreamInfo(id) {
  return streams.get(id) || null;
}

// Periodic cleanup of inactive streams
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of streams.entries()) {
    if (!s) continue;
    if ((!s.proc || s.proc.killed) && (now - s.lastAccess) > INACTIVITY_TIMEOUT) {
      console.log('Cleaning up inactive stream', id);
      stopStreamById(id).catch((e) => console.warn('cleanup error', e));
    } else if (s.proc && (now - s.lastAccess) > INACTIVITY_TIMEOUT) {
      console.log('Killing inactive ffmpeg for', id);
      try { s.proc.kill('SIGTERM'); } catch(e){}
    }
  }
}, Math.max(5000, INACTIVITY_TIMEOUT / 3));

module.exports = {
  startStream,
  stopStreamById,
  stopStreamByUrl,
  getStreamInfo,
  STREAMS_DIR
};
