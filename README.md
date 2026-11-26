# Ashika Live TV for LG webOS

**Version 5.0.0 — Ultimate Edition**

## Features
- Multiple saved M3U/M3U8 playlists, local file import, URL refresh and playlist management
- Channel search, categories, favourites, recent history and A–Z / Z–A sorting
- Channel logos from M3U metadata
- XMLTV / EPG programme guide
- HLS (hls.js), MPEG-DASH (dash.js) and native media playback
- HLS quality, audio and subtitle track selection when exposed by the stream
- Video Fit / Fill, retry playback and bounded automatic reconnect with exponential backoff
- Optional next-channel fallback after fatal playback errors
- Remote navigation: arrows, OK, Page Up / Page Down and Channel Up / Down
- JSON backup and restore for playlists, favourites, history and settings
- Local persistence with migration from the previous v3 storage key
- TV-focused responsive interface and reproducible IPK packaging

## Build locally
On Debian/Ubuntu:
```bash
sudo apt-get update
sudo apt-get install -y binutils python3
chmod +x scripts/build-ipk.sh
./scripts/build-ipk.sh
```
The package is written to `dist/com.ashika.livetv.webos_5.0.0_all.ipk`.

## Build on GitHub
Open **Actions → Build Ashika Live TV IPK**. It runs on pushes to `main` or manually. Download the IPK from the workflow run's Artifacts section.

## Important notes
- Playlist and EPG URLs must permit browser CORS requests.
- HLS/DASH support depends on TV model, webOS browser engine, codecs, stream format and provider configuration.
- Quality/audio/subtitle choices are available only when the stream exposes those tracks.
- Automatic reconnect cannot repair expired URLs, provider-side outages, DRM restrictions or unsupported codecs.
- Use only playlists and streams you are authorized to access.
- This IPK is a sideload package, not an LG Content Store release. Install using Developer Mode / webOS CLI.
