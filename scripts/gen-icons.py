#!/usr/bin/env python3
"""Generate every app icon for INFINITY // terminal (pure stdlib, no PIL).

The design is the game's own skin: near-black CRT background (#050805) with a
glowing phosphor-green lemniscate (∞). All drawing is analytic distance-field
rendering, so every size is crisp without supersampling.

Usage:
    python scripts/gen-icons.py            # regenerate everything
    python scripts/gen-icons.py --check    # verify outputs exist, no writes

Outputs:
    src-tauri/icons/    Tauri desktop set (png / ico / icns)
    public/             PWA + favicon set
    resources/          Capacitor asset source (adaptive icon + splash)
"""
from __future__ import annotations

import io
import math
import os
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# game palette (mirrors --bg / --fg in src/ui/terminal.css)
BG = (5, 8, 5)
FG = (57, 255, 110)  # #39ff6e phosphor green


# ---------------------------------------------------------------------------
# PNG container (8-bit truecolor / RGBA), zlib-compressed
# ---------------------------------------------------------------------------

def _png_chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def png_encode(width: int, height: int, rows: list[bytearray]) -> bytes:
    """rows: one bytearray per scanline; width·3 (RGB) or width·4 (RGBA)."""
    channels = len(rows[0]) // width
    raw = b"".join(b"\x00" + bytes(r) for r in rows)  # filter type 0 (None)
    out = b"\x89PNG\r\n\x1a\n"
    out += _png_chunk(
        b"IHDR",
        struct.pack(">IIBBBBB", width, height, 8, 6 if channels == 4 else 2, 0, 0, 0),
    )
    out += _png_chunk(b"IDAT", zlib.compress(raw, 9))
    out += _png_chunk(b"IEND", b"")
    return out


