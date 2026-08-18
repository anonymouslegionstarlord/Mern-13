import csv
import json
import os
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from .models import PRIORITIES, STATUSES, TYPES, TestCase


class CaseStore:
    def __init__(self, path: str | Path):
        self.path = Path(path)

    def load(self) -> list[TestCase]:
        if not self.path.exists():
            return []
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise ValueError(f"cannot read case file: {error}") from error
        if not isinstance(raw, list):
            raise ValueError("case file must contain a JSON list")
        return [TestCase.from_dict(item) for item in raw]

    def save(self, cases: list[TestCase]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(self.path.suffix + ".tmp")
        temporary.write_text(json.dumps([case.to_dict() for case in cases], indent=2), encoding="utf-8")
        os.replace(temporary, self.path)

    def add(self, title: str, steps: list[str], expected: str, priority: str, test_type: str) -> TestCase:
        cases = self.load()
        case = TestCase(
            id=max((item.id for item in cases), default=0) + 1,
            title=title,
            steps=steps,
            expected=expected,
            priority=priority,
            test_type=test_type,
        )
        case.validate()
        cases.append(case)
        self.save(cases)
        return case

    def list(self, status: str | None = None, priority: str | None = None, test_type: str | None = None) -> list[TestCase]:
        if status and status not in STATUSES:
            raise ValueError("invalid status filter")
        if priority and priority not in PRIORITIES:
            raise ValueError("invalid priority filter")
        if test_type and test_type not in TYPES:
            raise ValueError("invalid type filter")
        return [
            case for case in self.load()
            if (not status or case.status == status)
            and (not priority or case.priority == priority)
            and (not test_type or case.test_type == test_type)
        ]

    def update(self, case_id: int, status: str, actual: str) -> TestCase:
        cases = self.load()
        for case in cases:
            if case.id == case_id:
                case.status = status
                case.actual = actual
                case.updated_at = datetime.now(timezone.utc).isoformat()
                case.validate()
                self.save(cases)
                return case
        raise ValueError(f"test case {case_id} not found")

    def summary(self) -> dict[str, float | int | dict[str, int]]:
        cases = self.load()
        counts = Counter(case.status for case in cases)
        executed = sum(counts[status] for status in ("Passed", "Failed", "Blocked"))
        pass_rate = round((counts["Passed"] / executed * 100), 2) if executed else 0.0
        return {"total": len(cases), "executed": executed, "pass_rate": pass_rate, "statuses": dict(counts)}

    def export_csv(self, destination: str | Path) -> Path:
        output = Path(destination)
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(["ID", "Title", "Priority", "Type", "Status", "Steps", "Expected", "Actual", "Updated At"])
            for case in self.load():
                writer.writerow([case.id, case.title, case.priority, case.test_type, case.status, " | ".join(case.steps), case.expected, case.actual, case.updated_at])
        return output

