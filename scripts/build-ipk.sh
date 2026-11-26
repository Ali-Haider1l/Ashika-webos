#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_ID="com.ashika.livetv.webos"
VERSION="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["version"])' "$ROOT/appinfo.json")"
WORK="$ROOT/build/ipk-root"
OUT="$ROOT/dist"
APP_DIR="$WORK/usr/palm/applications/$APP_ID"

rm -rf "$ROOT/build" "$OUT"
mkdir -p "$APP_DIR" "$OUT" "$ROOT/build/control"

# Package only the files required at runtime.
cp "$ROOT/appinfo.json" "$ROOT/index.html" "$ROOT/style.css" "$ROOT/app.js" "$APP_DIR/"

# Generate a compact 256x256 indexed-colour PNG icon (two colours).
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

cat > "$ROOT/build/control/control" <<EOF
Package: $APP_ID
Version: $VERSION
Section: webos
Priority: optional
Architecture: all
Maintainer: Ashika
Description: Ashika Live TV webOS application
EOF

printf '2.0\n' > "$ROOT/build/debian-binary"
tar -cf - -C "$ROOT/build/control" . | gzip -9n > "$ROOT/build/control.tar.gz"
tar -cf - -C "$WORK" . | gzip -9n > "$ROOT/build/data.tar.gz"
(
  cd "$ROOT/build"
  ar r "$OUT/${APP_ID}_${VERSION}_all.ipk" debian-binary control.tar.gz data.tar.gz
)

PKG="$OUT/${APP_ID}_${VERSION}_all.ipk"
SIZE_BYTES="$(wc -c < "$PKG" | tr -d ' ')"
echo "Built: $PKG"
echo "IPK size: $SIZE_BYTES bytes ($(awk -v n="$SIZE_BYTES" 'BEGIN {printf "%.2f MiB", n/1048576}'))"
echo "No artificial package-size limit is applied."
