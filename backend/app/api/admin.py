"""Admin: users, permanent weights, vote cap, audit, AI switch."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.ai.service import ai_status
from app.auth.deps import require_admin
from app.config import get_settings
from app.core.schemas import Weights
from app.db.models import AccessToken, AppSetting, AuditEvent, Closure, Notification, User
from app.db.session import get_session
from app.notify.service import send_or_log
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


class RejectBody(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


def _request_dict(user: User, session: Session) -> dict:
    token = session.exec(
        select(AccessToken).where(AccessToken.user_id == user.id, AccessToken.purpose == "verify")
    ).first()
    domain = user.email.rsplit("@", 1)[-1]
    official_domain = domain in {"kr-kralovehradecky.cz", "khk.cz", "sskhk.cz"} or domain.endswith(".khk.cz")
    return {
        "id": user.id,
        "email": user.email,
        "name": user.display_name,
        "organization": user.organization,
        "job_title": user.job_title,
        "email_verified": user.email_verified_at is not None,
        "official_domain": official_domain,
        "verify_url": f"/api/auth/verify?token={token.token}" if token is not None else None,
        "created_at": user.created_at.isoformat(),
    }


@router.get("/overview")
def overview(request: Request, session: Session = Depends(get_session), _: User = Depends(require_admin)) -> dict:
    users = session.exec(select(User)).all()
    by_role: dict[str, int] = {}
    pending = 0
    for user in users:
        by_role[user.role] = by_role.get(user.role, 0) + 1
        if user.status == "pending":
            pending += 1
    closures = session.exec(select(Closure)).all()
    by_status: dict[str, int] = {}
    for row in closures:
        by_status[row.status] = by_status.get(row.status, 0) + 1
    notices = session.exec(select(Notification)).all()
    last = session.exec(select(AuditEvent).order_by(AuditEvent.id.desc())).first()
    settings_row = get_settings_row(session)
    settings = get_settings()
    engine = request.app.state.engine
    return {
        "users_by_role": by_role,
        "pending_requests": pending,
        "closures_by_status": by_status,
        "notifications": len(notices),
        "last_audit": None
        if last is None
        else {"email": last.email, "action": last.action, "detail": last.detail, "created_at": last.created_at.isoformat()},
        "snapshot": engine.snapshot(),
        "ai_enabled": settings_row.ai_enabled,
        "ai_configured": settings.ai_configured,
        "push_configured": bool(settings.vapid_public_key and settings.vapid_private_key),
    }


@router.get("/access-requests")
def access_requests(session: Session = Depends(get_session), _: User = Depends(require_admin)) -> dict:
    rows = session.exec(select(User).where(User.status == "pending").order_by(User.id)).all()
    return {"items": [_request_dict(row, session) for row in rows]}


@router.post("/access-requests/{user_id}/approve")
def approve_access(
    user_id: int,
    request: Request,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    target = session.get(User, user_id)
    if target is None or target.status != "pending":
        raise HTTPException(status_code=404, detail="Žádost neexistuje.")
    target.role = "official"
    target.status = "active"
    session.add(target)
    audit(session, admin, "access.approve", target.email)
    session.commit()
    link = str(request.base_url).rstrip("/") + "/sprava"
    send_or_log(target.email, "Přístup schválen", f"Můžete se přihlásit do správy: {link}")
    return _request_dict(target, session) | {"status": target.status, "role": target.role}


@router.post("/access-requests/{user_id}/reject")
def reject_access(
    user_id: int,
    body: RejectBody,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    target = session.get(User, user_id)
    if target is None or target.status != "pending":
        raise HTTPException(status_code=404, detail="Žádost neexistuje.")
    target.status = "rejected"
    session.add(target)
    audit(session, admin, "access.reject", f"{target.email}: {body.reason}")
    session.commit()
    send_or_log(target.email, "Žádost o přístup zamítnuta", body.reason)
    return {"id": target.id, "status": target.status}


@router.get("/audit")
def list_audit(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: str = Query(default=""),
    action: str = Query(default=""),
    od: str = Query(default=""),
    do: str = Query(default=""),
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
) -> dict:
    statement = select(AuditEvent).order_by(AuditEvent.id.desc())
    if user:
        statement = statement.where(AuditEvent.email.contains(user))
    if action:
        statement = statement.where(AuditEvent.action == action)
    rows = session.exec(statement).all()
    if od:
        rows = [row for row in rows if row.created_at.isoformat()[:10] >= od]
    if do:
        rows = [row for row in rows if row.created_at.isoformat()[:10] <= do]
    page = rows[offset : offset + limit]
    return {
        "total": len(rows),
        "items": [
            {
                "id": row.id,
                "email": row.email,
                "action": row.action,
                "detail": row.detail,
                "created_at": row.created_at.isoformat(),
            }
            for row in page
        ],
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
