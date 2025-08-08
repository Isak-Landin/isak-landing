from flask import Blueprint, render_template, redirect, url_for, session, request, jsonify, abort
from flask_login import current_user, login_required
from extensions import db
from apps.chat.models import SupportChat, SupportMessage

from decorators import admin_required, admin_2fa_required

from sqlalchemy import case, func
from datetime import datetime

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
# USER: Send a message (requires chat_id)
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

    if not chat_id or not message:
        return jsonify({'error': 'Missing chat_id or message'}), 400

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

    if request.is_json:
        return jsonify({'success': True})
    return redirect(url_for('chat_blueprint.view_user_chat', chat_id=chat.id))


# --------------------------
# USER: View specific chat (requires chat_id)
# --------------------------
# /chat/view?chat_id=<id>
@chat_blueprint.route('/view')
@login_required
def view_user_chat():
    chat_id = request.args.get('chat_id', type=int)
    if not chat_id:
        # No chat selected yet — prompt to start one
        return render_template('chat/user_chat_empty.html')

    chat = SupportChat.query.get_or_404(chat_id)
    if chat.user_id != current_user.id:
        abort(403)

    # Ensure ASC ordering
    messages = (
        SupportMessage.query
        .filter_by(chat_id=chat.id)
        .order_by(SupportMessage.timestamp.asc())
        .all()
    )
    return render_template('chat/user_chat_view.html', chat=chat, messages=messages)


# /chat/redirect: jump to the user's open chat if present, else to the empty view
@chat_blueprint.route('/redirect')
@login_required
def chat_redirect():
    chat = SupportChat.query.filter_by(user_id=current_user.id, status='open').first()
    if chat:
        return redirect(url_for('chat_blueprint.view_user_chat', chat_id=chat.id))
    return redirect(url_for('chat_blueprint.view_user_chat'))



# --------------------------
# ADMIN: View inbox (list of all open chats)
# --------------------------
@chat_blueprint.route('/admin/inbox')
@admin_required
@admin_2fa_required
def admin_inbox():
    chats = SupportChat.query.filter_by(status='open').all()

    inbox = []
    for chat in chats:
        messages = sorted(chat.messages, key=lambda m: m.timestamp)
        last_message = messages[-1] if messages else None
        unread = any(m.sender == 'user' and not m.is_read for m in messages)

        inbox.append({
            'chat': chat,
            'last_message': last_message,
            'unread': unread
        })

    # Sort: unread first, then by most recent message
    inbox.sort(key=lambda entry: (
        0 if entry['unread'] else 1,
        entry['last_message'].timestamp if entry['last_message'] else datetime.min
    ))

    return render_template('chat/admin_chat_inbox.html', chats=inbox)


# --------------------------
# ADMIN: View specific chat
# --------------------------
@chat_blueprint.route('/admin/view/<int:chat_id>', methods=['GET'])
@admin_required
@admin_2fa_required
def admin_view_chat(chat_id):
    chat = SupportChat.query.get_or_404(chat_id)
    messages = SupportMessage.query.filter_by(chat_id=chat.id).order_by(SupportMessage.timestamp).all()

    for msg in messages:
        if msg.sender == 'user' and not msg.is_read:
            msg.is_read = True

    db.session.commit()

    return render_template('chat/admin_view_chat.html', chat=chat, messages=messages)


# --------------------------
# ADMIN: Reply to chat
# --------------------------
@chat_blueprint.route('/admin/reply/<int:chat_id>', methods=['POST'])
@admin_required
@admin_2fa_required
def admin_reply(chat_id):
    chat = SupportChat.query.get_or_404(chat_id)
    message = request.form.get('message')

    if not message:
        return jsonify({'error': 'Message is required'}), 400

    msg = SupportMessage(
        chat_id=chat.id,
        sender='admin',
        message=message,
        is_read=False
    )
    db.session.add(msg)
    db.session.commit()

    return redirect(url_for('chat_blueprint.admin_view_chat', chat_id=chat.id))
