# Ashika Live TV — Ultimate Edition

**Version 6.1.0 · LG webOS**

## Features
- Multiple M3U/M3U8 playlists with add, open, rename, remove, explicit Save All, local file import, refresh and persistent on-device library
- Channel search, category groups, favourites, recently watched, A–Z / Z–A sorting
- HLS and MPEG-DASH playback, native media fallback
- HLS quality, audio and subtitle track selection when exposed by the stream
- Automatic reconnect with bounded exponential backoff and optional next-channel fallback
- XMLTV / EPG guide and current programme display
- Parental PIN protection for a configured M3U group (local-only; not encrypted)
- Advanced player controls: 10-second skip back/forward, playback speed (0.5×–2×), volume presets, video Fit/Fill, fullscreen, mute/unmute, retry, stop, next/previous channel and Magic Remote shortcuts (F/M, arrows, Channel Up/Down, Space)
- Sleep timer with 15, 30, 45, 60, 90 and 120 minute auto-stop options
- JSON backup and restore for playlists, favourites, history and settings
- Playlist auto-refresh and device diagnostics (network, storage and playback engines)
- Persistent local settings with legacy storage migration

## Package size and build
- The IPK build uses a compact indexed-colour app icon and maximum gzip compression.
- GitHub Actions checks the package contents and enforces a 9 MiB maximum IPK size; it never adds dummy files just to inflate the download.

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
