#!/usr/bin/env python3
"""Put an extracted albedo map at the level the agent judged, keeping its variation.

`extract_pbr_evidence.py` reads albedo out of a reference crop, and `delight_albedo.py`
flattens the lighting *gradient* inside that crop. Neither can recover exposure: a prop
photographed in a dark blue-hour render comes out at a fraction of its real lightness,
and the generator then forces material colour to white and reads albedo entirely from
the map, so the model renders black.

So the map keeps what the extraction is actually good for — per-texel variation — and
its mean is moved onto the albedo the reference was read as. That split is the skill's
own rule: scripts do enforcement, the agent does visual judgement.

Usage: normalize_albedo.py <albedo.png> <#rrggbb>
"""
import struct
import sys
import zlib
from pathlib import Path


def read_png(path: Path):
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    pos, idat, width, height, channels = 8, b"", 0, 0, 0
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        kind = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + length]
        if kind == b"IHDR":
            width, height, depth, colour = struct.unpack(">IIBB", body[:10])
            assert depth == 8, "expected 8-bit"
            channels = {0: 1, 2: 3, 4: 2, 6: 4}[colour]
        elif kind == b"IDAT":
            idat += body
        pos += 12 + length
    raw = zlib.decompress(idat)
    stride = width * channels
    out = bytearray(width * height * channels)
    previous = bytearray(stride)
    at = 0
    for row in range(height):
        filter_type = raw[at]
        at += 1
        line = bytearray(raw[at:at + stride])
        at += stride
        for i in range(stride):
            left = line[i - channels] if i >= channels else 0
            up = previous[i]
            upleft = previous[i - channels] if i >= channels else 0
            if filter_type == 1:
                line[i] = (line[i] + left) & 255
            elif filter_type == 2:
                line[i] = (line[i] + up) & 255
            elif filter_type == 3:
                line[i] = (line[i] + (left + up) // 2) & 255
            elif filter_type == 4:
                p = left + up - upleft
                pa, pb, pc = abs(p - left), abs(p - up), abs(p - upleft)
                pred = left if (pa <= pb and pa <= pc) else (up if pb <= pc else upleft)
                line[i] = (line[i] + pred) & 255
        out[row * stride:(row + 1) * stride] = line
        previous = line
    return width, height, channels, out


def write_png(path: Path, width: int, height: int, channels: int, pixels: bytearray):
    colour = {1: 0, 2: 4, 3: 2, 4: 6}[channels]
    raw = bytearray()
    stride = width * channels
    for row in range(height):
        raw.append(0)
        raw += pixels[row * stride:(row + 1) * stride]
    def chunk(kind: bytes, body: bytes) -> bytes:
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, colour, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


path = Path(sys.argv[1])
target = sys.argv[2].lstrip("#")
target_rgb = [int(target[i:i + 2], 16) for i in (0, 2, 4)]

width, height, channels, pixels = read_png(path)
count = width * height
means = [sum(pixels[i * channels + c] for i in range(count)) / count for c in range(min(3, channels))]

for c in range(min(3, channels)):
    gain = target_rgb[c] / max(means[c], 1.0)
    for i in range(count):
        at = i * channels + c
        pixels[at] = min(255, int(pixels[at] * gain + 0.5))

write_png(path, width, height, channels, pixels)
after = [sum(pixels[i * channels + c] for i in range(count)) / count for c in range(min(3, channels))]
print(f"{path.name}: mean {[round(m) for m in means]} → {[round(m) for m in after]} (target {target_rgb})")
