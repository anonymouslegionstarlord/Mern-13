"""Create tiny valid header samples for trying PixelProbe."""

from pathlib import Path


OUTPUT = Path(__file__).parent / "generated"
OUTPUT.mkdir(exist_ok=True)

png = b"\x89PNG\r\n\x1a\n" + (13).to_bytes(4, "big") + b"IHDR"
png += (640).to_bytes(4, "big") + (360).to_bytes(4, "big") + b"\x08\x02\x00\x00\x00"
(OUTPUT / "banner.png").write_bytes(png)

gif = b"GIF89a" + (320).to_bytes(2, "little") + (320).to_bytes(2, "little")
(OUTPUT / "avatar.gif").write_bytes(gif)

print(f"Created samples in {OUTPUT}")
