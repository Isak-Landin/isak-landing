from flask import request
from flask_login import current_user
from flask_socketio import join_room, emit

from extensions import socketio, db
from apps.chat.models import SupportChat, SupportMessage
from apps.admin.models import AdminUser

from datetime import datetime, timezone
import html

# Optional enum (works if present, falls back to str otherwise)
try:
    from apps.chat.models import SenderRole
except Exception:  # pragma: no cover
    SenderRole = None


def _scrub_text(s: str) -> str:
    """Normalize to str and escape HTML for safe transport."""
    return html.escape(s or "", quote=True)


def _is_admin(user) -> bool:
    return isinstance(user, AdminUser) or bool(getattr(user, "is_admin", False))


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@socketio.on("join_chat")
def handle_join_chat(data):
    chat_id = (data or {}).get("chat_id")
    if not chat_id:
        emit("error", {"error": "Missing chat_id"}, to=request.sid)
        return {"ok": False, "error": "missing_chat_id"}

    chat = SupportChat.query.get(chat_id)
    if not chat:
        emit("error", {"error": "Chat not found"}, to=request.sid)
        return {"ok": False, "error": "chat_not_found"}

    if not current_user.is_authenticated:
        emit("error", {"error": "Not authenticated"}, to=request.sid)
        return {"ok": False, "error": "not_authenticated"}

    admin = _is_admin(current_user)
    if not admin and chat.user_id != current_user.id:
        emit("error", {"error": "Not authorized for this chat"}, to=request.sid)
        return {"ok": False, "error": "not_authorized"}

    room = f"chat_{chat_id}"
    join_room(room)
    emit("info", {"message": f"Joined chat {chat_id}"}, to=request.sid)
    return {"ok": True}


@socketio.on("send_message")
def handle_send_message(data):
    print("\n--- [send_message] Incoming Data ---")
    print(f"Raw data: {data}")

    chat_id = (data or {}).get("chat_id")
    text_raw = ((data or {}).get("message") or "").strip()

    if not chat_id or not text_raw:
        print("[send_message] Missing chat_id or empty message")
        emit("error", {"error": "Missing chat_id or empty message"}, to=request.sid)
        return {"ok": False, "error": "missing_fields"}

    chat = SupportChat.query.get(chat_id)
    if not chat:
        print("[send_message] Chat not found")
        emit("error", {"error": "Chat not found"}, to=request.sid)
        return {"ok": False, "error": "chat_not_found"}

    if not current_user.is_authenticated:
        print("[send_message] Not authenticated")
        emit("error", {"error": "Not authenticated"}, to=request.sid)
        return {"ok": False, "error": "not_authenticated"}

    admin = _is_admin(current_user)
    if not admin and chat.user_id != current_user.id:
        print("[send_message] User not authorized for this chat")
        emit("error", {"error": "Not authorized for this chat"}, to=request.sid)
        return {"ok": False, "error": "not_authorized"}

    # Make sure sender is in the room (harmless if already joined)
    room_name = f"chat_{chat_id}"
    try:
        join_room(room_name)
    except Exception:
        pass

    # Persist (store raw text; we escape on emit + templates escape by default)
    try:
        role_value = SenderRole.admin if (SenderRole and admin) else (
            SenderRole.user if SenderRole else None
        )
        msg = SupportMessage(
            chat_id=chat_id,
            sender=role_value if role_value is not None else ("admin" if admin else "user"),
            sender_email=getattr(current_user, "email", None),
            message=text_raw,
            is_read=False
        )
        db.session.add(msg)
        db.session.commit()
        print(f"[send_message] Saved message to DB (id={msg.id}) at {getattr(msg, 'timestamp', None)}")
    except Exception as e:
        print(f"[send_message] DB error: {e}")
        emit("error", {"error": "Database error"}, to=request.sid)
        return {"ok": False, "error": "db_error"}

    # Build payload (escape for transport; client uses textContent anyway)
    try:
        ts = msg.timestamp.isoformat()
    except Exception:
        ts = getattr(msg, "timestamp", None)
        ts = ts.strftime("%Y-%m-%dT%H:%M:%S") if ts else _iso_now()

    sender_str = "admin" if admin else "user"
    sender_label = (
        f"{getattr(current_user, 'email', '')} (admin)"
        if admin else getattr(current_user, "email", "") or "User"
    )

    payload = {
        "id": msg.id,
        "chat_id": chat_id,
        "message": _scrub_text(text_raw),
        "sender": sender_str,          # 'admin' | 'user'
        "sender_label": sender_label,
        "timestamp": ts,
    }

    # Emit ONCE to the whole room and include the sender (prevents duplicate renders)
    print(f"[send_message] Emitting to room {room_name} include_self=True")
    emit("receive_message", payload, room=room_name, include_self=True)

    print("--- [send_message] Done ---\n")
    return {"ok": True, "id": msg.id, "timestamp": payload["timestamp"]}


@socketio.on("typing")
def handle_typing(data):
    chat_id = (data or {}).get("chat_id")
    is_typing = bool((data or {}).get("isTyping"))

    if not chat_id or not current_user.is_authenticated:
        return {"ok": False}

    room_name = f"chat_{chat_id}"
    # Notify the other party only
    emit("typing", {"chat_id": chat_id, "isTyping": is_typing}, room=room_name, include_self=False)
    return {"ok": True}


@socketio.on("connect")
def _on_connect():
    print(f"[socket] connect sid={request.sid}")


@socketio.on("disconnect")
def _on_disconnect():
    print(f"[socket] disconnect sid={request.sid}")
