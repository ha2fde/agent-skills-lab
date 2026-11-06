#!/usr/bin/env python3
"""Prepare a WeChat cover and a private Base64 bridge file (no network/credentials).

Usage: python prepare_cover.py INPUT_IMAGE --output-dir /tmp/wechat-cover
Outputs: cover.jpg, cover.b64.txt, manifest.json. Never commit/share the .b64.txt.
"""
import argparse, base64, hashlib, json
from pathlib import Path
from PIL import Image, ImageOps

MAX_BYTES = 128 * 1024
WIDTH, HEIGHT = 900, 383

def prepare(src: Path, out: Path):
    out.mkdir(parents=True, exist_ok=True)
    image = Image.open(src)
    image = ImageOps.exif_transpose(image).convert("RGB")
    # Preserve composition by center cropping to the official target aspect.
    image = ImageOps.fit(image, (WIDTH, HEIGHT), method=Image.Resampling.LANCZOS)
    jpg = out / "cover.jpg"
    for quality in (88, 84, 80, 76, 72, 68, 62, 55, 48):
        image.save(jpg, format="JPEG", quality=quality, optimize=True,
                   progressive=False, subsampling=0 if quality >= 80 else 2)
        if jpg.stat().st_size <= MAX_BYTES:
            break
    size = jpg.stat().st_size
    if size > MAX_BYTES:
        raise RuntimeError(f"Cover is {size} bytes, exceeds Base64 MCP limit {MAX_BYTES}")
    raw = jpg.read_bytes()
    assert raw[:3] == b"\\xff\\xd8\\xff"
    encoded = base64.b64encode(raw).decode("ascii")
    assert base64.b64decode(encoded, validate=True) == raw
    bridge = out / "cover.b64.txt"
    bridge.write_text(encoded, encoding="ascii")
    manifest = {"width": WIDTH, "height": HEIGHT, "mode": "RGB",
                "format": "JPEG", "bytes": size,
                "sha256": hashlib.sha256(raw).hexdigest(),
                "base64_characters": len(encoded), "ready_for_wechat_base64": True}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False))
    print("WARNING: cover.b64.txt contains image data; use only as temporary private bridge and delete after upload.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("image", type=Path)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    prepare(args.image, args.output_dir)
