#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_ID="com.ashika.livetv.webos"
VERSION="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["version"])' "$ROOT/appinfo.json")"
TITLE="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["title"])' "$ROOT/appinfo.json")"
VENDOR="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["vendor"])' "$ROOT/appinfo.json")"
WORK="$ROOT/build/ipk-root"
OUT="$ROOT/dist"
APP_DIR="$WORK/usr/palm/applications/$APP_ID"
PKG_META_DIR="$WORK/usr/palm/packages/$APP_ID"

rm -rf "$ROOT/build" "$OUT"
mkdir -p "$APP_DIR" "$PKG_META_DIR" "$OUT" "$ROOT/build/control"

# Copy only the runtime application files.
cp "$ROOT/appinfo.json" "$ROOT/index.html" "$ROOT/style.css" "$ROOT/stream-refresh.js" "$APP_DIR/"
# Compile the app for the Chromium 53 engine used by webOS TV 4.x.
if [ ! -x "$ROOT/node_modules/.bin/babel" ]; then
  (cd "$ROOT" && npm install --no-save --no-package-lock --no-audit --no-fund @babel/core@7 @babel/cli@7 @babel/preset-env@7)
fi
"$ROOT/node_modules/.bin/babel" "$ROOT/app.js" --config-file "$ROOT/babel.config.json" --out-file "$APP_DIR/app.js"

# Generate a compact 256x256 indexed-colour PNG icon.
python3 - "$APP_DIR/icon.png" <<'PY'
import struct, zlib, sys
w = h = 256
palette = bytes((17, 25, 43, 242, 55, 91))
rows = []
for y in range(h):
    row = bytearray([0])
    for x in range(w):
        dx = abs(x - 128)
        red = (53 <= y <= 205 and dx < (y - 35) * 0.42 and dx > (y - 35) * 0.27)
        red = red or (112 <= y <= 132 and 83 <= x <= 173)
        row.append(1 if red else 0)
    rows.append(bytes(row))
def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
png = (b"\x89PNG\r\n\x1a\n"
       + chunk(b"IHDR", struct.pack(">2I5B", w, h, 8, 3, 0, 0, 0))
       + chunk(b"PLTE", palette)
       + chunk(b"IDAT", zlib.compress(b"".join(rows), 9))
       + chunk(b"IEND", b""))
with open(sys.argv[1], "wb") as f:
    f.write(png)
PY

# webOS requires packageinfo.json in usr/palm/packages/<app-id>.
python3 - "$PKG_META_DIR/packageinfo.json" "$APP_ID" "$VERSION" "$TITLE" "$VENDOR" <<'PY'
import json, sys
path, app_id, version, title, vendor = sys.argv[1:]
info = {
    "app": app_id,
    "id": app_id,
    "loc_name": title,
    "package_format_version": 2,
    "vendor": vendor,
    "version": version,
    "services": []
}
with open(path, "w", encoding="utf-8") as f:
    json.dump(info, f, ensure_ascii=False, indent=2)
    f.write("\n")
PY

cat > "$ROOT/build/control/control" <<EOF
Package: $APP_ID
Version: $VERSION
Section: webos
Priority: optional
Architecture: all
Maintainer: Ashika
Description: Ashika Live TV webOS application
webOS-Package-Format-Version: 2
EOF

printf '2.0\n' > "$ROOT/build/debian-binary"

# Use root ownership, stable GNU tar format and deterministic gzip headers.
tar --format=ustar --owner=0 --group=0 --numeric-owner -cf - -C "$ROOT/build/control" control | gzip -9n > "$ROOT/build/control.tar.gz"
tar --format=ustar --owner=0 --group=0 --numeric-owner -cf - -C "$WORK" usr | gzip -9n > "$ROOT/build/data.tar.gz"

# Build an IPK ar container with bare member names. GNU ar appends '/' to
# short member names; webOS appInstallService expects the exact bare names.
python3 - "$ROOT/build" "$OUT/${APP_ID}_${VERSION}_all.ipk" <<'PY'
import os, sys
root, output = sys.argv[1:]
members = ["debian-binary", "control.tar.gz", "data.tar.gz"]
with open(output, "wb") as out:
    out.write(b"!<arch>\n")
    for name in members:
        data_path = os.path.join(root, name)
        with open(data_path, "rb") as f:
            payload = f.read()
        header = (
            name.encode("ascii").ljust(16, b" ") +
            b"0".ljust(12, b" ") +
            b"0".ljust(6, b" ") +
            b"0".ljust(6, b" ") +
            b"100644".ljust(8, b" ") +
            str(len(payload)).encode("ascii").ljust(10, b" ") +
            b"`\n"
        )
        if len(header) != 60:
            raise SystemExit("Invalid ar header for " + name)
        out.write(header)
        out.write(payload)
        if len(payload) % 2:
            out.write(b"\n")
PY

PKG="$OUT/${APP_ID}_${VERSION}_all.ipk"
SIZE_BYTES="$(wc -c < "$PKG" | tr -d ' ')"
echo "Built: $PKG"
echo "IPK size: $SIZE_BYTES bytes ($(awk -v n="$SIZE_BYTES" 'BEGIN {printf "%.2f MiB", n/1048576}'))"
echo "Package metadata: $PKG_META_DIR/packageinfo.json"
echo "IPK uses bare ar member names and includes webOS packageinfo.json."
