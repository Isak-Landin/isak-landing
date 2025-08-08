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
        return

    chat = SupportChat.query.get(chat_id)
    if not chat:
        emit('error', {'error': 'Chat not found'}, to=request.sid)
        return

    if not current_user.is_authenticated:
        emit('error', {'error': 'Not authenticated'}, to=request.sid)
        return

    is_admin = isinstance(current_user, AdminUser) or getattr(current_user, 'is_admin', False)

    if not is_admin and chat.user_id != current_user.id:
        emit('error', {'error': 'Not authorized for this chat'}, to=request.sid)
        return

    join_room(f"chat_{chat_id}")
    emit('info', {'message': f'Joined chat {chat_id}'}, to=request.sid)


@socketio.on('send_message')
def handle_send_message(data):
    print("\n--- [send_message] Incoming Data ---")
    print(f"Raw data: {data}")

    chat_id = data.get('chat_id')
    message = data.get('message')
    sender = data.get('sender')  # 'user' or 'admin'
    print(f"chat_id={chat_id}, message={message}, sender={sender}")

    if not all([chat_id, message, sender]):
        print("[send_message] Missing required fields")
        emit('error', {'error': 'Missing chat_id, message, or sender'}, to=request.sid)
        return

    chat = SupportChat.query.get(chat_id)
    if not chat:
        print("[send_message] Chat not found")
        emit('error', {'error': 'Chat not found'}, to=request.sid)
        return

    if not current_user.is_authenticated:
        print("[send_message] Not authenticated")
        emit('error', {'error': 'Not authenticated'}, to=request.sid)
        return

    is_admin = isinstance(current_user, AdminUser) or getattr(current_user, 'is_admin', False)
    print(f"is_admin={is_admin}, current_user_id={current_user.id}")

    if sender == 'user':
        if chat.user_id != current_user.id:
            print("[send_message] User not authorized for this chat")
            emit('error', {'error': 'User not authorized for this chat'}, to=request.sid)
            return
    elif sender == 'admin':
        if not is_admin:
            print("[send_message] Admin not authorized")
            emit('error', {'error': 'Admin not authorized'}, to=request.sid)
            return
    else:
        print("[send_message] Invalid sender value")
        emit('error', {'error': 'Invalid sender'}, to=request.sid)
        return

    # Save to DB
    msg = SupportMessage(chat_id=chat_id, sender=sender, message=message, is_read=False)
    db.session.add(msg)
    db.session.commit()
    print(f"[send_message] Saved message to DB (id={msg.id}) at {msg.timestamp}")

    payload = {
        'chat_id': chat_id,
        'message': message,
        'sender': sender,
        'timestamp': msg.timestamp.strftime('%Y-%m-%d %H:%M:%S')
    }

    # Send to everyone else in the room
    print(f"[send_message] Emitting to room chat_{chat_id} (others only)")
    emit('receive_message', payload, room=f"chat_{chat_id}", include_self=False)

    # Send directly back to sender so they see it instantly
    print(f"[send_message] Echoing message back to sender SID={request.sid}")
    emit('receive_message', payload, to=request.sid)
    print("--- [send_message] Done ---\n")


@socketio.on('connect')
def _on_connect():
    print(f"[socket] connect sid={request.sid}")


@socketio.on('disconnect')
def _on_disconnect():
    print(f"[socket] disconnect sid={request.sid}")
