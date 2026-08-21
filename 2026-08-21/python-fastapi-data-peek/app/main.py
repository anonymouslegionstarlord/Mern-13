from fastapi import FastAPI, File, HTTPException, Query, UploadFile

from .profiler import ProfileError, profile_csv

MAX_UPLOAD_BYTES = 1_000_000
app = FastAPI(title="DataPeek API", version="1.0.0", description="Profile CSV structure and data quality without storing uploads.")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/profile")
async def profile(
    file: UploadFile = File(..., description="UTF-8 CSV file, maximum 1 MB"),
    delimiter: str = Query(",", min_length=1, max_length=1),
    missing: str = Query("NA,N/A,NULL,NONE", max_length=200, description="Comma-separated missing-value markers"),
) -> dict:
    filename = file.filename or ""
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="file must have a .csv extension")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    await file.close()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="CSV file exceeds the 1 MB limit")
    markers = {"", *(item.strip() for item in missing.split(",") if item.strip())}
    try:
        report = profile_csv(content, delimiter=delimiter, missing_markers=markers)
    except ProfileError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return {"filename": filename, **report}

