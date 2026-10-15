"""Web Push and e-mail. Both are best-effort; the in-app notice is the record."""

from __future__ import annotations

import json
import logging
import smtplib
from email.message import EmailMessage

from sqlmodel import Session, select

from app.config import get_settings
from app.db.models import Closure, Notification, PushSubscription, SavedRoute, User
from app.services.access import load_ids

log = logging.getLogger(__name__)

# VAPID keys live only in .env. Generate a pair once with:
#   cd backend && uv run python -m app.notify.vapid
# Put the printed values into VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.


def notify_closure(session: Session, closure: Closure) -> int:
    """One notice per citizen whose saved commute contains the road."""
    created = 0
    routes = session.exec(select(SavedRoute)).all()
    for route in routes:
        if closure.road_id not in load_ids(route.road_ids_json):
            continue
        user = session.get(User, route.user_id)
        if user is None or user.blocked or user.role != "citizen":
            continue
        event_key = f"closure:{closure.id}"
        exists = session.exec(
            select(Notification).where(Notification.user_id == user.id, Notification.event_key == event_key)
        ).first()
        if exists is not None:
            continue
        title = "Uzavírka na vaší trase"
        body = f"{closure.title}. Termín {closure.date_from} – {closure.date_to}. {closure.restriction}."
        note = Notification(user_id=user.id, event_key=event_key, title=title, body=body)
        session.add(note)
        session.flush()
        if _push_to_user(session, user.id, title, body):
            note.push_sent = True
        if _send_email(user.email, title, body):
            note.email_sent = True
        created += 1
    return created


def citizens_on_road(session: Session, road_id: int) -> int:
    count = 0
    for route in session.exec(select(SavedRoute)).all():
        if road_id in load_ids(route.road_ids_json):
            count += 1
    return count


def _push_to_user(session: Session, user_id: int, title: str, body: str) -> bool:
    settings = get_settings()
    if not settings.vapid_private_key or not settings.vapid_subject:
        return False
    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        log.warning("pywebpush is not installed; push was skipped")
        return False
    sent = False
    subs = session.exec(select(PushSubscription).where(PushSubscription.user_id == user_id)).all()
    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=json.dumps({"title": title, "body": body}, ensure_ascii=False),
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": settings.vapid_subject},
                ttl=60 * 60 * 24,
            )
            sent = True
        except WebPushException:
            log.info("push rejected for subscription %s", sub.id)
        except Exception:
            log.exception("push failed for subscription %s", sub.id)
    return sent


def _send_email(recipient: str, subject: str, body: str) -> bool:
    settings = get_settings()
    if not settings.smtp_host or not recipient:
        return False
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.vapid_subject.removeprefix("mailto:") or "noreply@cesty-khk.test"
    message["To"] = recipient
    message.set_content(body + "\n\nTohle je záložní e-mail. Stejné upozornění zůstává v aplikaci.")
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=5) as smtp:
            smtp.send_message(message)
        return True
    except OSError:
        log.info("e-mail was not sent; the in-app notice stays")
        return False
