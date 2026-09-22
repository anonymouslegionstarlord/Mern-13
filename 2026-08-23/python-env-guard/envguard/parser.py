from pathlib import Path

class EnvError(ValueError):
    """Raised for invalid environment or schema input."""

def parse_env_text(text: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for line_number, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"): continue
        if line.startswith("export "): line = line[7:].lstrip()
        if "=" not in line: raise EnvError(f"line {line_number} must use KEY=VALUE")
        key, value = line.split("=", 1); key = key.strip(); value = value.strip()
        if not key or not (key[0].isalpha() or key[0] == "_") or not all(char.isalnum() or char == "_" for char in key): raise EnvError(f"line {line_number} has an invalid variable name")
        if key in values: raise EnvError(f"line {line_number} duplicates {key}")
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}: value = value[1:-1]
        values[key] = value
    return values

def load_env(path: str | Path) -> dict[str, str]:
    try: return parse_env_text(Path(path).read_text(encoding="utf-8"))
    except OSError as error: raise EnvError(f"cannot read environment file: {error}") from error

