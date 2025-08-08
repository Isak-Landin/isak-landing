from flask import Blueprint, render_template, redirect, url_for, session, request, jsonify, abort
from flask_login import current_user, login_required
from extensions import db
from apps.chat.models import SupportChat, SupportMessage, SenderRole

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
        sender=SenderRole.user,
        sender_email=current_user.email,
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
@chat_blueprint.route('/view', methods=['GET'])
@login_required
def view_user_chat():
    chat_id = request.args.get('chat_id', type=int)
    if not chat_id:
        return render_template('chat/user_chat_empty.html')

    chat = SupportChat.query.get_or_404(chat_id)
    if chat.user_id != current_user.id:
        abort(403)

    raw_msgs = (SupportMessage.query
                .filter_by(chat_id=chat.id)
                .order_by(SupportMessage.timestamp.asc())   # or .created_at.asc()
                .all())

    me_email = getattr(current_user, "email", None)

    def label_for(m):
        if _is_admin_sender(m):
            email = m.sender_email or "admin"
            return f"{email} (admin)"
        else:
            # Prefer stored sender_email; fallback to me (viewer); then "user"
            return m.sender_email or me_email or "user"

    msgs = []
    for m in raw_msgs:
        sender_email = m.sender_email
        is_admin = _is_admin_sender(m)
        sender_label = label_for(m)

        # “mine” for user page: my email match, else non-admin
        if sender_email and me_email:
            is_mine = sender_email.lower() == me_email.lower()
        else:
            is_mine = not is_admin

        msgs.append({
            "id": m.id,
            "content": m.message,
            "timestamp": m.timestamp,       # keep as datetime for now
            "sender_label": sender_label,
            "sender_is_admin": is_admin,
            "is_mine": is_mine,
        })

    return render_template('chat/user_chat_view.html', chat=chat, messages=msgs)


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
    """
    Inbox: show chats that actually have messages, sorted:
      - Unread (has at least one unread user msg) first
      - Then by latest message timestamp (newest first)
    Includes heavy logging so we can see what's happening.
    """
    print("\n[admin_inbox] ---- START ----")
    total_chats = db.session.query(SupportChat).count()
    total_msgs = db.session.query(SupportMessage).count()
    print(f"[admin_inbox] totals: chats={total_chats}, messages={total_msgs}")

    # Subquery: latest timestamp per chat that has messages
    last_ts_subq = (
        db.session.query(
            SupportMessage.chat_id.label('chat_id'),
            func.max(SupportMessage.timestamp).label('last_ts')
        )
        .group_by(SupportMessage.chat_id)
        .subquery()
    )

    # Join chats to that subquery so we only get chats with >= 1 message
    rows = (
        db.session.query(SupportChat, last_ts_subq.c.last_ts)
        .join(last_ts_subq, last_ts_subq.c.chat_id == SupportChat.id)
        .order_by(last_ts_subq.c.last_ts.desc())
        .all()
    )

    print(f"[admin_inbox] rows_from_db={len(rows)}")
    inbox = []

    for idx, (chat, last_ts) in enumerate(rows, start=1):
        # Pull the actual last message (single query per chat; fine for now)
        last_msg = (
            db.session.query(SupportMessage)
            .filter_by(chat_id=chat.id)
            .order_by(SupportMessage.timestamp.desc())
            .first()
        )

        # Compute unread: any user message unread?
        unread = (
            db.session.query(SupportMessage)
            .filter_by(chat_id=chat.id, sender='user', is_read=False)
            .count() > 0
        )

        print(f"[admin_inbox] #{idx} chat_id={chat.id} user_id={chat.user_id} "
              f"last_ts={last_ts} last_msg_id={getattr(last_msg,'id',None)} unread={unread}")

        inbox.append({
            'chat': chat,
            'last_message': last_msg,
            'unread': unread
        })

    # Sort: unread first, then newest last_msg
    inbox.sort(
        key=lambda e: (
            0 if e['unread'] else 1,
            e['last_message'].timestamp if e['last_message'] else datetime.min
        ),
        reverse=False
    )
    # Within groups, newest first
    inbox = sorted(
        inbox,
        key=lambda e: (
            0 if e['unread'] else 1,
            e['last_message'].timestamp if e['last_message'] else datetime.min
        ),
        reverse=True
    )

    print(f"[admin_inbox] inbox_len={len(inbox)} ---- END ----\n")
    return render_template('chat/admin_chat_inbox.html', chats=inbox)


def _is_admin_sender(m):
    # tolerant to legacy rows where sender might be stored as string
    return (m.sender == SenderRole.admin) or (m.sender == "admin")

# ----------------------------
# Admin chat view
# ----------------------------
@chat_blueprint.route('/admin/view/<int:chat_id>', methods=['GET'])
@admin_required
@admin_2fa_required
def admin_view_chat(chat_id):
    chat = SupportChat.query.get_or_404(chat_id)

    raw_msgs = (SupportMessage.query
                .filter_by(chat_id=chat.id)
                .order_by(SupportMessage.timestamp.asc())   # or .created_at.asc()
                .all())

    me_email = getattr(current_user, "email", None)

    def label_for(m):
        if _is_admin_sender(m):
            email = m.sender_email or "admin"
            return f"{email} (admin)"
        else:
            # Prefer stored sender_email; fallback to chat.user.email; then "user"
            fallback_user_email = chat.user.email if getattr(chat, "user", None) else None
            return m.sender_email or fallback_user_email or "user"

    msgs = []
    for m in raw_msgs:
        sender_email = m.sender_email
        is_admin = _is_admin_sender(m)
        sender_label = label_for(m)

        # “mine” on admin page: admin messages, or exact email match for safety
        if sender_email and me_email:
            is_mine = sender_email.lower() == me_email.lower()
        else:
            is_mine = is_admin

        msgs.append({
            "id": m.id,
            "content": m.message,
            "timestamp": m.timestamp,       # keep as datetime for now
            "sender_label": sender_label,
            "sender_is_admin": is_admin,
            "is_mine": is_mine,
        })

    return render_template('chat/admin_view_chat.html', chat=chat, messages=msgs)


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
        sender=SenderRole.admin,
        sender_email=current_user.email,
        message=message,
        is_read=False
    )
    db.session.add(msg)
    db.session.commit()
    print(f"[admin_reply] saved msg_id={msg.id} for chat_id={chat.id}")

    return redirect(url_for('chat_blueprint.admin_view_chat', chat_id=chat.id))

