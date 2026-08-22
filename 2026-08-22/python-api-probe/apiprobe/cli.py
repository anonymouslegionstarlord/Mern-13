import argparse
import json
import sys
from pathlib import Path
from .models import Check
from .runner import run_plan

def parser() -> argparse.ArgumentParser:
    root=argparse.ArgumentParser(description="Run HTTP API smoke checks from a JSON plan")
    root.add_argument("plan", help="path to a JSON check plan"); root.add_argument("--json", dest="report", help="optional JSON report path")
    return root

def load_plan(path: str | Path) -> list[Check]:
    try: raw=json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError,json.JSONDecodeError) as error: raise ValueError(f"cannot read plan: {error}") from error
    if not isinstance(raw,list): raise ValueError("plan must be a JSON list")
    checks=[]
    for index,item in enumerate(raw,1):
        try: checks.append(Check.from_dict(item))
        except ValueError as error: raise ValueError(f"check {index}: {error}") from error
    if not checks: raise ValueError("plan must contain at least one check")
    return checks

def main(argv: list[str] | None=None) -> int:
    args=parser().parse_args(argv)
    try:
        report=run_plan(load_plan(args.plan))
        for item in report["results"]:
            marker="PASS" if item["passed"] else "FAIL"; detail=f"status={item['status']}" if item["status"] else item["error"]
            print(f"[{marker}] {item['name']} ({item['elapsed_ms']} ms) {detail}")
        print(f"\n{report['summary']['passed']}/{report['summary']['total']} checks passed")
        if args.report:
            output=Path(args.report); output.parent.mkdir(parents=True,exist_ok=True); output.write_text(json.dumps(report,indent=2),encoding="utf-8"); print(f"Report: {output}")
        return 0 if report["summary"]["failed"]==0 else 1
    except ValueError as error: print(f"error: {error}",file=sys.stderr); return 2

if __name__=="__main__": raise SystemExit(main())

