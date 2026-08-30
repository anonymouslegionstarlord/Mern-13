"""SQLGuard public API."""

from .core import SqlGuardError, analyze, split_statements

__all__ = ["SqlGuardError", "analyze", "split_statements"]

