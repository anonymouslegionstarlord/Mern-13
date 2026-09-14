from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from pixelprobe.cli import main
from pixelprobe.core import ProbeError, audit_paths, probe_file


def png(width: int, height: int) -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n"
        + (13).to_bytes(4, "big")
        + b"IHDR"
        + width.to_bytes(4, "big")
        + height.to_bytes(4, "big")
    )


class PixelProbeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def write(self, name: str, content: bytes) -> Path:
        target = self.root / name
        target.write_bytes(content)
        return target

    def test_png_dimensions_and_orientation(self):
        info = probe_file(self.write("wide.png", png(1200, 600)))
        self.assertEqual((info.format, info.width, info.height), ("PNG", 1200, 600))
        self.assertEqual(info.orientation, "landscape")

    def test_gif_dimensions(self):
        info = probe_file(self.write("small.gif", b"GIF89a\x20\x00\x10\x00"))
        self.assertEqual((info.width, info.height), (32, 16))

    def test_jpeg_dimensions(self):
        frame = b"\xff\xc0\x00\x11\x08\x00\x64\x00\xc8" + b"\x03" + b"\x01\x11\x00" * 3
        info = probe_file(self.write("photo.jpg", b"\xff\xd8" + frame + b"\xff\xd9"))
        self.assertEqual((info.format, info.width, info.height), ("JPEG", 200, 100))

    def test_webp_vp8x_dimensions(self):
        content = b"RIFF\x16\x00\x00\x00WEBPVP8X\x0a\x00\x00\x00" + b"\x00\x00\x00\x00"
        content += (799).to_bytes(3, "little") + (599).to_bytes(3, "little")
        info = probe_file(self.write("card.webp", content))
        self.assertEqual((info.width, info.height), (800, 600))

    def test_extension_mismatch_is_warning(self):
        info = probe_file(self.write("renamed.jpg", png(2, 3)))
        self.assertEqual(info.format, "PNG")
        self.assertEqual(len(info.findings), 1)

    def test_unsupported_file_is_error(self):
        with self.assertRaisesRegex(ProbeError, "unsupported"):
            probe_file(self.write("unknown.png", b"not an image"))

    def test_pixel_limit_is_enforced(self):
        with self.assertRaisesRegex(ProbeError, "limit"):
            probe_file(self.write("huge.png", png(100, 100)), max_pixels=9_999)

    def test_directory_scan_skips_unrelated_files(self):
        self.write("one.png", png(4, 4))
        self.write("notes.txt", b"hello")
        report = audit_paths([self.root])
        self.assertEqual(report["summary"]["candidates"], 1)

    def test_scan_collects_bad_file_without_crashing(self):
        self.write("good.png", png(4, 4))
        self.write("bad.gif", b"GIF89a")
        report = audit_paths([self.root])
        self.assertEqual(report["summary"]["inspected"], 1)
        self.assertEqual(report["summary"]["errors"], 1)

    def test_file_limit_is_enforced(self):
        self.write("one.png", png(1, 1))
        self.write("two.png", png(2, 2))
        with self.assertRaisesRegex(ProbeError, "limit"):
            audit_paths([self.root], max_files=1)

    def test_cli_json_success(self):
        target = self.write("square.png", png(10, 10))
        with patch("builtins.print") as mocked:
            code = main([str(target), "--format", "json"])
        self.assertEqual(code, 0)
        json.loads(mocked.call_args.args[0])


if __name__ == "__main__":
    unittest.main()
