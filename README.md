# MERN 13 Project Lab

A dated portfolio of runnable MERN and Python projects. Each dated directory contains one frontend/backend MERN application and one tested Python utility or API.

| Date | MERN project | Python project |
|---|---|---|
| 2026-08-16 | Habit Heat | Log Lens |
| 2026-08-18 | Bug Board | Case Forge |
| 2026-08-20 | Apply Flow | JD Match |
| 2026-08-22 | Interview Deck | API Probe |
| 2026-08-24 | Desk Reserve | Minute Mate |

Open the README inside any project for its features, environment variables, and first-time setup.

## MERN setup pattern

```bash
cd 2026-08-24/mern-desk-reserve/server
cp .env.example .env
npm install
npm run dev
```

In a second terminal:

```bash
cd 2026-08-24/mern-desk-reserve/client
npm install
npm run dev
```

The API requires a local or hosted MongoDB connection configured in the server `.env` file.

## Python setup pattern

```bash
cd 2026-08-22/python-api-probe
python -m venv .venv
source .venv/bin/activate  # Windows: .\.venv\Scripts\Activate.ps1
pip install -e .
python -m pytest
```

## Validation

All five Python test suites and all five Vite client builds pass. Server entry points also pass Node syntax checks. Build output, dependency folders, local databases, and secrets are excluded from version control.
