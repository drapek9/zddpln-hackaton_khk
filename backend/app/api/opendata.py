"""Public export and summary statistics. No personal data."""

from __future__ import annotations

import csv
import io
import json
from datetime import date

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlmodel import Session

from app.auth.deps import optional_user
from app.db.models import User
from app.db.session import get_session
from app.api.roads import _feature, _metadata, _rows

router = APIRouter(tags=["Otevřená data"])

COLUMNS = (
    "id",
    "usek",
    "sil",
    "trida",
    "okres",
    "stav",
    "delka_m",
    "score",
    "priority",
    "model_class",
    "pinned",
    "pin_reason",
    "rank",
    "votes",
    "intenzita",
    "intenzita_kvalita",
)

COLUMN_HELP = (
    "id číslo úseku; usek kód úseku; sil číslo silnice; trida třída; okres; "
    "stav povrchu; delka_m délka v metrech; score skóre 0–100; "
    "priority výsledná třída (připíchnutí má přednost); model_class třída podle modelu; "
    "pinned ano/ne; pin_reason důvod připíchnutí; rank pořadí; votes hlasy po stropu; "
    "intenzita auta za den nebo prázdné; intenzita_kvalita chybi nebo odhad."
)


def _collection(request: Request, session: Session, user: User | None) -> tuple[dict, list[dict]]:
    rows, source = _rows(request.app.state.engine, session, user)
    features = []
    for row in rows:
        road = request.app.state.engine.road(row.road.id) or {}
        features.append(_feature(row, road))
    return _metadata(source), features


@router.get("/export.geojson")
def export_geojson(
    request: Request,
    user: User | None = Depends(optional_user),
    session: Session = Depends(get_session),
) -> Response:
    metadata, features = _collection(request, session, user)
    payload = {"type": "FeatureCollection", "metadata": metadata, "features": features}
    return Response(
        content=json.dumps(payload, ensure_ascii=False),
        media_type="application/geo+json",
        headers={"Content-Disposition": 'attachment; filename="cesty-khk.geojson"'},
    )


@router.get("/export.csv")
def export_csv(
    request: Request,
    user: User | None = Depends(optional_user),
    session: Session = Depends(get_session),
) -> Response:
    metadata, features = _collection(request, session, user)
    buffer = io.StringIO()
    buffer.write(f"# nazev: {metadata['nazev']} — úseky se skóre\n")
    buffer.write(f"# licence: {metadata['licence']}\n")
    buffer.write(f"# vypocteno: {metadata['vypocteno']}\n")
    buffer.write(f"# intenzita: {metadata['intenzita']}\n")
    buffer.write(f"# sloupce: {COLUMN_HELP}\n")
    writer = csv.DictWriter(buffer, fieldnames=COLUMNS, lineterminator="\n")
    writer.writeheader()
    for feature in features:
        props = feature["properties"]
        writer.writerow({column: props.get(column, "") for column in COLUMNS})
    body = "\ufeff" + buffer.getvalue()
    return Response(
        content=body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="cesty-khk.csv"'},
    )


@router.get("/statistiky")
def statistiky(request: Request, session: Session = Depends(get_session)) -> dict:
    from app.db.models import Closure

    from sqlmodel import select

    engine = request.app.state.engine
    public = session.exec(select(Closure).where(Closure.confirmed.is_(True))).all()
    return {
        "licence": "EUPL-1.2",
        "vypocteno": date.today().isoformat(),
        "useky": len(engine.data.roads),
        "sit": engine.data.stats,
        "uzavirky_potvrzene": len(public),
        "intenzita": "zatím není napojené sčítání ŘSD 2025",
    }
