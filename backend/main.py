"""
HydroNetwork Backend — FastAPI server for QEsg and QWater dimensioning.

Run with: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import qesg, qwater

app = FastAPI(
    title="HydroNetwork API",
    description="API de dimensionamento hidráulico - QEsg (Esgoto) e QWater (Água)",
    version="1.0.0",
)

# CORS — Allow frontend to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(qesg.router)
app.include_router(qwater.router)


@app.get("/")
async def root():
    return {
        "service": "HydroNetwork API",
        "version": "1.0.0",
        "endpoints": {
            "qesg_dimension": "POST /api/qesg/dimension",
            "qesg_verify": "POST /api/qesg/verify",
            "qwater_dimension": "POST /api/qwater/dimension",
            "qwater_verify": "POST /api/qwater/verify",
        },
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
