# Ashika Live TV — Ultimate Edition

**Version 6.0.0 · LG webOS**

## Features
- Multiple M3U/M3U8 playlists, local file import, playlist refresh and playlist management
- Channel search, category groups, favourites, recently watched, A–Z / Z–A sorting
- HLS and MPEG-DASH playback, native media fallback
- HLS quality, audio and subtitle track selection when exposed by the stream
- Automatic reconnect with bounded exponential backoff and optional next-channel fallback
- XMLTV / EPG guide and current programme display
- Parental PIN protection for a configured M3U group (local-only; not encrypted)
- Video Fit / Fill, fullscreen, mute/unmute, retry, stop, next/previous channel controls and Magic Remote keyboard shortcuts (F/M, Channel Up/Down)
- Sleep timer with 15, 30, 45, 60, 90 and 120 minute auto-stop options
- JSON backup and restore for playlists, favourites, history and settings
- Playlist auto-refresh and device diagnostics (network, storage and playback engines)
- Persistent local settings with legacy storage migration

## Build
```bash
chmod +x scripts/build-ipk.sh
./scripts/build-ipk.sh
```
The IPK should be generated under `dist/`. GitHub Actions can also build it from the Actions tab.

## Important
- HLS quality/audio/subtitle controls appear only if the stream exposes those tracks.
- EPG and remote playlists require provider CORS access.
- PIN protection is a basic local convenience feature, not secure access control; the PIN is stored in browser local storage and should not be used for sensitive content.
- Playback depends on TV model, webOS version, codecs, network, provider and stream availability.
- Use only streams and playlists you are authorized to access.
