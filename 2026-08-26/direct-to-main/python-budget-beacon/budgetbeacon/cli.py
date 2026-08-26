"""Command-line interface for BudgetBeacon."""

from __future__ import annotations

import argparse
import json
import sys

from .core import BudgetError, add_transaction, filter_month, load_transactions, save_transactions, summarize


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="budgetbeacon", description="Track a small personal budget in JSON")
    root.add_argument("--file", default="budget.json", help="JSON data file (default: budget.json)")
    commands = root.add_subparsers(dest="command", required=True)

    add = commands.add_parser("add", help="Add a transaction")
    add.add_argument("kind", choices=["income", "expense"])
    add.add_argument("amount")
    add.add_argument("category")
    add.add_argument("--date", dest="on_date")
    add.add_argument("--note", default="")

    listing = commands.add_parser("list", help="List transactions")
    listing.add_argument("--month")
    listing.add_argument("--json", action="store_true")

    report = commands.add_parser("summary", help="Show budget totals")
    report.add_argument("--month")
    report.add_argument("--budget", action="append", default=[], metavar="CATEGORY=AMOUNT")
    report.add_argument("--json", action="store_true")
    return root


def parse_budgets(values: list[str]) -> dict[str, str]:
    budgets = {}
    for value in values:
        if "=" not in value:
            raise BudgetError(f"Budget must use CATEGORY=AMOUNT: {value}")
        category, amount = value.split("=", 1)
        budgets[category] = amount
    return budgets


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        transactions = load_transactions(args.file)
        if args.command == "add":
            item = add_transaction(args.kind, args.amount, args.category, on_date=args.on_date, note=args.note)
            transactions.append(item)
            save_transactions(args.file, transactions)
            print(f"Added {item.kind} {item.amount:.2f} in {item.category} ({item.id})")
        elif args.command == "list":
            items = filter_month(transactions, args.month)
            if args.json:
                print(json.dumps([item.to_dict() for item in items], indent=2))
            elif not items:
                print("No transactions found.")
            else:
                for item in items:
                    print(f"{item.date}  {item.kind:7}  {item.amount:>10.2f}  {item.category}  {item.note}")
        else:
            report = summarize(transactions, month=args.month, budgets=parse_budgets(args.budget))
            if args.json:
                print(json.dumps(report, indent=2))
            else:
                print(f"Period: {report['month']} | Transactions: {report['transaction_count']}")
                print(f"Income: {report['income']} | Expenses: {report['expenses']} | Balance: {report['balance']}")
                print(f"Savings rate: {report['savings_rate_percent']}%")
                for name, value in report["expense_categories"].items():
                    print(f"  {name}: {value}")
                for item in report["overspent"]:
                    print(f"WARNING {item['category']}: spent {item['spent']} / budget {item['budget']}")
        return 0
    except BudgetError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

