from flask_login import current_user
from extensions import socketio, db
from apps.chat.models import SupportChat, SupportMessage
from flask_socketio import emit, join_room

@socketio.on('join_chat')
def on_join_chat(data):
    chat_id = data['chat_id']
    join_room(f"chat_{chat_id}")
    print(f"✅ User {current_user.email} joined chat room {chat_id}")


@socketio.on('send_message')
def handle_send_message(data):
    chat_id = data.get('chat_id')
    message = data.get('message')
    sender = data.get('sender')  # 'user' or 'admin'

    if not all([chat_id, message, sender]):
        emit('error', {'error': 'Missing data'})
        return

    # Save to DB
    msg = SupportMessage(
        chat_id=chat_id,
        sender=sender,
        message=message,
        is_read=False
    )
    db.session.add(msg)
    db.session.commit()

    emit('receive_message', {
        'chat_id': chat_id,
        'message': message,
        'sender': sender,
        'timestamp': msg.timestamp.strftime('%Y-%m-%d %H:%M:%S')
    }, room=f"chat_{chat_id}")
