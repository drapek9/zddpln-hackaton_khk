"""Citizen places, commute, push subscription and notices."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.auth.deps import require_user
from app.config import get_settings
from app.core.schemas import Weights
from app.db.models import Notification, OfficialWeights, Place, PushSubscription, SavedRoute, User, utcnow
from app.db.session import get_session
from app.services.access import audit, dump_ids, resolve_weights
from app.services.closures import active_closed_ids

router = APIRouter(tags=["Občan"])


class PointBody(BaseModel):
    lon: float = Field(ge=-180, le=180)
    lat: float = Field(ge=-90, le=90)


class PlacesBody(BaseModel):
    home: PointBody
    work: PointBody


class PushKeyBody(BaseModel):
    p256dh: str = Field(min_length=8, max_length=512)
    auth: str = Field(min_length=4, max_length=512)


class PushBody(BaseModel):
    endpoint: str = Field(min_length=8, max_length=2000)
    keys: PushKeyBody


def _places(session: Session, user_id: int) -> dict[str, Place]:
    rows = session.exec(select(Place).where(Place.user_id == user_id)).all()
    return {row.kind: row for row in rows}


def _save_route(session: Session, engine, user_id: int, home: PointBody, work: PointBody) -> dict:
    route = engine.route((home.lon, home.lat), (work.lon, work.lat))
    row = session.get(SavedRoute, user_id)
    if row is None:
        row = SavedRoute(user_id=user_id, road_ids_json="[]")
    row.road_ids_json = dump_ids(list(route.road_ids))
    row.km = route.km
    row.minutes = route.minutes
    row.found = route.found
    session.add(row)
    return route.model_dump()


def _route_view(session: Session, engine, user: User) -> dict:
    places = _places(session, user.id)
    if "home" not in places or "work" not in places:
        raise HTTPException(status_code=400, detail="Nejdřív uložte domov a práci.")
    home = places["home"]
    work = places["work"]
    baseline = _save_route(session, engine, user.id, PointBody(lon=home.lon, lat=home.lat), PointBody(lon=work.lon, lat=work.lat))
    closed = active_closed_ids(session)
    alternate = engine.route((home.lon, home.lat), (work.lon, work.lat), closed=closed)
    session.commit()
    on_route = [road_id for road_id in closed if road_id in baseline["road_ids"]]
    return {
        "home": {"lon": home.lon, "lat": home.lat},
        "work": {"lon": work.lon, "lat": work.lat},
        "baseline": baseline,
        "with_closures": alternate.model_dump(),
        "closures_on_route": on_route,
    }


@router.put("/me/places")
def put_places(
    body: PlacesBody,
    request: Request,
    user: User = Depends(require_user),
    session: Session = Depends(get_session),
) -> dict:
    for kind, point in (("home", body.home), ("work", body.work)):
        row = session.exec(select(Place).where(Place.user_id == user.id, Place.kind == kind)).first()
        if row is None:
            row = Place(user_id=user.id, kind=kind, lon=point.lon, lat=point.lat)
        else:
            row.lon = point.lon
            row.lat = point.lat
        session.add(row)
    session.flush()
    return _route_view(session, request.app.state.engine, user)


@router.get("/me/places")
def get_places(user: User = Depends(require_user), session: Session = Depends(get_session)) -> dict:
    places = _places(session, user.id)
    return {
        kind: {"lon": places[kind].lon, "lat": places[kind].lat} if kind in places else None
        for kind in ("home", "work")
    }


@router.get("/me/route")
def get_route(
    request: Request,
    user: User = Depends(require_user),
    session: Session = Depends(get_session),
) -> dict:
    return _route_view(session, request.app.state.engine, user)


@router.get("/me/notifications")
def list_notifications(user: User = Depends(require_user), session: Session = Depends(get_session)) -> dict:
    rows = session.exec(select(Notification).where(Notification.user_id == user.id).order_by(Notification.id.desc())).all()
    return {
        "items": [
            {
                "id": row.id,
                "title": row.title,
                "body": row.body,
                "read": row.read,
                "push_sent": row.push_sent,
                "email_sent": row.email_sent,
                "email_preview": row.body,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ]
    }


@router.post("/me/notifications/{notification_id}/read")
def mark_read(
    notification_id: int,
    user: User = Depends(require_user),
    session: Session = Depends(get_session),
) -> dict:
    row = session.get(Notification, notification_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="Upozornění neexistuje.")
    row.read = True
    session.add(row)
    session.commit()
    return {"ok": True}


@router.post("/me/push-subscription")
def save_push(
    body: PushBody,
    user: User = Depends(require_user),
    session: Session = Depends(get_session),
) -> dict:
    row = session.exec(select(PushSubscription).where(PushSubscription.endpoint == body.endpoint)).first()
    if row is None:
        row = PushSubscription(user_id=user.id, endpoint=body.endpoint, p256dh=body.keys.p256dh, auth=body.keys.auth)
    else:
        row.user_id = user.id
        row.p256dh = body.keys.p256dh
        row.auth = body.keys.auth
    session.add(row)
    session.commit()
    return {"ok": True}


@router.delete("/me/push-subscription")
def delete_push(
    endpoint: str,
    user: User = Depends(require_user),
    session: Session = Depends(get_session),
) -> dict:
    row = session.exec(select(PushSubscription).where(PushSubscription.endpoint == endpoint)).first()
    if row is not None and row.user_id == user.id:
        session.delete(row)
        session.commit()
    return {"ok": True}


@router.get("/me/weights")
def get_my_weights(user: User = Depends(require_user), session: Session = Depends(get_session)) -> dict:
    weights, source = resolve_weights(session, user)
    return {"weights": weights.model_dump(), "source": source}


@router.put("/me/weights")
def put_my_weights(
    body: Weights,
    user: User = Depends(require_user),
    session: Session = Depends(get_session),
) -> dict:
    if user.role != "official":
        raise HTTPException(
            status_code=403,
            detail="Váhy pro vlastní pohled ukládá úředník. Trvalé váhy mění admin.",
        )
    row = session.get(OfficialWeights, user.id)
    if row is None:
        row = OfficialWeights(user_id=user.id, weights_json=body.model_dump_json())
    else:
        row.weights_json = body.model_dump_json()
        row.updated_at = utcnow()
    session.add(row)
    audit(session, user, "weights.official", "vlastní pohled")
    session.commit()
    return {"weights": body.model_dump(), "source": "official"}


@router.delete("/me/weights")
def delete_my_weights(user: User = Depends(require_user), session: Session = Depends(get_session)) -> dict:
    if user.role != "official":
        raise HTTPException(status_code=403, detail="Na tohle nemáte oprávnění.")
    row = session.get(OfficialWeights, user.id)
    if row is not None:
        session.delete(row)
        audit(session, user, "weights.official", "návrat k trvalým vahám")
        session.commit()
    return {"ok": True}


@router.get("/push/vapid-public-key")
def vapid_public_key() -> dict:
    key = get_settings().vapid_public_key
    return {"public_key": key, "configured": bool(key)}
