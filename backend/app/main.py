"""FastAPI app. Owner: Šimon (see AGENTS.md). Minimal skeleton for milestone v0."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.engine import Engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.engine = Engine.load()
    yield


app = FastAPI(title="Cesty KHK API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CESTY_CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    engine: Engine = app.state.engine
    return {"ok": True, "roads": len(engine.data.roads), "graph_nodes": engine.graph.graph.number_of_nodes()}
