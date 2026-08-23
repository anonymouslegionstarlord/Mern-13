import argparse
import json
import sys
from pathlib import Path
from .parser import EnvError, load_env
from .validator import load_schema, validate_environment

def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="Validate a .env file without exposing its values")
    root.add_argument("env_file"); root.add_argument("schema"); root.add_argument("--allow-extra", action="store_true"); root.add_argument("--json", dest="report")
    return root

def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        report = validate_environment(load_env(args.env_file), load_schema(args.schema), args.allow_extra)
        if report["valid"]: print(f"PASS: {report['checked']} variables checked; no issues found")
        else:
            print(f"FAIL: {report['issue_count']} configuration issue(s)")
            for item in report["issues"]: print(f"- {item['key']}: {item['message']}")
        if args.report:
            output = Path(args.report); output.parent.mkdir(parents=True, exist_ok=True); output.write_text(json.dumps(report, indent=2), encoding="utf-8"); print(f"Report: {output}")
        return 0 if report["valid"] else 1
    except EnvError as error: print(f"error: {error}", file=sys.stderr); return 2

if __name__ == "__main__": raise SystemExit(main())

