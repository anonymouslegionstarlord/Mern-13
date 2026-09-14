"""Safe, dependency-free image metadata inspection."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


class ProbeError(ValueError):
    """Raised when an image header cannot be safely inspected."""


@dataclass(frozen=True)
class ImageInfo:
    path: str
    format: str
    width: int
    height: int
    bytes: int
    megapixels: float
    aspect_ratio: float
    orientation: str
    findings: tuple[str, ...] = ()

    def to_dict(self) -> dict:
        payload = asdict(self)
        payload["findings"] = list(self.findings)
        return payload


SUPPORTED_SUFFIXES = {".png", ".gif", ".jpg", ".jpeg", ".webp"}
EXPECTED_SUFFIXES = {
    "PNG": {".png"},
    "GIF": {".gif"},
    "JPEG": {".jpg", ".jpeg"},
    "WEBP": {".webp"},
}
JPEG_SOF = {
    0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
    0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF,
}


def _positive_dimensions(width: int, height: int) -> tuple[int, int]:
    if width <= 0 or height <= 0:
        raise ProbeError("image dimensions must be positive")
    return width, height


def _png(data: bytes) -> tuple[int, int] | None:
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        return None
    if len(data) < 24 or data[12:16] != b"IHDR":
        raise ProbeError("truncated or malformed PNG header")
    return _positive_dimensions(
        int.from_bytes(data[16:20], "big"),
        int.from_bytes(data[20:24], "big"),
    )


def _gif(data: bytes) -> tuple[int, int] | None:
    if data[:6] not in {b"GIF87a", b"GIF89a"}:
        return None
    if len(data) < 10:
        raise ProbeError("truncated GIF header")
    return _positive_dimensions(
        int.from_bytes(data[6:8], "little"),
        int.from_bytes(data[8:10], "little"),
    )


def _jpeg(data: bytes) -> tuple[int, int] | None:
    if not data.startswith(b"\xff\xd8"):
        return None
    position = 2
    while position < len(data):
        if data[position] != 0xFF:
            raise ProbeError("malformed JPEG marker stream")
        while position < len(data) and data[position] == 0xFF:
            position += 1
        if position >= len(data):
            break
        marker = data[position]
        position += 1
        if marker in {0x01, 0xD8, 0xD9} or 0xD0 <= marker <= 0xD7:
            continue
        if marker == 0xDA:
            break
        if position + 2 > len(data):
            raise ProbeError("truncated JPEG segment length")
        segment_length = int.from_bytes(data[position:position + 2], "big")
        if segment_length < 2 or position + segment_length > len(data):
            raise ProbeError("truncated or invalid JPEG segment")
        if marker in JPEG_SOF:
            if segment_length < 7:
                raise ProbeError("invalid JPEG frame header")
            height = int.from_bytes(data[position + 3:position + 5], "big")
            width = int.from_bytes(data[position + 5:position + 7], "big")
            return _positive_dimensions(width, height)
        position += segment_length
    raise ProbeError("JPEG dimensions were not found before image data")


def _webp(data: bytes) -> tuple[int, int] | None:
    if not (data.startswith(b"RIFF") and len(data) >= 12 and data[8:12] == b"WEBP"):
        return None
    if len(data) < 20:
        raise ProbeError("truncated WebP header")
    kind = data[12:16]
    if kind == b"VP8X":
        if len(data) < 30:
            raise ProbeError("truncated WebP VP8X header")
        width = int.from_bytes(data[24:27], "little") + 1
        height = int.from_bytes(data[27:30], "little") + 1
        return _positive_dimensions(width, height)
    if kind == b"VP8L":
        if len(data) < 25 or data[20] != 0x2F:
            raise ProbeError("malformed WebP VP8L header")
        bits = int.from_bytes(data[21:25], "little")
        return _positive_dimensions((bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1)
    if kind == b"VP8 ":
        if len(data) < 30 or data[23:26] != b"\x9d\x01\x2a":
            raise ProbeError("malformed WebP VP8 frame header")
        width = int.from_bytes(data[26:28], "little") & 0x3FFF
        height = int.from_bytes(data[28:30], "little") & 0x3FFF
        return _positive_dimensions(width, height)
    raise ProbeError("unsupported WebP bitstream type")


def _detect(data: bytes) -> tuple[str, int, int]:
    for name, parser in (("PNG", _png), ("GIF", _gif), ("JPEG", _jpeg), ("WEBP", _webp)):
        dimensions = parser(data)
        if dimensions is not None:
            return name, *dimensions
    raise ProbeError("unsupported or unrecognized image format")


def probe_file(
    path: str | Path,
    *,
    max_header_bytes: int = 4 * 1024 * 1024,
    max_pixels: int = 200_000_000,
) -> ImageInfo:
    candidate = Path(path)
    if max_header_bytes < 30:
        raise ProbeError("max_header_bytes must be at least 30")
    if max_pixels < 1:
        raise ProbeError("max_pixels must be positive")
    if candidate.is_symlink() or not candidate.is_file():
        raise ProbeError("path must be a regular, non-symlink file")
    try:
        with candidate.open("rb") as handle:
            data = handle.read(max_header_bytes)
    except OSError as exc:
        raise ProbeError(f"could not read file: {exc}") from exc
    image_format, width, height = _detect(data)
    pixels = width * height
    if pixels > max_pixels:
        raise ProbeError(f"image has {pixels:,} pixels; limit is {max_pixels:,}")
    ratio = width / height
    orientation = "square" if abs(ratio - 1) <= 0.02 else ("landscape" if ratio > 1 else "portrait")
    suffix = candidate.suffix.lower()
    findings: list[str] = []
    if suffix not in EXPECTED_SUFFIXES[image_format]:
        findings.append(f"extension {suffix or '(none)'} does not match detected {image_format}")
    return ImageInfo(
        path=str(candidate),
        format=image_format,
        width=width,
        height=height,
        bytes=candidate.stat().st_size,
        megapixels=round(pixels / 1_000_000, 4),
        aspect_ratio=round(ratio, 4),
        orientation=orientation,
        findings=tuple(findings),
    )


def _expand(paths: Iterable[str | Path], recursive: bool) -> list[Path]:
    expanded: list[Path] = []
    for raw in paths:
        candidate = Path(raw)
        if candidate.is_dir():
            iterator = candidate.rglob("*") if recursive else candidate.glob("*")
            expanded.extend(
                item for item in iterator
                if item.is_file() and not item.is_symlink() and item.suffix.lower() in SUPPORTED_SUFFIXES
            )
        else:
            expanded.append(candidate)
    return sorted(set(expanded), key=lambda item: str(item).casefold())


def audit_paths(
    paths: Iterable[str | Path],
    *,
    recursive: bool = False,
    max_files: int = 500,
    max_header_bytes: int = 4 * 1024 * 1024,
    max_pixels: int = 200_000_000,
) -> dict:
    if max_files < 1 or max_files > 10_000:
        raise ProbeError("max_files must be between 1 and 10000")
    files = _expand(paths, recursive)
    if not files:
        raise ProbeError("no candidate image files were found")
    if len(files) > max_files:
        raise ProbeError(f"found {len(files)} files; limit is {max_files}")
    items: list[dict] = []
    errors: list[dict] = []
    for candidate in files:
        try:
            items.append(probe_file(
                candidate,
                max_header_bytes=max_header_bytes,
                max_pixels=max_pixels,
            ).to_dict())
        except ProbeError as exc:
            errors.append({"path": str(candidate), "error": str(exc)})
    warning_count = sum(len(item["findings"]) for item in items)
    return {
        "summary": {
            "candidates": len(files),
            "inspected": len(items),
            "errors": len(errors),
            "warnings": warning_count,
        },
        "images": items,
        "errors": errors,
    }
