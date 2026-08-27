"""A11yScout public API."""

from .scanner import Issue, ScanError, scan_file, scan_html, scan_paths

__all__ = ["Issue", "ScanError", "scan_file", "scan_html", "scan_paths"]

