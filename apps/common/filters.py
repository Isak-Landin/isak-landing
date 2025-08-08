# apps/common/filters.py
from __future__ import annotations

from datetime import datetime
from typing import Optional, Union
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from flask import g

try:
    from flask_login import current_user
except Exception:
    # If flask_login isn't initialized yet, provide a stub so imports don't break
    class _Stub:
        def __getattr__(self, _): return None
    current_user = _Stub()

Number = Union[int, float]


def _get_user_tzname() -> str:
    """
    Resolve timezone name, priority:
      1) g.tzname (set from cookie)
      2) current_user.timezone (if you store it)
      3) 'UTC'
    """
    return (
        getattr(g, "tzname", None)
        or getattr(current_user, "timezone", None)
        or "UTC"
    )


def _coerce_datetime(value: Union[datetime, Number, None]) -> Optional[datetime]:
    """
    Accepts datetime or POSIX timestamp (int/float).
    Returns an aware UTC datetime (naive treated as UTC).
    """
    if value is None:
        return None

    if isinstance(value, (int, float)):
        # Use UTC when converting timestamps
        return datetime.utcfromtimestamp(value).replace(tzinfo=ZoneInfo("UTC"))

    if not isinstance(value, datetime):
        return None

    if value.tzinfo is None:
        value = value.replace(tzinfo=ZoneInfo("UTC"))

    return value


def dt_short(value: Union[datetime, Number, None], tz: Optional[str] = None) -> str:
    """
    Jinja filter:
      Same day in target TZ  -> 'HH:MM'
      Different day          -> 'YYYY-MM-DD HH:MM'

    Usage:
        {{ msg.timestamp | dt_short }}
        {{ msg.timestamp | dt_short('America/New_York') }}
    """
    dt = _coerce_datetime(value)
    if dt is None:
        return ""

    tzname = tz or _get_user_tzname()
    try:
        target_tz = ZoneInfo(tzname)
    except ZoneInfoNotFoundError:
        target_tz = ZoneInfo("UTC")

    local = dt.astimezone(target_tz)
    now_local = datetime.now(target_tz)

    if local.date() == now_local.date():
        return local.strftime("%H:%M")
    return local.strftime("%Y-%m-%d %H:%M")


def register_jinja_filters(app) -> None:
    """
    Call once in app factory to register filters globally.
    """
    app.jinja_env.filters["dt_short"] = dt_short
