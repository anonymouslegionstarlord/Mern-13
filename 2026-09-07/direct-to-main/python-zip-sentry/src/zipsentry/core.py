"""ZIP risk checks that never extract archive members."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path, PurePosixPath
import re
from typing import Literal
import zipfile

Severity = Literal["warning", "error"]


@dataclass(frozen=True, slots=True)
class Finding:
    severity: Severity
    code: str
    message: str
    entry: str | None = None

    def to_dict(self) -> dict[str, str | None]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class InspectionReport:
    archive: str
    entries: int
    files: int
    directories: int
    compressed_bytes: int
    uncompressed_bytes: int
    findings: tuple[Finding, ...]

    @property
    def errors(self) -> int:
        return sum(item.severity == "error" for item in self.findings)

    @property
    def warnings(self) -> int:
        return sum(item.severity == "warning" for item in self.findings)

    def to_dict(self) -> dict[str, object]:
        return {
            "archive": self.archive,
            "summary": {
                "entries": self.entries,
                "files": self.files,
                "directories": self.directories,
                "compressed_bytes": self.compressed_bytes,
                "uncompressed_bytes": self.uncompressed_bytes,
                "warnings": self.warnings,
                "errors": self.errors,
            },
            "findings": [item.to_dict() for item in self.findings],
        }


def _validate_limits(max_entries: int, max_uncompressed: int, max_ratio: float) -> None:
    if not 1 <= max_entries <= 1_000_000:
        raise ValueError("max_entries must be between 1 and 1,000,000")
    if not 1 <= max_uncompressed <= 10 * 1024**4:
        raise ValueError("max_uncompressed must be between 1 byte and 10 TiB")
    if not 1.0 <= max_ratio <= 1_000_000:
        raise ValueError("max_ratio must be between 1 and 1,000,000")


def _unsafe_path(name: str) -> str | None:
    normalized = name.replace("\\", "/")
    if normalized.startswith("/") or re.match(r"^[A-Za-z]:/", normalized):
        return "absolute-path"
    if ".." in PurePosixPath(normalized).parts:
        return "path-traversal"
    return None


def _is_symlink(info: zipfile.ZipInfo) -> bool:
    unix_mode = (info.external_attr >> 16) & 0xFFFF
    return (unix_mode & 0o170000) == 0o120000


def inspect_archive(
    archive: str | Path,
    *,
    max_entries: int = 5_000,
    max_uncompressed: int = 1_073_741_824,
    max_ratio: float = 100.0,
) -> InspectionReport:
    """Inspect ZIP directory metadata and return deterministic findings."""

    _validate_limits(max_entries, max_uncompressed, max_ratio)
    path = Path(archive)
    if not path.is_file():
        raise ValueError(f"archive is not a readable file: {path}")

    findings: list[Finding] = []
    seen: set[str] = set()
    files = directories = compressed = uncompressed = 0

    try:
        with zipfile.ZipFile(path, "r") as handle:
            members = handle.infolist()
            if len(members) > max_entries:
                findings.append(Finding("error", "entry-count-limit", f"archive has {len(members)} entries; limit is {max_entries}"))

            for info in members:
                name = info.filename
                compressed += info.compress_size
                uncompressed += info.file_size
                directories += int(info.is_dir())
                files += int(not info.is_dir())

                path_code = _unsafe_path(name)
                if path_code:
                    findings.append(Finding("error", path_code, "entry could escape the extraction directory", name))
                if name in seen:
                    findings.append(Finding("warning", "duplicate-entry", "entry name appears more than once", name))
                seen.add(name)
                if info.flag_bits & 0x1:
                    findings.append(Finding("warning", "encrypted-entry", "entry is encrypted and contents were not inspected", name))
                if _is_symlink(info):
                    findings.append(Finding("warning", "symbolic-link", "entry is stored as a symbolic link", name))

                ratio = info.file_size / max(info.compress_size, 1)
                if info.file_size and ratio > max_ratio:
                    findings.append(Finding("warning", "compression-ratio", f"ratio {ratio:.1f}:1 exceeds {max_ratio:g}:1", name))

            if uncompressed > max_uncompressed:
                findings.append(Finding(
                    "error", "uncompressed-size-limit",
                    f"uncompressed size {uncompressed} bytes exceeds limit {max_uncompressed}",
                ))
    except (zipfile.BadZipFile, OSError) as error:
        raise ValueError(f"could not inspect ZIP archive: {error}") from error

    findings.sort(key=lambda item: (0 if item.severity == "error" else 1, item.code, item.entry or ""))
    return InspectionReport(
        archive=str(path), entries=files + directories, files=files, directories=directories,
        compressed_bytes=compressed, uncompressed_bytes=uncompressed, findings=tuple(findings),
    )

