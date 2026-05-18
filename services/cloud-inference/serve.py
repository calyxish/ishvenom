"""Gemma 4 31B situation-report service (RunPod serverless).

Only invoked when a district health officer requests a weekly surveillance report.
The CHW-facing mobile app never depends on this service.
"""
from __future__ import annotations

import os

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="IshVenom cloud inference", version="0.1.0")

MODEL_NAME = os.environ.get("MODEL_NAME", "google/gemma-4-31b-it")


class SitRepRequest(BaseModel):
    district: str
    country: str
    encounters: list[dict]
    language: str = "en"


class SitRepResponse(BaseModel):
    district: str
    report: str
    model: str = MODEL_NAME


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "ishvenom-cloud-inference", "model": MODEL_NAME}


@app.post("/v1/sit-report", response_model=SitRepResponse)
def sit_report(req: SitRepRequest) -> SitRepResponse:
    # Phase 5 fills this in with actual vLLM inference.
    stub = (
        f"[STUB] Situation report for {req.district}, {req.country}. "
        f"{len(req.encounters)} encounters in window."
    )
    return SitRepResponse(district=req.district, report=stub)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
