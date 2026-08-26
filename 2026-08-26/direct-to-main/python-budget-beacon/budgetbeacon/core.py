"""Validation, persistence, and reporting for BudgetBeacon."""

from __future__ import annotations

import json
import re
import uuid
from dataclasses import asdict, dataclass
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from typing import Iterable

MONEY = Decimal("0.01")
MONTH_PATTERN = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


class BudgetError(ValueError):
    """Raised for invalid budget data or storage."""


@dataclass(frozen=True, slots=True)
class Transaction:
    id: str
    date: str
    kind: str
    amount: Decimal
    category: str
    note: str = ""

    def to_dict(self) -> dict[str, str]:
        data = asdict(self)
        data["amount"] = f"{self.amount:.2f}"
        return data


def _money(value: object, *, positive: bool = True) -> Decimal:
    try:
        amount = Decimal(str(value)).quantize(MONEY, rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError) as exc:
        raise BudgetError("Amount must be a valid number") from exc
    if not amount.is_finite() or (positive and amount <= 0):
        raise BudgetError("Amount must be greater than zero")
    return amount


def _date(value: str) -> str:
    try:
        return date.fromisoformat(value).isoformat()
    except (TypeError, ValueError) as exc:
        raise BudgetError("Date must use YYYY-MM-DD and be a real calendar date") from exc


def _category(value: str) -> str:
    cleaned = " ".join(str(value).split())
    if not cleaned or len(cleaned) > 40:
        raise BudgetError("Category is required and must be at most 40 characters")
    return cleaned


def add_transaction(kind: str, amount: object, category: str, *, on_date: str | None = None, note: str = "") -> Transaction:
    normalized_kind = str(kind).lower()
    if normalized_kind not in {"income", "expense"}:
        raise BudgetError("Kind must be income or expense")
    cleaned_note = " ".join(str(note).split())
    if len(cleaned_note) > 160:
        raise BudgetError("Note must be at most 160 characters")
    return Transaction(
        id=uuid.uuid4().hex[:12],
        date=_date(on_date or date.today().isoformat()),
        kind=normalized_kind,
        amount=_money(amount),
        category=_category(category),
        note=cleaned_note,
    )


def transaction_from_dict(raw: object) -> Transaction:
    if not isinstance(raw, dict):
        raise BudgetError("Each stored transaction must be an object")
    transaction = add_transaction(
        raw.get("kind", ""), raw.get("amount", ""), raw.get("category", ""),
        on_date=raw.get("date"), note=raw.get("note", ""),
    )
    identifier = str(raw.get("id", "")).strip()
    if not re.fullmatch(r"[a-zA-Z0-9_-]{4,64}", identifier):
        raise BudgetError("Stored transaction has an invalid ID")
    return Transaction(identifier, transaction.date, transaction.kind, transaction.amount, transaction.category, transaction.note)


def load_transactions(path: str | Path) -> list[Transaction]:
    source = Path(path)
    if not source.exists():
        return []
    try:
        raw = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise BudgetError(f"Could not read a valid JSON data file: {exc}") from exc
    if not isinstance(raw, list):
        raise BudgetError("The data file must contain a JSON list")
    transactions = [transaction_from_dict(item) for item in raw]
    if len({item.id for item in transactions}) != len(transactions):
        raise BudgetError("The data file contains duplicate transaction IDs")
    return transactions


def save_transactions(path: str | Path, transactions: Iterable[Transaction]) -> None:
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    payload = [item.to_dict() for item in transactions]
    try:
        temporary.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        temporary.replace(destination)
    except OSError as exc:
        temporary.unlink(missing_ok=True)
        raise BudgetError(f"Could not save the data file: {exc}") from exc


def filter_month(transactions: Iterable[Transaction], month: str | None) -> list[Transaction]:
    if month and not MONTH_PATTERN.fullmatch(month):
        raise BudgetError("Month must use YYYY-MM")
    return sorted((item for item in transactions if not month or item.date.startswith(month + "-")), key=lambda item: (item.date, item.id))


def summarize(transactions: Iterable[Transaction], *, month: str | None = None, budgets: dict[str, object] | None = None) -> dict[str, object]:
    selected = filter_month(transactions, month)
    income = sum((item.amount for item in selected if item.kind == "income"), Decimal("0"))
    expenses = sum((item.amount for item in selected if item.kind == "expense"), Decimal("0"))
    categories: dict[str, Decimal] = {}
    for item in selected:
        if item.kind == "expense":
            categories[item.category] = categories.get(item.category, Decimal("0")) + item.amount

    normalized_budgets = {_category(name): _money(limit) for name, limit in (budgets or {}).items()}
    overspent = [
        {"category": name, "spent": f"{categories.get(name, Decimal('0')):.2f}", "budget": f"{limit:.2f}"}
        for name, limit in sorted(normalized_budgets.items()) if categories.get(name, Decimal("0")) > limit
    ]
    savings_rate = (income - expenses) / income * 100 if income else Decimal("0")
    return {
        "month": month or "all",
        "transaction_count": len(selected),
        "income": f"{income:.2f}",
        "expenses": f"{expenses:.2f}",
        "balance": f"{income - expenses:.2f}",
        "savings_rate_percent": f"{savings_rate.quantize(MONEY, rounding=ROUND_HALF_UP):.2f}",
        "expense_categories": {name: f"{value:.2f}" for name, value in sorted(categories.items())},
        "overspent": overspent,
    }

