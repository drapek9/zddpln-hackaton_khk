"""Tables for everything the engine does not store.

The engine stays stateless. Pins, closures, votes, places and audit live here.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    password_hash: str
    role: str = Field(index=True)
    """citizen, official or admin."""
    blocked: bool = False
    token_version: int = 0
    created_at: datetime = Field(default_factory=utcnow)


class OfficialWeights(SQLModel, table=True):
    """Slider values that apply only to one official's view."""

    user_id: int = Field(primary_key=True)
    weights_json: str
    updated_at: datetime = Field(default_factory=utcnow)


class AppSetting(SQLModel, table=True):
    """Singleton row (id=1): permanent weights, vote cap, AI switch."""

    id: int = Field(primary_key=True)
    weights_json: str
    vote_cap: int = 10
    ai_enabled: bool = True
    updated_at: datetime = Field(default_factory=utcnow)


class RoadPin(SQLModel, table=True):
    road_id: int = Field(primary_key=True)
    priority: str
    reason: str | None = None
    user_id: int
    created_at: datetime = Field(default_factory=utcnow)


class Closure(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    road_id: int = Field(index=True)
    title: str
    date_from: str
    date_to: str
    restriction: str
    note: str | None = None
    status: str = Field(default="navrzeno", index=True)
    """navrzeno → schvaleno → naplanovano → probiha → hotovo."""
    confirmed: bool = Field(default=False, index=True)
    simulated: bool = True
    created_by: int
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    confirmed_by: int | None = None
    confirmed_at: datetime | None = None


class Place(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    kind: str
    """home or work. A point only, never a street address."""
    lon: float
    lat: float

    __table_args__ = (UniqueConstraint("user_id", "kind", name="uq_place_user_kind"),)


class SavedRoute(SQLModel, table=True):
    """Usual commute, computed without treating our closures as closed.

    Notifications match closures against this list. The live response can
    still offer an alternate route around active closures.
    """

    user_id: int = Field(primary_key=True)
    road_ids_json: str
    km: float | None = None
    minutes: float | None = None
    found: bool = False
    updated_at: datetime = Field(default_factory=utcnow)


class Notification(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    event_key: str
    title: str
    body: str
    read: bool = False
    push_sent: bool = False
    email_sent: bool = False
    created_at: datetime = Field(default_factory=utcnow)

    __table_args__ = (UniqueConstraint("user_id", "event_key", name="uq_notification_event"),)


class PushSubscription(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    endpoint: str = Field(unique=True)
    p256dh: str
    auth: str
    created_at: datetime = Field(default_factory=utcnow)


class AuditEvent(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int | None = Field(default=None, index=True)
    email: str = ""
    action: str = Field(index=True)
    detail: str = ""
    created_at: datetime = Field(default_factory=utcnow)


class Report(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    lon: float
    lat: float
    description: str
    has_photo: bool = False
    kind: str = "jine"
    severity: str = "stredni"
    road_id: int | None = Field(default=None, index=True)
    source: str = "sablona"
    """ai or sablona. The label shown to people is derived from this."""
    status: str = "nove"
    """nove or vyrizeno."""
    created_at: datetime = Field(default_factory=utcnow)


class Vote(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    road_id: int = Field(index=True)
    created_at: datetime = Field(default_factory=utcnow)

    __table_args__ = (UniqueConstraint("user_id", "road_id", name="uq_vote_user_road"),)
