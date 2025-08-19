from flask_socketio import join_room, emit
from flask import request
from flask_login import current_user
from extensions import socketio, db
from apps.chat.models import SupportChat, SupportMessage
from apps.admin.models import AdminUser

# If your models define an enum for sender role, import it:
try:
    from apps.chat.models import SenderRole
except Exception:
    SenderRole = None  # fallback if not available


@socketio.on('join_chat')
def handle_join_chat(data):
    chat_id = data.get('chat_id')
    if not chat_id:
        emit('error', {'error': 'Missing chat_id'}, to=request.sid)
        return {"ok": False, "error": "missing_chat_id"}

    chat = SupportChat.query.get(chat_id)
    if not chat:
        emit('error', {'error': 'Chat not found'}, to=request.sid)
        return {"ok": False, "error": "chat_not_found"}

    if not current_user.is_authenticated:
        emit('error', {'error': 'Not authenticated'}, to=request.sid)
        return {"ok": False, "error": "not_authenticated"}

    is_admin = isinstance(current_user, AdminUser) or getattr(current_user, 'is_admin', False)
    if not is_admin and chat.user_id != current_user.id:
        emit('error', {'error': 'Not authorized for this chat'}, to=request.sid)
        return {"ok": False, "error": "not_authorized"}

    room = f"chat_{chat_id}"
    join_room(room)
    emit('info', {'message': f'Joined chat {chat_id}'}, to=request.sid)
    return {"ok": True}


@socketio.on('send_message')
def handle_send_message(data):
    print("\n--- [send_message] Incoming Data ---")
    print(f"Raw data: {data}")

    chat_id = data.get('chat_id')
    text = (data.get('message') or '').strip()

    # Derive sender from server-side state; ignore client 'sender'
    is_admin = isinstance(current_user, AdminUser) or getattr(current_user, 'is_admin', False)
    sender_str = 'admin' if is_admin else 'user'
    print(f"chat_id={chat_id}, message={text!r}, derived_sender={sender_str}")

    # Validate
    if not chat_id or not text:
        print("[send_message] Missing chat_id or empty message")
        emit('error', {'error': 'Missing chat_id or empty message'}, to=request.sid)
        return {"ok": False, "error": "missing_fields"}

    chat = SupportChat.query.get(chat_id)
    if not chat:
        print("[send_message] Chat not found")
        emit('error', {'error': 'Chat not found'}, to=request.sid)
        return {"ok": False, "error": "chat_not_found"}

    if not current_user.is_authenticated:
        print("[send_message] Not authenticated")
        emit('error', {'error': 'Not authenticated'}, to=request.sid)
        return {"ok": False, "error": "not_authenticated"}

    # Authorization
    if not is_admin and chat.user_id != current_user.id:
        print("[send_message] User not authorized for this chat")
        emit('error', {'error': 'Not authorized for this chat'}, to=request.sid)
        return {"ok": False, "error": "not_authorized"}

    # Ensure sender is in the room (in case client forgot to join)
    room_name = f"chat_{chat_id}"
    try:
        join_room(room_name)
    except Exception:
        pass

    # Persist
    try:
        role_value = None
        if SenderRole:
            role_value = SenderRole.admin if is_admin else SenderRole.user

        msg = SupportMessage(
            chat_id=chat_id,
            sender=role_value if role_value is not None else sender_str,  # supports enum or string
            sender_email=getattr(current_user, 'email', None),
            message=text,
            is_read=False
        )
        db.session.add(msg)
        db.session.commit()
        print(f"[send_message] Saved message to DB (id={msg.id}) at {msg.timestamp}")
    except Exception as e:
        print(f"[send_message] DB error: {e}")
        emit('error', {'error': 'Database error'}, to=request.sid)
        return {"ok": False, "error": "db_error"}

    # Payload (use ISO 8601 for consistency)
    try:
        ts = msg.timestamp.isoformat()
    except Exception:
        ts = getattr(msg, 'timestamp', None)
        ts = ts.strftime('%Y-%m-%dT%H:%M:%S') if ts else None

    sender_label = f"{getattr(current_user, 'email', '')} (admin)" if is_admin else getattr(current_user, 'email', '')

    payload = {
        'id': msg.id,
        'chat_id': chat_id,
        'message': text,
        'sender': sender_str,          # 'admin' | 'user'
        'sender_label': sender_label,  # useful for admin inbox UI
        'timestamp': ts,
    }

    # Emit ONCE to the whole room and include the sender
    # (removes the previous double-emit that caused duplicates)
    print(f"[send_message] Emitting to room {room_name} include_self=True")
    emit('receive_message', payload, room=room_name, include_self=True)

    print("--- [send_message] Done ---\n")
    return {"ok": True, "id": msg.id, "timestamp": payload["timestamp"]}


@socketio.on('typing')
def handle_typing(data):
    chat_id = data.get('chat_id')
    is_typing = bool(data.get('isTyping'))

    if not chat_id or not current_user.is_authenticated:
        return {"ok": False}

    room_name = f"chat_{chat_id}"
    # Notify only the other party
    emit('typing', {'chat_id': chat_id, 'isTyping': is_typing}, room=room_name, include_self=False)
    return {"ok": True}


@socketio.on('connect')
def _on_connect():
    print(f"[socket] connect sid={request.sid}")


@socketio.on('disconnect')
def _on_disconnect():
    print(f"[socket] disconnect sid={request.sid}")
