#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_ID="com.ashika.livetv.webos"
VERSION="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["version"])' "$ROOT/appinfo.json")"
WORK="$ROOT/build/ipk-root"
OUT="$ROOT/dist"
rm -rf "$ROOT/build" "$OUT"
mkdir -p "$WORK/usr/palm/applications/$APP_ID" "$OUT" "$ROOT/build/control"
cp "$ROOT/appinfo.json" "$ROOT/index.html" "$ROOT/style.css" "$ROOT/app.js" "$WORK/usr/palm/applications/$APP_ID/"
python3 - "$WORK/usr/palm/applications/$APP_ID/icon.png" <<'PY'
import struct,zlib,sys
w=h=256; rows=[]
for y in range(h):
 row=bytearray([0])
 for x in range(w):
  r,g,b=(17,25,43); dx=abs(x-128)
  if 53<=y<=205 and dx<(y-35)*0.42 and dx>(y-35)*0.27:r,g,b=(242,55,91)
  if 112<=y<=132 and 83<=x<=173:r,g,b=(242,55,91)
  row.extend((r,g,b,255))
 rows.append(bytes(row))
def chunk(t,d):return struct.pack(">I",len(d))+t+d+struct.pack(">I",zlib.crc32(t+d)&0xffffffff)
png=b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">2I5B",w,h,8,6,0,0,0))+chunk(b"IDAT",zlib.compress(b"".join(rows),9))+chunk(b"IEND",b"")
open(sys.argv[1],"wb").write(png)
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
tar -czf "$ROOT/build/control.tar.gz" -C "$ROOT/build/control" .
tar -czf "$ROOT/build/data.tar.gz" -C "$WORK" .
(cd "$ROOT/build" && ar r "$OUT/${APP_ID}_${VERSION}_all.ipk" debian-binary control.tar.gz data.tar.gz)
echo "Built: $OUT/${APP_ID}_${VERSION}_all.ipk"
