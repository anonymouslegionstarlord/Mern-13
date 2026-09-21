"""Public API for JUnitLens."""

from .core import Execution, Report, ReportError, analyze, parse_report

__all__ = ["Execution", "Report", "ReportError", "analyze", "parse_report"]
__version__ = "1.0.0"

