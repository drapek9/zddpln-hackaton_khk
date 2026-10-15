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
from app.api.roads import _feature, _metadata, _rows, weights_from_query

router = APIRouter(tags=["Otevřená data"])

COLUMNS = (
    "id",
    "usek",
    "sil",
    "trida",
    "okres",
    "stav",
    "stav_nazev",
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
    "stav povrchu jak je v datech kraje; stav_nazev název stavu pro lidi; delka_m délka v metrech; score skóre 0–100; "
    "priority výsledná třída (připíchnutí má přednost); model_class třída podle modelu; "
    "pinned ano/ne; pin_reason důvod připíchnutí; rank pořadí; votes hlasy po stropu; "
    "intenzita auta za den; intenzita_kvalita csd2025, odhad nebo chybi."
)


def _collection(request: Request, session: Session, user: User | None) -> tuple[dict, list[dict]]:
    rows, source = _rows(request.app.state.engine, session, user, weights_from_query(request))
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
        "intenzita": "sčítání ŘSD 2025 (CC BY-SA 4.0) nebo odhad; u konkrétního úseku rozhoduje intenzita_kvalita",
    }


@router.get("/export/metadata.jsonld")
def export_metadata(request: Request) -> Response:
    base = str(request.base_url).rstrip("/")
    dataset = f"{base}/api/export/metadata.jsonld"
    payload = {
        "@context": "https://ofn.gov.cz/dcat-ap-cz-rozhraní-katalogů-otevřených-dat/2024-05-28/kontexty/rozhraní-katalogů-otevřených-dat.jsonld",
        "iri": dataset,
        "typ": "Datová sada",
        "název": {"cs": "Cesty KHK — úseky se skóre"},
        "popis": {
            "cs": (
                "Hackathonový výstup, není to oficiální publikace kraje. "
                "Stav povrchu pochází z Data KHK. Skóre a pořadí počítá aplikace Cesty KHK (EUPL-1.2). "
                "Auta za den jsou odvozenina Celostátního sčítání dopravy ŘSD 2025 (CC BY-SA 4.0) "
                "nebo odhad se štítkem odhad. Osobní údaje tu nejsou."
            )
        },
        "klíčové_slovo": {"cs": ["silnice", "priorita oprav", "Královéhradecký kraj"]},
        "téma": ["http://publications.europa.eu/resource/authority/data-theme/TRAN"],
        "periodicita_aktualizace": "http://publications.europa.eu/resource/authority/frequency/UNKNOWN",
        "prvek_rúian": ["https://linked.cuzk.cz/resource/ruian/vusc/86"],
        "distribuce": [
            _distribution(f"{base}/api/export.csv", "CSV úseků se skóre", "text/csv", "CSV"),
            _distribution(f"{base}/api/export.geojson", "GeoJSON úseků se skóre", "application/geo+json", "JSON"),
        ],
    }
    return Response(content=json.dumps(payload, ensure_ascii=False), media_type="application/ld+json")


def _distribution(url: str, title: str, media: str, file_type: str) -> dict:
    return {
        "typ": "Distribuce",
        "iri": url,
        "název": {"cs": title},
        "soubor_ke_stažení": url,
        "přístupové_url": url,
        "typ_média": f"http://www.iana.org/assignments/media-types/{media}",
        "formát": f"http://publications.europa.eu/resource/authority/file-type/{file_type}",
        "podmínky_užití": {
            "typ": "Specifikace podmínek užití",
            "autorské_dílo": "https://eupl.eu/1.2/cs/",
            "databáze_jako_autorské_dílo": "https://creativecommons.org/licenses/by-sa/4.0/",
            "databáze_chráněná_zvláštními_právy": "https://data.gov.cz/podmínky-užití/není-chráněna-zvláštním-právem-pořizovatele-databáze/",
            "osobní_údaje": "https://data.gov.cz/podmínky-užití/neobsahuje-osobní-údaje/",
        },
    }
