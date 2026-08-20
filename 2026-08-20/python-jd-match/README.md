# JDMatch

JDMatch is a transparent, zero-dependency Python CLI that compares resume text with a job description using a user-editable skill catalogue. It highlights matched and missing terms without pretending to reproduce a proprietary ATS score.

## Features

- Case-insensitive matching for single-word and multi-word skills
- User-editable JSON skill catalogue with aliases
- Match percentage based only on catalogue skills found in the job description
- Ranked matched and missing skill lists
- Plain-text or JSON reports
- Clear file/catalogue validation and unit tests

## Requirements

Python 3.11 or newer. No third-party runtime packages are required.

## Usage

Save your resume and job description as UTF-8 text files, then run:

```bash
python -m jdmatch.cli resume.txt job.txt
python -m jdmatch.cli resume.txt job.txt --catalog skills.example.json --json
python -m jdmatch.cli resume.txt job.txt --catalog skills.example.json --top 15
```

The score is a learning aid, not an official ATS prediction. Add truthful missing skills only after you have actually learned or used them.

## Catalogue format

```json
{
  "react": ["react.js", "reactjs"],
  "manual testing": ["manual qa"],
  "rest api": ["restful api", "rest apis"]
}
```

## Tests

```bash
python -m unittest discover -s tests -v
```

