from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, SessionLocal, engine
from .routers import auth, boards, convert, permissions, users
from .seed import seed_admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Na tym etapie tworzymy tabele bezpośrednio (bez migracji Alembic — pkt 5.1 idea.md).
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_admin(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Whiteboard Engine API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(boards.router)
app.include_router(convert.router)
app.include_router(permissions.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
