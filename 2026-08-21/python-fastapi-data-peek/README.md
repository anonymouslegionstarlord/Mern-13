# DataPeek API

DataPeek is a beginner-friendly FastAPI service that profiles CSV files before analysis. It reports shape, missing values, uniqueness, inferred column types, and numeric summaries without storing uploads.

## Features

- Upload a CSV and receive a structured data-quality report
- Header validation, duplicate-column detection, row-width checks, and upload limits
- Infer integer, decimal, boolean, date, or text columns
- Numeric minimum, maximum, and mean statistics
- Optional delimiter selection and case-insensitive missing-value markers
- FastAPI validation, consistent errors, interactive Swagger docs, and tested standard-library profiling core

## Requirements and setup

Python 3.11 or newer.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/docs`. Uploads are processed in memory and capped at 1 MB by default.

## Example

```bash
curl -F "file=@sales.csv" "http://127.0.0.1:8000/api/profile?delimiter=,"
```

## Tests

Core tests require only Python:

```bash
python -m unittest discover -s tests -v
```

After installing dependencies, the API can also be started and exercised through `/docs`.

