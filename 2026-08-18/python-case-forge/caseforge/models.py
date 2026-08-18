from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any


PRIORITIES = ("Low", "Medium", "High", "Critical")
TYPES = ("Functional", "Regression", "Smoke", "Integration", "Usability", "Other")
STATUSES = ("Not Run", "Passed", "Failed", "Blocked")


@dataclass(slots=True)
class TestCase:
    id: int
    title: str
    steps: list[str]
    expected: str
    priority: str = "Medium"
    test_type: str = "Functional"
    status: str = "Not Run"
    actual: str = ""
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def validate(self) -> None:
        self.title = self.title.strip()
        self.expected = self.expected.strip()
        self.actual = self.actual.strip()
        self.steps = [step.strip() for step in self.steps if step.strip()]
        if len(self.title) < 3 or len(self.title) > 120:
            raise ValueError("title must contain 3 to 120 characters")
        if not self.steps:
            raise ValueError("add at least one test step")
        if any(len(step) > 300 for step in self.steps):
            raise ValueError("each test step must be 300 characters or fewer")
        if len(self.expected) < 3 or len(self.expected) > 500:
            raise ValueError("expected result must contain 3 to 500 characters")
        if self.priority not in PRIORITIES:
            raise ValueError(f"priority must be one of: {', '.join(PRIORITIES)}")
        if self.test_type not in TYPES:
            raise ValueError(f"type must be one of: {', '.join(TYPES)}")
        if self.status not in STATUSES:
            raise ValueError(f"status must be one of: {', '.join(STATUSES)}")
        if self.status in {"Passed", "Failed", "Blocked"} and not self.actual:
            raise ValueError("actual result is required after execution")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "TestCase":
        case = cls(**data)
        case.validate()
        return case

