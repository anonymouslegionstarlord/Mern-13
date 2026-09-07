"""Safe, dependency-free ZIP metadata inspection."""

from .core import Finding, InspectionReport, inspect_archive

__all__ = ["Finding", "InspectionReport", "inspect_archive"]
__version__ = "1.0.0"

