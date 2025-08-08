from extensions import db
from datetime import datetime

from sqlalchemy import Enum
import enum


class SenderRole(enum.Enum):
    user = "user"
    admin = "admin"


class SupportChat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(20), default='open')  # open, closed, archived
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    user = db.relationship('User', backref='support_chats')


class SupportMessage(db.Model):
    __table_args__ = (
        db.Index('ix_support_message_chat_timestamp', 'chat_id', 'timestamp'),
    )

    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, db.ForeignKey('support_chat.id'), nullable=False)
    sender = db.Column(Enum(SenderRole), nullable=False)

    sender_email = db.Column(db.String(120), nullable=True)  # <-- NEW

    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    timestamp = db.Column(db.DateTime, default=datetime.now)

    chat = db.relationship('SupportChat', backref='messages')

    @property
    def sender_label(self):
        if self.sender == SenderRole.admin:
            return f"{self.sender_email} (admin)"
        return self.sender_email

