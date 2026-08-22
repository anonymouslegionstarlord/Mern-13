from __future__ import annotations
import json
import time
from dataclasses import asdict
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from .models import Check

def run_check(check: Check) -> dict:
    check.validate(); headers = {"User-Agent": "APIProbe/1.0", **check.headers}; body = None
    if check.json_body is not None:
        body = json.dumps(check.json_body).encode("utf-8"); headers.setdefault("Content-Type", "application/json")
    request = Request(check.url, data=body, headers=headers, method=check.method); started = time.perf_counter()
    try:
        with urlopen(request, timeout=check.timeout) as response:
            status = response.status; text = response.read(1_000_001).decode("utf-8", errors="replace")
        error = None
    except HTTPError as exc:
        status = exc.code; text = exc.read(1_000_001).decode("utf-8", errors="replace"); error = None
    except (URLError, TimeoutError, OSError) as exc:
        return {"name": check.name, "url": check.url, "passed": False, "status": None, "elapsed_ms": round((time.perf_counter()-started)*1000,2), "error": str(exc.reason if isinstance(exc, URLError) else exc)}
    elapsed = round((time.perf_counter()-started)*1000,2); failures=[]
    if status != check.expected_status: failures.append(f"expected status {check.expected_status}, got {status}")
    if check.contains is not None and check.contains not in text: failures.append("expected response text was not found")
    return {"name":check.name,"url":check.url,"passed":not failures,"status":status,"elapsed_ms":elapsed,"error":"; ".join(failures) or error}

def run_plan(checks: list[Check]) -> dict:
    if not checks: raise ValueError("plan must contain at least one check")
    results=[run_check(check) for check in checks]; passed=sum(item["passed"] for item in results)
    return {"summary":{"total":len(results),"passed":passed,"failed":len(results)-passed},"results":results}

def check_to_dict(check: Check) -> dict:
    return asdict(check)

