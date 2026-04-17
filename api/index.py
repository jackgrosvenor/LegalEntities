from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/")
async def root():
    return {"message": "Entity Mapping API — upload CSVs via the frontend to get started."}

@app.get("/api/health")
async def health():
    return {"status": "ok"}

# Vercel serverless handler
handler = Mangum(app)
