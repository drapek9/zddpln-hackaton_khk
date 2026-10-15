"""Admin: users, permanent weights, vote cap, audit, AI switch."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.ai.service import ai_status
from app.auth.deps import require_admin
from app.config import get_settings
from app.core.schemas import Weights
from app.db.models import AppSetting, AuditEvent, User
from app.db.session import get_session
from app.services.access import audit, get_settings_row, touch

router = APIRouter(prefix="/admin", tags=["Admin"])

RoleName = Literal["citizen", "official", "admin"]


class UserPatch(BaseModel):
    role: RoleName | None = None
    blocked: bool | None = None


class WeightsBody(BaseModel):
    weights: Weights
    vote_cap: int = Field(default=10, ge=0, le=1000)


class AiSwitch(BaseModel):
    enabled: bool


def _user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "blocked": user.blocked,
        "created_at": user.created_at.isoformat(),
    }


@router.get("/users")
def list_users(session: Session = Depends(get_session), _: User = Depends(require_admin)) -> dict:
    rows = session.exec(select(User).order_by(User.id)).all()
    return {"items": [_user_dict(row) for row in rows]}


@router.patch("/users/{user_id}")
def update_user(
    user_id: int,
    body: UserPatch,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    target = session.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Uživatel neexistuje.")
    if target.id == admin.id and (body.blocked is True or (body.role is not None and body.role != "admin")):
        raise HTTPException(status_code=400, detail="Vlastní účet takhle nezměníte.")
    if body.role is not None:
        target.role = body.role
    if body.blocked is not None:
        target.blocked = body.blocked
        if body.blocked:
            target.token_version += 1
    session.add(target)
    audit(session, admin, "user.update", f"{target.email}: role {target.role}, blocked {target.blocked}")
    session.commit()
    session.refresh(target)
    return _user_dict(target)


@router.get("/weights")
def get_weights(session: Session = Depends(get_session), _: User = Depends(require_admin)) -> dict:
    row = get_settings_row(session)
    session.commit()
    return {"weights": Weights.model_validate_json(row.weights_json).model_dump(), "vote_cap": row.vote_cap}


@router.put("/weights")
def put_weights(
    body: WeightsBody,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    row = get_settings_row(session)
    row.weights_json = body.weights.model_dump_json()
    row.vote_cap = body.vote_cap
    touch(row)
    session.add(row)
    audit(session, admin, "weights.admin", f"strop hlasů {body.vote_cap}")
    session.commit()
    return {"weights": body.weights.model_dump(), "vote_cap": body.vote_cap}


@router.get("/audit")
def list_audit(
    limit: int = Query(default=100, ge=1, le=500),
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
) -> dict:
    rows = session.exec(select(AuditEvent).order_by(AuditEvent.id.desc()).limit(limit)).all()
    return {
        "items": [
            {
                "id": row.id,
                "email": row.email,
                "action": row.action,
                "detail": row.detail,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ]
    }


@router.get("/ai")
def get_ai(session: Session = Depends(get_session), _: User = Depends(require_admin)) -> dict:
    row = get_settings_row(session)
    session.commit()
    return ai_status(get_settings(), row.ai_enabled)


@router.put("/ai")
def put_ai(
    body: AiSwitch,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    row: AppSetting = get_settings_row(session)
    row.ai_enabled = body.enabled
    touch(row)
    session.add(row)
    audit(session, admin, "ai.switch", "zapnuto" if body.enabled else "vypnuto")
    session.commit()
    return ai_status(get_settings(), row.ai_enabled)
