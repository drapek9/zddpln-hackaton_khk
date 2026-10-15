"""FastAPI app. Owner: Šimon (see AGENTS.md)."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from sqlmodel import Session, SQLModel, select

from app.api.admin import router as admin_router
from app.api.ai import router as ai_router
from app.api.auth import router as auth_router
from app.api.closures import router as closures_router
from app.api.documentation import router as docs_router
from app.api.me import router as me_router
from app.api.opendata import router as opendata_router
from app.api.reports import router as reports_router
from app.api.responses import HealthOut
from app.api.roads import router as roads_router
from app.api.scenarios import router as scenarios_router
from app.config import get_settings, require_secret
from app.core.engine import Engine
from app.db.models import User
from app.db.seed import seed_if_empty
from app.db.session import get_db_engine

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.engine = Engine.load()
    # T21 Engine.warmup() is not in core yet. Until it is, warm the two slow caches here.
    warmup = getattr(app.state.engine, "warmup", None)
    if callable(warmup):
        warmup()
    else:
        app.state.engine.people
        app.state.engine.demo_closures()
    settings = get_settings()
    if settings.vapid_public_key and settings.vapid_private_key:
        log.info("Push zapnut")
    else:
        log.warning("Push vypnut: chybí VAPID")
    SQLModel.metadata.create_all(get_db_engine())
    with Session(get_db_engine()) as session:
        seed_if_empty(session, app.state.engine)
        session.commit()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    require_secret(settings)
    application = FastAPI(title="Cesty KHK API", version="0.2.0", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.add_middleware(GZipMiddleware, minimum_size=1000)
    for route in (
        auth_router,
        roads_router,
        closures_router,
        scenarios_router,
        me_router,
        admin_router,
        opendata_router,
        reports_router,
        ai_router,
        docs_router,
    ):
        application.include_router(route, prefix="/api")

    @application.get("/api/health", response_model=HealthOut)
    def health(request: Request) -> dict:
        engine: Engine = request.app.state.engine
        with Session(get_db_engine()) as session:
            session.exec(select(User).limit(1)).first()
        return {
            "ok": True,
            "roads": len(engine.data.roads),
            "graph_nodes": engine.graph.graph.number_of_nodes(),
            "db": True,
        }

    return application


app = create_app()
