from flask_login import current_user
from extensions import socketio, db
from apps.chat.models import SupportChat, SupportMessage
from flask_socketio import emit, join_room
from sqlalchemy.orm.exc import NoResultFound
from apps.admin.models import AdminUser


@socketio.on('join_chat')
def on_join_chat(data):
    chat_id = data.get('chat_id')
    if not chat_id:
        emit('error', {'error': 'Missing chat_id'})
        return

    chat = SupportChat.query.get(chat_id)
    if not chat:
        emit('error', {'error': 'Chat not found'})
        return

    if not current_user.is_authenticated:
        emit('error', {'error': 'Not authenticated'})
        return

    is_admin = isinstance(current_user, AdminUser) or getattr(current_user, 'is_admin', False)
    # user must own the chat OR be an admin
    if not is_admin and chat.user_id != current_user.id:
        emit('error', {'error': 'Not authorized to join this chat'})
        return

    join_room(f"chat_{chat_id}")
    print(f"[socket] join_chat ok: user={getattr(current_user, 'email', 'anon')} chat_id={chat_id}")


@socketio.on('send_message')
def handle_send_message(data):
    chat_id = data.get('chat_id')
    message = data.get('message')
    sender = data.get('sender')  # 'user' or 'admin'

    if not all([chat_id, message, sender]):
        emit('error', {'error': 'Missing chat_id, message, or sender'})
        return

    chat = SupportChat.query.get(chat_id)
    if not chat:
        emit('error', {'error': 'Chat not found'})
        return

    if not current_user.is_authenticated:
        emit('error', {'error': 'Not authenticated'})
        return

    is_admin = isinstance(current_user, AdminUser) or getattr(current_user, 'is_admin', False)

    if sender == 'user':
        if chat.user_id != current_user.id:
            emit('error', {'error': 'User not authorized for this chat'})
            return
    elif sender == 'admin':
        if not is_admin:
            emit('error', {'error': 'Admin not authorized'})
            return
    else:
        emit('error', {'error': 'Invalid sender'})
        return

    msg = SupportMessage(chat_id=chat_id, sender=symbol := sender, message=message, is_read=False)
    db.session.add(msg)
    db.session.commit()

    emit('receive_message', {
        'chat_id': chat_id,
        'message': message,
        'sender': sender,
        'timestamp': msg.timestamp.strftime('%Y-%m-%d %H:%M:%S')
    }, room=f"chat_{chat_id}")

