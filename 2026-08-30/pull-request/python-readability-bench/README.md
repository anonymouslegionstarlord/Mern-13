# ReadabilityBench

ReadabilityBench is a dependency-free Python CLI for measuring the clarity and reading level of English prose.

## Features

- Word, sentence, paragraph, syllable, and estimated reading-time metrics
- Flesch reading ease and approximate Flesch-Kincaid grade level
- Long-sentence, long-paragraph, passive-voice, and complex-word signals
- Actionable recommendations and frequently repeated complex words
- Text and JSON output with an optional maximum-grade quality gate
- Input-size validation, clear errors, and automated tests

Readability formulas and syllable detection are estimates. They are writing aids, not accessibility certification or a substitute for review by the intended audience.

## First-time setup

Requires Python 3.11+. No third-party runtime packages are required.

    python -m venv .venv
    source .venv/bin/activate
    python -m pip install -e .
    readabilitybench sample_article.txt

On Windows PowerShell activate with .\.venv\Scripts\Activate.ps1.

JSON and quality-gate examples:

    readabilitybench sample_article.txt --format json
    readabilitybench handbook.txt --max-grade 10

Run tests:

    python -m unittest discover -s tests -v

Exit codes are 0 when analysis passes, 1 when the grade exceeds the selected target, and 2 for invalid input or file errors.

