# Ashika Live TV for LG webOS

Version **3.0.0** — expanded TV app project.

## Features
- Multiple saved M3U/M3U8 playlists with add, open, refresh and delete controls
- Local M3U file import and remote playlist URL support
- Automatic playlist refresh (15 minutes, 30 minutes, 1 hour or 3 hours)
- Channel search, category filters and favourites
- Channel logos from M3U tvg-logo metadata
- XMLTV / EPG TV Guide and current programme display
- HLS playback through hls.js, MPEG-DASH through dash.js, and native media fallback
- Remote-friendly focus navigation and large TV layout
- Playback error status and optional next-channel fallback
- Local settings and playlist persistence
- Reproducible IPK packaging and GitHub Actions artifact

## Build locally
On Debian/Ubuntu:
```bash
sudo apt-get update
sudo apt-get install -y binutils python3
chmod +x scripts/build-ipk.sh
./scripts/build-ipk.sh
```
The package is written to `dist/com.ashika.livetv.webos_3.0.0_all.ipk`.

## Build on GitHub
Open **Actions** → **Build Ashika Live TV IPK**. It runs on pushes to `main` or manually. Download the IPK from the workflow run's Artifacts section.

## Important notes
- Playlist and EPG URLs must permit browser cross-origin (CORS) requests. A URL that works in a normal browser tab may still block app fetch requests.
- HLS/DASH support depends on the TV's webOS browser engine, codecs, stream format and provider configuration. Some streams may not play on older TV models.
- Auto-refresh works for remote URL playlists; locally imported files cannot be re-fetched automatically.
- EPG requires XMLTV data and matching M3U `tvg-id` / XMLTV channel IDs.
- Use only playlists and streams you are authorized to access. This app does not provide TV channels or subscription access.
- The build artifact is not an LG Content Store release. Install through the Developer Mode / webOS CLI workflow for your TV.
