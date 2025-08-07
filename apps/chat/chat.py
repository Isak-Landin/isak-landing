from flask import Blueprint, render_template, redirect, url_for, session, request, jsonify, abort
from flask_login import current_user, login_required
from extensions import db
from apps.chat.models import SupportChat, SupportMessage

from decorators import admin_required, admin_2fa_required


chat_blueprint = Blueprint("chat_blueprint", __name__, url_prefix="/chat")


# --------------------------
# USER: Start a new chat
# --------------------------
@chat_blueprint.route('/start', methods=['POST'])
@login_required
def start_chat():
    # Prevent duplicate open chats (optional)
    existing = SupportChat.query.filter_by(user_id=current_user.id, status='open').first()
    if existing:
        return jsonify({'chat_id': existing.id})

    new_chat = SupportChat(user_id=current_user.id)
    db.session.add(new_chat)
    db.session.commit()

    return jsonify({'chat_id': new_chat.id})


# --------------------------
# USER: Send a message
# --------------------------
@chat_blueprint.route('/send', methods=['POST'])
@login_required
def send_message():
    if request.is_json:
        data = request.get_json()
        chat_id = data.get('chat_id')
        message = data.get('message')
    else:
        chat_id = request.form.get('chat_id')
        message = request.form.get('message')

    chat = SupportChat.query.get_or_404(chat_id)
    if chat.user_id != current_user.id:
        abort(403)

    msg = SupportMessage(
        chat_id=chat.id,
        sender='user',
        message=message,
        is_read=False
    )
    db.session.add(msg)
    db.session.commit()

    # Redirect after form submission
    if request.is_json:
        return jsonify({'success': True})
    return redirect(url_for('chat_blueprint.view_user_chat'))


# --------------------------
# USER: View chat (if exists)
# --------------------------
@chat_blueprint.route('/view')
@login_required
def view_user_chat():
    chat = SupportChat.query.filter_by(user_id=current_user.id, status='open').first()
    if not chat:
        return render_template('chat/user_chat_empty.html')  # Prompt to start chat

    messages = SupportMessage.query.filter_by(chat_id=chat.id).order_by(SupportMessage.timestamp).all()
    return render_template('chat/user_chat_view.html', chat=chat, messages=messages)



# --------------------------
# ADMIN: View inbox (list of all chats)
# --------------------------
@chat_blueprint.route('/admin/inbox')
@admin_required
@admin_2fa_required
def admin_inbox():
    # Sort chats by most recent message
    chats = (
        SupportChat.query
        .filter_by(status='open')
        .join(SupportMessage)
        .group_by(SupportChat.id)
        .order_by(db.func.max(SupportMessage.timestamp).desc())
        .all()
    )

    # Build view data
    inbox = []
    for chat in chats:
        unread = any(m.sender == 'user' and not m.is_read for m in chat.messages)
        last_message = chat.messages[-1] if chat.messages else None
        inbox.append({
            'chat': chat,
            'last_message': last_message,
            'unread': unread
        })

    return render_template('chat/admin_chat_inbox.html', chats=inbox)


@chat_blueprint.route('/admin/view/<int:chat_id>', methods=['GET'])
@admin_required
@admin_2fa_required
def admin_view_chat(chat_id):
    chat = SupportChat.query.get_or_404(chat_id)

    # Fetch messages ordered by time
    messages = SupportMessage.query.filter_by(chat_id=chat.id).order_by(SupportMessage.timestamp).all()

    # Mark all user messages as read (optional: only if page loads)
    for msg in messages:
        if msg.sender == 'user' and not msg.is_read:
            msg.is_read = True

    db.session.commit()

    return render_template('chat/admin_view_chat.html', chat=chat, messages=messages)


@chat_blueprint.route('/admin/reply/<int:chat_id>', methods=['POST'])
@admin_required
@admin_2fa_required
def admin_reply(chat_id):
    chat = SupportChat.query.get_or_404(chat_id)
    message = request.form.get('message')

    msg = SupportMessage(
        chat_id=chat.id,
        sender='admin',
        message=message,
        is_read=False  # unread by user
    )
    db.session.add(msg)
    db.session.commit()

    return redirect(url_for('chat/chat_blueprint.view_chat', chat_id=chat.id))

