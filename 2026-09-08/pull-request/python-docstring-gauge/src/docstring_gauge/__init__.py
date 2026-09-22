"""AST-based Python docstring coverage analysis."""

from .core import Definition, Finding, ScanReport, scan_paths

__all__ = ["Definition", "Finding", "ScanReport", "scan_paths"]
__version__ = "1.0.0"

