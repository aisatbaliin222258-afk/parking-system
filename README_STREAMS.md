RTSP -> HLS stream relay

This backend provides an endpoint to relay RTSP camera streams into HLS playlists served to the frontend.

Endpoints:
- GET /api/stream/hls?url=<RTSP_URL>
  Starts (or reuses) an ffmpeg process that converts the RTSP stream into HLS files under /streams/:id/index.m3u8 and redirects to that playlist.

- POST /api/stream/stop
  JSON body { id: '<id>' } or { url: 'rtsp://...' } to stop a running stream.

Notes:
- Requires ffmpeg installed and available in PATH.
- Configuration via env vars:
  - MAX_STREAMS (default 8)
  - STREAM_INACTIVITY_SEC (default 120)

Security:
- Only rtsp:// URLs are accepted. The URL is hashed to create a folder id.
- Spawn is used with argument array to avoid shell injection.

Cleanup:
- Streams are automatically cleaned up after inactivity. Manual stop available via POST /api/stream/stop.
