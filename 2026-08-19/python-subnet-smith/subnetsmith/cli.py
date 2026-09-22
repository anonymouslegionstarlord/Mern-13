import argparse
import json
import sys

from .calculator import contains, describe, export_csv, split_network


def build_parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="Inspect and plan IP subnets")
    commands = root.add_subparsers(dest="command", required=True)

    inspect = commands.add_parser("inspect", help="describe one network")
    inspect.add_argument("network")
    inspect.add_argument("--allow-host-bits", action="store_true")

    split = commands.add_parser("split", help="split a network")
    split.add_argument("network")
    split.add_argument("--new-prefix", required=True, type=int)
    split.add_argument("--allow-host-bits", action="store_true")

    membership = commands.add_parser("contains", help="check network membership")
    membership.add_argument("network")
    membership.add_argument("candidate")
    membership.add_argument("--allow-host-bits", action="store_true")

    export = commands.add_parser("export", help="export a subnet plan to CSV")
    export.add_argument("network")
    export.add_argument("--new-prefix", required=True, type=int)
    export.add_argument("--output", required=True)
    export.add_argument("--allow-host-bits", action="store_true")
    return root


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    strict = not args.allow_host_bits
    try:
        if args.command == "inspect":
            print(json.dumps(describe(args.network, strict), indent=2))
        elif args.command == "split":
            for subnet in split_network(args.network, args.new_prefix, strict):
                print(subnet)
        elif args.command == "contains":
            print("yes" if contains(args.network, args.candidate, strict) else "no")
        elif args.command == "export":
            print(f"Exported to {export_csv(args.network, args.new_prefix, args.output, strict)}")
    except (OSError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

