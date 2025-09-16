from extensions import db
from datetime import datetime
from sqlalchemy import Enum
import enum
from typing import Optional, List


class SenderRole(enum.Enum):
    user = "user"
    admin = "admin"


def _now():
    """
    Match existing naive timestamps (datetime.now) used in models.
    Keep naive to avoid mixing aware/naive datetimes within the DB.
    """
    return datetime.now()


class SupportChat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(20), default='open')  # open, closed, archived
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    user = db.relationship('User', backref='support_chats')

    # ---------- Lightweight computed metrics (no schema change) ----------

    @property
    def messages_sorted(self) -> List["SupportMessage"]:
        """Messages sorted by timestamp ascending (older first)."""
        # When relationship loading isn't ordered, sort in-memory.
        # If a relationship.order_by is set elsewhere, this is still safe.
        return sorted(self.messages or [], key=lambda m: m.timestamp or datetime.min)

    @property
    def last_message(self) -> Optional["SupportMessage"]:
        """Last message in this chat (None if empty)."""
        msgs = self.messages_sorted
        return msgs[-1] if msgs else None

    @property
    def last_user_msg_at(self) -> Optional[datetime]:
        """Timestamp of the latest user message."""
        ts = [m.timestamp for m in self.messages if m.sender == SenderRole.user and m.timestamp]
        return max(ts) if ts else None

    @property
    def last_admin_msg_at(self) -> Optional[datetime]:
        """Timestamp of the latest admin message."""
        ts = [m.timestamp for m in self.messages if m.sender == SenderRole.admin and m.timestamp]
        return max(ts) if ts else None

    @property
    def unread_count_for_admin(self) -> int:
        """
        Naive unread for admin:
        1) Prefer is_read flag if your app updates it for admin views.
        2) Fallback: count user messages newer than the last admin message.
        """
        # Prefer explicit read flags when available.
        flagged_unread = [m for m in self.messages if m.sender == SenderRole.user and not (m.is_read or False)]
        if flagged_unread:
            return len(flagged_unread)

        # Fallback heuristic: user messages after last admin reply
        la = self.last_admin_msg_at
        if la is None:
            return sum(1 for m in self.messages if m.sender == SenderRole.user)
        return sum(1 for m in self.messages if m.sender == SenderRole.user and (m.timestamp and m.timestamp > la))

    def wait_seconds_since_user(self, now: Optional[datetime] = None) -> int:
        """
        If the last event is a user message and admin hasn't answered since,
        return seconds since that user message. Otherwise 0.
        """
        now = now or _now()
        lu = self.last_user_msg_at
        la = self.last_admin_msg_at
        # user waiting if latest user message is strictly newer than last admin message
        if lu and (la is None or lu > la):
            return max(0, int((now - lu).total_seconds()))
        return 0

    def metrics_dict(self, now: Optional[datetime] = None) -> dict:
        """
        Compact metrics payload for UI/socket updates.
        """
        now = now or _now()
        last_msg = self.last_message
        wait_s = self.wait_seconds_since_user(now=now)
        return {
            "thread_id": self.id,
            "unread": self.unread_count_for_admin,
            "last_user_msg_at": self.last_user_msg_at.isoformat() if self.last_user_msg_at else None,
            "last_admin_msg_at": self.last_admin_msg_at.isoformat() if self.last_admin_msg_at else None,
            "last_message_at": last_msg.timestamp.isoformat() if last_msg and last_msg.timestamp else None,
            "wait_seconds": wait_s,
            "waiting": wait_s > 0,
        }


class SupportMessage(db.Model):
    __table_args__ = (
        db.Index('ix_support_message_chat_timestamp', 'chat_id', 'timestamp'),
    )

    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, db.ForeignKey('support_chat.id'), nullable=False)
    sender = db.Column(Enum(SenderRole), nullable=False)

    sender_email = db.Column(db.String(120), nullable=True)  # preserved

    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    timestamp = db.Column(db.DateTime, default=datetime.now)

    chat = db.relationship('SupportChat', backref='messages')

    @property
    def sender_label(self) -> str:
        if self.sender == SenderRole.admin:
            return f"{self.sender_email} (admin)" if self.sender_email else "admin"
        return self.sender_email or "user"

    @property
    def is_user(self) -> bool:
        return self.sender == SenderRole.user

    @property
    def is_admin(self) -> bool:
        return self.sender == SenderRole.admin
