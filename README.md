# Ashika Live TV for LG webOS

Fresh webOS TV application project, version **2.0.0**.

## Features
- M3U and M3U8 playlist import from a local file or URL
- Channel search and group filtering
- HLS playback using hls.js where supported, with native playback fallback
- LG webOS TV-friendly 1920×1080 interface
- Reproducible IPK packaging script
- GitHub Actions build artifact on every push to `main`

## Build locally
On Debian/Ubuntu:
```bash
sudo apt-get update
sudo apt-get install -y binutils python3
chmod +x scripts/build-ipk.sh
./scripts/build-ipk.sh
```
The package is written to `dist/com.ashika.livetv.webos_2.0.0_all.ipk`.

## Build on GitHub
Open the repository's **Actions** tab and select **Build Ashika Live TV IPK**. The workflow runs on pushes to `main` or manually. Download the IPK from the run's **Artifacts** section.

## Install
Install the IPK using the webOS TV Developer Mode / webOS CLI workflow appropriate for your TV model and webOS version. This project is not signed or published through LG Content Store.

## Playlist notes
Use a playlist URL that permits cross-origin browser requests (CORS), or import an M3U/M3U8 file. Stream availability, codecs, geo-restrictions and provider permissions are controlled by the stream provider. Only load streams you are authorized to access.
