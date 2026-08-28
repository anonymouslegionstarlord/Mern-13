"""TableDiff public API."""

from .core import DiffError, Table, compare_tables, read_table

__all__ = ["DiffError", "Table", "compare_tables", "read_table"]

