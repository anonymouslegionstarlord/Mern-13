from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}

@dataclass(slots=True)
class Check:
    name: str
    url: str
    expected_status: int
    method: str = "GET"
    contains: str | None = None
    timeout: float = 5.0
    headers: dict[str, str] = field(default_factory=dict)
    json_body: Any = None

    def validate(self) -> None:
        self.name = self.name.strip(); self.url = self.url.strip(); self.method = self.method.upper().strip()
        if not 2 <= len(self.name) <= 100: raise ValueError("name must contain 2 to 100 characters")
        parsed = urlparse(self.url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc: raise ValueError("url must be a valid http or https URL")
        if self.method not in METHODS: raise ValueError(f"method must be one of: {', '.join(sorted(METHODS))}")
        if not isinstance(self.expected_status, int) or not 100 <= self.expected_status <= 599: raise ValueError("expected_status must be an integer from 100 to 599")
        if not isinstance(self.timeout, (int, float)) or not 0.1 <= self.timeout <= 30: raise ValueError("timeout must be between 0.1 and 30 seconds")
        if self.contains is not None and (not isinstance(self.contains, str) or len(self.contains) > 500): raise ValueError("contains must be text up to 500 characters")
        if not isinstance(self.headers, dict) or any(not isinstance(k, str) or not isinstance(v, str) for k, v in self.headers.items()): raise ValueError("headers must contain text keys and values")

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Check":
        if not isinstance(data, dict): raise ValueError("each check must be a JSON object")
        allowed = {"name", "url", "expected_status", "method", "contains", "timeout", "headers", "json_body"}
        unknown = set(data) - allowed
        if unknown: raise ValueError(f"unknown check fields: {', '.join(sorted(unknown))}")
        try: check = cls(**data)
        except TypeError as error: raise ValueError(f"invalid check fields: {error}") from error
        check.validate(); return check

