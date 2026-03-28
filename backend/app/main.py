import shutil

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.auth import router as auth_router
from app.routers.chat import router as chat_router
from app.routers.demo import router as demo_router
from app.routers.scan import router as scan_router

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scan_router, prefix="/api/scan", tags=["scan"])
app.include_router(chat_router, prefix="/api/chat", tags=["chat"])
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(demo_router, prefix="/api/demo", tags=["demo"])


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "nmap_available": bool(shutil.which("nmap")),
    }
