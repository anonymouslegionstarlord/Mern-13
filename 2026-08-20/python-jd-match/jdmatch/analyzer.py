import json
import re
from importlib.resources import files
from pathlib import Path
from typing import Any


Catalog = dict[str, list[str]]


def normalize(text: str) -> str:
    return " " + re.sub(r"[^a-z0-9+#.]+", " ", text.casefold()).strip() + " "


def contains_term(text: str, term: str) -> bool:
    normalized_term = normalize(term).strip()
    if not normalized_term:
        return False
    pattern = r"(?<![a-z0-9+#.])" + re.escape(normalized_term) + r"(?![a-z0-9+#.])"
    return re.search(pattern, text) is not None


def validate_catalog(data: Any) -> Catalog:
    if not isinstance(data, dict) or not data:
        raise ValueError("skill catalogue must be a non-empty JSON object")
    catalog: Catalog = {}
    for skill, aliases in data.items():
        if not isinstance(skill, str) or not skill.strip():
            raise ValueError("catalogue skill names must be non-empty strings")
        if not isinstance(aliases, list) or not all(isinstance(alias, str) and alias.strip() for alias in aliases):
            raise ValueError(f"aliases for '{skill}' must be a list of non-empty strings")
        key = skill.strip().casefold()
        catalog[key] = list(dict.fromkeys(alias.strip().casefold() for alias in aliases))
    return catalog


def load_catalog(path: str | Path | None = None) -> Catalog:
    try:
        if path:
            data = json.loads(Path(path).read_text(encoding="utf-8"))
        else:
            data = json.loads(files("jdmatch").joinpath("default_skills.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"cannot read skill catalogue: {error}") from error
    return validate_catalog(data)


def detected_skills(text: str, catalog: Catalog) -> set[str]:
    normalized = normalize(text)
    found = set()
    for skill, aliases in catalog.items():
        if any(contains_term(normalized, term) for term in [skill, *aliases]):
            found.add(skill)
    return found


def analyze(resume: str, job_description: str, catalog: Catalog) -> dict[str, Any]:
    if not resume.strip():
        raise ValueError("resume text cannot be empty")
    if not job_description.strip():
        raise ValueError("job description text cannot be empty")
    resume_skills = detected_skills(resume, catalog)
    required = detected_skills(job_description, catalog)
    matched = sorted(required & resume_skills)
    missing = sorted(required - resume_skills)
    score = round(len(matched) / len(required) * 100, 2) if required else 0.0
    return {
        "score": score,
        "catalogue_skills_in_job": len(required),
        "matched_count": len(matched),
        "missing_count": len(missing),
        "matched": matched,
        "missing": missing,
    }

