"""Create a harmless archive for the README walkthrough."""

from pathlib import Path
import sys
import zipfile


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: python examples/make_sample.py OUTPUT.zip", file=sys.stderr)
        return 2
    output = Path(sys.argv[1])
    if output.exists():
        print(f"refusing to overwrite: {output}", file=sys.stderr)
        return 2
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("notes/readme.txt", "A safe demonstration archive.\n")
        archive.writestr("data/counts.csv", "label,value\nworks,1\n")
    print(f"created {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