def write_png(path: str, width: int, height: int, rows: list[bytearray]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(png_encode(width, height, rows))


# ---------------------------------------------------------------------------
# Lemniscate renderer (analytic distance field, per-pixel AA)
# ---------------------------------------------------------------------------

def _clamp01(v: float) -> float:
    return 0.0 if v < 0.0 else (1.0 if v > 1.0 else v)


def render_icon(
    size: int,
    span: float = 0.62,
    transparent_bg: bool = False,
    max_work: int = 900_000,
) -> list[bytearray]:
    """size×size icon: background + glowing ∞.

    span  — total symbol width as a fraction of the canvas edge.
    bg    — solid game colour, or transparent for adaptive-icon foregrounds.
    Icons larger than ~max_work pixels render at half resolution and upscale
    (nearest 2×): the halo hides any seams.
    """
    if size >= 2 and size * size > max_work:
        half = render_icon(size // 2, span, transparent_bg)
        ch = 4 if transparent_bg else 3
        rows: list[bytearray] = []
        for r in half:
            big = bytearray()
            for i in range(size // 2):
                big.extend(r[i * ch : (i + 1) * ch] * 2)
            rows.append(big)
            rows.append(bytearray(big))
        return rows

    ch = 4 if transparent_bg else 3
    bg_row = bytes(BG) + (b"\x00" if transparent_bg else b"")

    # geometry: two circles of radius R, centres at ±c around the canvas centre
    R = size * span / 4.17
    hw = 0.306 * R  # stroke half-width
    c = 0.78 * R
    cy = size / 2.0
    cx = size / 2.0
    glow_fall = 0.5 * R

    reach = hw + 3.2 * glow_fall  # halo cut-off: glow < 1/255 beyond this
    x0 = max(0, int(math.floor(cx - c - R - reach)))
    x1 = min(size, int(math.ceil(cx + c + R + reach)))
    y0 = max(0, int(math.floor(cy - R - reach)))
    y1 = min(size, int(math.ceil(cy + R + reach)))

    rows = [bytearray(bg_row * size) for _ in range(size)]

    if R <= 0:  # span=0 → flat background plate only
        return rows

    for y in range(y0, y1):
        fy = y + 0.5 - cy
        row = rows[y]
        for x in range(x0, x1):
            fx = x + 0.5 - cx
            dmin = min(
                abs(math.hypot(fx - c, fy) - R),
                abs(math.hypot(fx + c, fy) - R),
            )
            core = _clamp01(hw + 0.5 - dmin)
            glow = _clamp01(0.55 * math.exp(-max(0.0, dmin - hw) / glow_fall))
            alpha = glow * (1.0 - core) + core
            if alpha < 0.004:
                continue
            i = x * ch
            for k in range(3):
                row[i + k] = int(FG[k] * alpha + row[i + k] * (1.0 - alpha) + 0.5)
            if ch == 4:
                row[i + 3] = min(255, int(row[i + 3] + (255 - row[i + 3]) * alpha + 0.5))
    return rows


def png_bytes(size: int, **kw) -> bytes:
    return png_encode(size, size, render_icon(size, **kw))


# ---------------------------------------------------------------------------
# ICO (Windows): directory of PNG-encoded entries
# ---------------------------------------------------------------------------

def write_ico(path: str, entries: list[tuple[int, bytes]]) -> None:
    out = struct.pack("<HHH", 0, 1, len(entries))
    offset = 6 + 16 * len(entries)
    directory = b""
    for size_px, data in entries:
        dim = size_px if size_px < 256 else 0
        directory += struct.pack("<BBBBHHII", dim, dim, 0, 0, 1, 32, len(data), offset)
        offset += len(data)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(out + directory + b"".join(d for _, d in entries))


# ---------------------------------------------------------------------------
# ICNS (macOS): 'icns' header + tagged PNG blocks
# ---------------------------------------------------------------------------

_ICNS_TYPES = {
    16: b"icp4",
    32: b"icp5",
    64: b"icp6",
    128: b"ic07",
    256: b"ic08",
    512: b"ic09",
    1024: b"ic10",
}


def write_icns(path: str, entries: list[tuple[int, bytes]]) -> None:
    body = b""
    for size_px, data in entries:
        tag = _ICNS_TYPES.get(size_px)
        if tag is not None:
            body += tag + struct.pack(">I", len(data) + 8) + data
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(b"icns" + struct.pack(">I", len(body) + 8) + body)


# ---------------------------------------------------------------------------
# driver
# ---------------------------------------------------------------------------

def emit(path: str, size: int, **kw) -> None:
    write_png(path, size, size, render_icon(size, **kw))
    print(f"  {os.path.relpath(path, ROOT)}  ({size}x{size})")


NEEDED = [
    "src-tauri/icons/32x32.png",
    "src-tauri/icons/128x128.png",
    "src-tauri/icons/128x128@2x.png",
    "src-tauri/icons/icon.ico",
    "src-tauri/icons/icon.icns",
    "public/favicon-16.png",
    "public/favicon-32.png",
    "public/apple-touch-icon.png",
    "public/icon-192.png",
    "public/icon-512.png",
    "public/icon-maskable-512.png",
    "resources/icon.png",
    "resources/icon-foreground.png",
    "resources/icon-background.png",
    "resources/splash.png",
    "resources/splash-dark.png",
]


def main() -> int:
    if "--check" in sys.argv:
        missing = [p for p in NEEDED if not os.path.exists(os.path.join(ROOT, p))]
        for p in missing:
            print(f"MISSING {p}")
        print(f"{len(NEEDED) - len(missing)}/{len(NEEDED)} present")
        return 1 if missing else 0

    print("rendering icons...")

    # --- Tauri desktop set ---
    emit(os.path.join(ROOT, "src-tauri/icons/32x32.png"), 32)
    emit(os.path.join(ROOT, "src-tauri/icons/128x128.png"), 128)
    emit(os.path.join(ROOT, "src-tauri/icons/128x128@2x.png"), 256)
    write_ico(
        os.path.join(ROOT, "src-tauri/icons/icon.ico"),
        [(s, png_bytes(s)) for s in (16, 32, 48, 256)],
    )
    print("  src-tauri/icons/icon.ico  (16/32/48/256)")
    write_icns(
        os.path.join(ROOT, "src-tauri/icons/icon.icns"),
        [(s, png_bytes(s)) for s in (16, 32, 64, 128, 256, 512, 1024)],
    )
    print("  src-tauri/icons/icon.icns  (16..1024)")

    # --- PWA + favicon set ---
    emit(os.path.join(ROOT, "public/favicon-16.png"), 16)
    emit(os.path.join(ROOT, "public/favicon-32.png"), 32)
    emit(os.path.join(ROOT, "public/apple-touch-icon.png"), 180)
    emit(os.path.join(ROOT, "public/icon-192.png"), 192)
    emit(os.path.join(ROOT, "public/icon-512.png"), 512)
    emit(
        os.path.join(ROOT, "public/icon-maskable-512.png"),
        512,
        span=0.42,  # keep the symbol inside the 80% mask safe-zone circle
    )

    # --- Capacitor asset source (@capacitor/assets input) ---
    emit(os.path.join(ROOT, "resources/icon.png"), 1024)
    emit(
        os.path.join(ROOT, "resources/icon-foreground.png"),
        1024,
        span=0.5,
        transparent_bg=True,  # adaptive-icon foreground layer
    )
    plate = [bytearray(bytes(BG) * 1024) for _ in range(1024)]
    write_png(os.path.join(ROOT, "resources/icon-background.png"), 1024, 1024, plate)
    print("  resources/icon-background.png  (1024x1024 solid plate)")

    for name in ("splash.png", "splash-dark.png"):
        size = 2732
        write_png(
            os.path.join(ROOT, f"resources/{name}"),
            size,
            size,
            render_icon(size, span=0.23),
        )
        print(f"  resources/{name}  ({size}x{size})")

    print("done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
