"""Demo accounts and two citizen commutes.

Passwords belong in this file, not in the pitch. Places are map points only.
"""

from __future__ import annotations

import logging

from sqlmodel import Session, select

from app.auth.security import hash_password
from app.core.engine import Engine
from app.core.schemas import Weights
from app.db.models import AppSetting, Place, SavedRoute, User
from app.services.access import SETTINGS_ID, dump_ids

log = logging.getLogger(__name__)

# Demo passwords. Change them before any real deployment.
DEMO_USERS = (
    {"email": "admin@cesty-khk.test", "password": "admin-demo", "role": "admin"},
    {"email": "urednik@cesty-khk.test", "password": "urednik-demo", "role": "official"},
    {"email": "obcan1@cesty-khk.test", "password": "obcan-demo", "role": "citizen"},
    {"email": "obcan2@cesty-khk.test", "password": "obcan-demo", "role": "citizen"},
)


def seed_if_empty(session: Session, engine: Engine) -> None:
    if session.exec(select(User).limit(1)).first() is not None:
        return
    if session.get(AppSetting, SETTINGS_ID) is None:
        session.add(AppSetting(id=SETTINGS_ID, weights_json=Weights().model_dump_json(), vote_cap=10, ai_enabled=True))

    users = []
    for item in DEMO_USERS:
        user = User(email=item["email"], password_hash=hash_password(item["password"]), role=item["role"])
        session.add(user)
        users.append(user)
    session.flush()

    citizens = [user for user in users if user.role == "citizen"]
    routes = _demo_routes(engine, len(citizens))
    if routes:
        while len(routes) < len(citizens):
            routes.append(routes[-1])
    for user, item in zip(citizens, routes):
        road, route, home, work = item
        session.add(Place(user_id=user.id, kind="home", lon=home[0], lat=home[1]))
        session.add(Place(user_id=user.id, kind="work", lon=work[0], lat=work[1]))
        session.add(
            SavedRoute(
                user_id=user.id,
                road_ids_json=dump_ids(list(route.road_ids)),
                km=route.km,
                minutes=route.minutes,
                found=route.found,
            )
        )
        obec = (road.get("obce") or ["?"])[0]
        log.info("seeded %s commute in %s on road %s", user.email, obec, road.get("id"))


def _demo_routes(engine: Engine, count: int) -> list[tuple]:
    picked: list[tuple] = []
    seen_obce: set[str] = set()
    for interesting_only in (True, False):
        checked = 0
        for road in engine.data.roads:
            if len(picked) >= count:
                return picked
            geometry = road.get("g") or []
            if len(geometry) < 2:
                continue
            obce = road.get("obce") or []
            counts = road.get("counts") or {}
            interesting = bool(road.get("lines")) and bool(
                counts.get("school") or counts.get("hospital") or counts.get("zzs")
            )
            if interesting_only and not interesting:
                continue
            if not interesting_only and interesting:
                continue
            checked += 1
            if checked > 40:
                break
            obec = obce[0] if obce else ""
            if obec and obec in seen_obce:
                continue
            home = (float(geometry[0][0]), float(geometry[0][1]))
            work = (float(geometry[-1][0]), float(geometry[-1][1]))
            route = engine.route(home, work)
            if not route.found or not route.road_ids:
                continue
            picked.append((road, route, home, work))
            if obec:
                seen_obce.add(obec)
    return picked
