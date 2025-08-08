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
    # DEBUG: how many chats exist at all?
    total_chats = SupportChat.query.count()
    print(f"[admin_inbox] total_chats={total_chats}")

    # Don’t filter by status for now (you can re-add once we verify data)
    # If you DO want to filter, ensure your SupportChat.status actually defaults to 'open'
    chats = (
        SupportChat.query
        .outerjoin(SupportMessage, SupportMessage.chat_id == SupportChat.id)
        .group_by(SupportChat.id)
        .order_by(func.max(SupportMessage.timestamp).desc())
        .all()
    )
    print(f"[admin_inbox] chats_found={len(chats)}")

    inbox = []
    for chat in chats:
        # Get messages ordered ascending (older -> newer)
        msgs = sorted(chat.messages, key=lambda m: m.timestamp)
        last_message = msgs[-1] if msgs else None
        unread = any(m.sender == 'user' and not m.is_read for m in msgs)

        inbox.append({
            'chat': chat,
            'last_message': last_message,
            'unread': unread
        })

    # Sort in Python: unread first, then by last message time (newest first)
    inbox.sort(
        key=lambda e: (
            0 if e['unread'] else 1,
            (e['last_message'].timestamp if e['last_message'] else datetime.min)
        ),
        reverse=False  # unread (0) before read (1); within groups we’ll flip below
    )
    # Now within each unread/read bucket, sort newest first
    inbox = sorted(
        inbox,
        key=lambda e: (0 if e['unread'] else 1,
                       (e['last_message'].timestamp if e['last_message'] else datetime.min)),
        reverse=True
    )

    print(f"[admin_inbox] inbox_built count={len(inbox)}")
    return render_template('chat/admin_chat_inbox.html', chats=inbox)


# --------------------------
# ADMIN: View specific chat
# --------------------------
@chat_blueprint.route('/admin/view/<int:chat_id>', methods=['GET'])
@admin_required
@admin_2fa_required
def admin_view_chat(chat_id):
    chat = SupportChat.query.get_or_404(chat_id)

    messages = (
        SupportMessage.query
        .filter_by(chat_id=chat.id)
        .order_by(SupportMessage.timestamp.asc())
        .all()
    )
    print(f"[admin_view_chat] chat_id={chat.id} messages={len(messages)}")

    # Mark all user messages as read on view (optional)
    changed = 0
    for msg in messages:
        if msg.sender == 'user' and not msg.is_read:
            msg.is_read = True
            changed += 1
    if changed:
        db.session.commit()
        print(f"[admin_view_chat] marked_user_msgs_read={changed}")

    return render_template('chat/admin_view_chat.html', chat=chat, messages=messages)


# --------------------------
# ADMIN: Reply to chat
# --------------------------
@chat_blueprint.route('/admin/reply/<int:chat_id>', methods=['POST'])
@admin_required
@admin_2fa_required
def admin_reply(chat_id):
    chat = SupportChat.query.get_or_404(chat_id)
    message = request.form.get('message', '').strip()

    if not message:
        print("[admin_reply] empty message")
        return jsonify({'error': 'Message is required'}), 400

    msg = SupportMessage(
        chat_id=chat.id,
        sender='admin',
        message=message,
        is_read=False
    )
    db.session.add(msg)
    db.session.commit()
    print(f"[admin_reply] saved msg_id={msg.id} for chat_id={chat.id}")

    return redirect(url_for('chat_blueprint.admin_view_chat', chat_id=chat.id))

