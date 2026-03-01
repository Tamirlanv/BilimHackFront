from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import CurrentUser
from app.worker.queue import enqueue_task, get_job_status
from app.worker.tasks import ping_worker

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/ping")
def enqueue_ping(_: CurrentUser) -> dict[str, str]:
    job_id = enqueue_task(ping_worker)
    if not job_id:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Worker queue is unavailable")
    return {"job_id": job_id}


@router.get("/{job_id}")
def job_status(job_id: str, _: CurrentUser) -> dict:
    status_payload = get_job_status(job_id)
    if not status_payload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return status_payload

