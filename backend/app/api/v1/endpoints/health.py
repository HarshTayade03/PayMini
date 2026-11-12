from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


@router.get("/health", response_model=HealthResponse, summary="API Health Check")
def health_check():
    return HealthResponse(
        status="healthy",
        service="paymini-api",
        version="1.0.0"
    )
