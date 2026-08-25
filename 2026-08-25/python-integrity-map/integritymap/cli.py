import argparse
import json
import sys
from .core import IntegrityError, create_manifest, verify_manifest

def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="Create and verify SHA-256 directory manifests"); commands = root.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create"); create.add_argument("root"); create.add_argument("--manifest", required=True); create.add_argument("--ignore", action="append", default=[])
    verify = commands.add_parser("verify"); verify.add_argument("root"); verify.add_argument("--manifest", required=True); verify.add_argument("--json", action="store_true")
    return root

def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        if args.command == "create":
            data = create_manifest(args.root, args.manifest, args.ignore); print(f"Created {args.manifest} with {len(data['files'])} file(s)"); return 0
        report = verify_manifest(args.root, args.manifest)
        if args.json: print(json.dumps(report, indent=2))
        elif report["clean"]: print(f"PASS: {report['checked']} file(s) verified")
        else:
            print("FAIL: directory changes detected")
            for group in ("missing", "modified", "unexpected"):
                for path in report[group]: print(f"- {group}: {path}")
        return 0 if report["clean"] else 1
    except IntegrityError as error: print(f"error: {error}", file=sys.stderr); return 2

if __name__ == "__main__": raise SystemExit(main())

