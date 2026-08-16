from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True, slots=True)
class LogRecord:
    timestamp: datetime
    level: str
    service: str
    message: str

