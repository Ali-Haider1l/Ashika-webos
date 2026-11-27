# Ashika Live TV — Ultimate Edition

**Version 8.0.0 · LG webOS**

## Features
- Built-in Bangladesh IPTV, FreeHunter HDTV and Toffee BD playlists (auto-added to the playlist library on first launch)
- Multiple M3U/M3U8 playlists with add, open, rename, remove, explicit Save All, local file import, refresh and persistent on-device library
- Channel search, category groups, favourites, recently watched, A–Z / Z–A sorting
- HLS and MPEG-DASH playback, native media fallback
- HLS quality, audio and subtitle track selection when exposed by the stream
- Automatic reconnect with bounded exponential backoff, HLS decoder/network recovery, DASH error recovery and optional next-channel fallback
- Saved XMLTV/EPG cache for offline viewing of previously loaded programme data; guide refreshes while open
- XMLTV / EPG guide with current/next programme display and live progress bar
- Channel information panel with TVG ID, group, stream host and source URL
- Network online/offline indicator, video resolution and expanded device diagnostics
- Server endpoint diagnostics for DokoPlay, NewEmbedPlay and RTS TV, DokoPlay lookup response parsing, and muted playback probes for up to five returned/current playlist streams
- Parental PIN protection for a configured M3U group (local-only; not encrypted)
- Advanced player controls: 10-second skip back/forward, playback speed (0.5×–2×), volume presets, video Fit/Fill, fullscreen, mute/unmute, retry, stop, next/previous channel and Magic Remote shortcuts (F/M, arrows, Channel Up/Down, Space)
- Sleep timer with 15, 30, 45, 60, 90 and 120 minute auto-stop options
- JSON backup and restore for playlists, favourites, history and settings
- Playlist auto-refresh, Toffee signed-stream URL refresh on playback retry, and device diagnostics (network, storage and playback engines)
- Persistent local settings with legacy storage migration

## Package size and build
- Runtime JavaScript is transpiled for Chromium 53 (webOS TV 4.x), including async/await and modern syntax.
- Layout uses a legacy flexbox fallback so the channel panel and settings remain visible on older LG TVs.
- Playlist startup selects the built-in Bangladesh IPTV list when no valid saved list exists; video playback stays inline until a channel is selected.
- The IPK build uses a compact indexed-colour app icon and maximum gzip compression.
- GitHub Actions checks package contents and reports the actual IPK size; there is no artificial size cap.

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


## Android parity update — 8.0.0
- Added TV-remote friendly Tools & More hub: smart channel finder, stream health, local watch statistics, match center, family profiles, QR pairing, admin channel management, sports shortcuts, language selection and About/contact.
- Added custom channel storage, bulk playlist import and Android companion JSON channel sync.
- Added an in-app mini-player mode for webOS.
- Existing playlist, playback, EPG, subtitle/audio/quality, reconnect, server diagnostics, parental PIN and backup features are retained.
- Google/Firebase account sync is not enabled in this webOS build because the Android repository has no webOS Firebase web-client configuration. Local profiles and companion sync are provided instead.
