from flask_socketio import join_room, emit
from flask import request
from flask_login import current_user
from extensions import socketio, db
from apps.chat.models import SupportChat, SupportMessage
from apps.admin.models import AdminUser


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

    join_room(f"chat_{chat_id}")
    emit('info', {'message': f'Joined chat {chat_id}'}, to=request.sid)
    return {"ok": True}



@socketio.on('send_message')
def handle_send_message(data):
    print("\n--- [send_message] Incoming Data ---")
    print(f"Raw data: {data}")

    chat_id = data.get('chat_id')
    message = data.get('message')
    sender = data.get('sender')  # 'user' or 'admin'
    print(f"chat_id={chat_id}, message={message}, sender={sender}")

    # Validate basic fields
    if not all([chat_id, message, sender]):
        print("[send_message] Missing required fields")
        emit('error', {'error': 'Missing chat_id, message, or sender'}, to=request.sid)
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

    is_admin = isinstance(current_user, AdminUser) or getattr(current_user, 'is_admin', False)
    print(f"is_admin={is_admin}, current_user_id={current_user.id}")

    if sender == 'user':
        if chat.user_id != current_user.id:
            print("[send_message] User not authorized for this chat")
            emit('error', {'error': 'User not authorized for this chat'}, to=request.sid)
            return {"ok": False, "error": "not_authorized_user"}
    elif sender == 'admin':
        if not is_admin:
            print("[send_message] Admin not authorized")
            emit('error', {'error': 'Admin not authorized'}, to=request.sid)
            return {"ok": False, "error": "not_authorized_admin"}
    else:
        print("[send_message] Invalid sender value")
        emit('error', {'error': 'Invalid sender'}, to=request.sid)
        return {"ok": False, "error": "invalid_sender"}

    # --- Save to DB with sender_email ---
    try:
        from apps.chat.models import SenderRole
        sender_role = SenderRole.admin if sender == 'admin' else SenderRole.user

        msg = SupportMessage(
            chat_id=chat_id,
            sender=sender_role,
            sender_email=current_user.email,
            message=message,
            is_read=False
        )
        db.session.add(msg)
        db.session.commit()
        print(f"[send_message] Saved message to DB (id={msg.id}) at {msg.timestamp}")
    except Exception as e:
        print(f"[send_message] DB error: {e}")
        emit('error', {'error': 'Database error'}, to=request.sid)
        return {"ok": False, "error": "db_error"}

    # --- Build payload with sender_label for live UI ---
    sender_label = f"{current_user.email} (admin)" if sender == 'admin' else current_user.email

    payload = {
        'chat_id': chat_id,
        'message': message,
        'sender': sender,
        'sender_label': sender_label,
        'timestamp': msg.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
        'id': msg.id,
    }

    # Broadcast to others in the room and echo to sender
    room_name = f"chat_{chat_id}"
    print(f"[send_message] Emitting to room {room_name} (others only)")
    emit('receive_message', payload, room=room_name, include_self=False)

    print(f"[send_message] Echoing message back to sender SID={request.sid}")
    emit('receive_message', payload, to=request.sid)

    print("--- [send_message] Done ---\n")

    # IMPORTANT: Return an ACK so the client resolves its promise/callback
    return {"ok": True, "id": msg.id, "timestamp": payload["timestamp"]}



@socketio.on('connect')
def _on_connect():
    print(f"[socket] connect sid={request.sid}")


@socketio.on('disconnect')
def _on_disconnect():
    print(f"[socket] disconnect sid={request.sid}")


@socketio.on('typing')
def handle_typing(data):
    chat_id = data.get('chat_id')
    is_typing = bool(data.get('isTyping'))

    if not chat_id or not current_user.is_authenticated:
        return {"ok": False}

    # Don’t send typing notifications to the typist; only to the other party
    room_name = f"chat_{chat_id}"
    emit('typing', {'chat_id': chat_id, 'isTyping': is_typing}, room=room_name, include_self=False)
    return {"ok": True}

