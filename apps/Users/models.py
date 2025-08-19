# Users/models.py

from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db


class User(UserMixin, db.Model):
    __tablename__ = "user"

    id = db.Column(db.Integer, primary_key=True)

    # Existing (unchanged)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    stripe_customer_id = db.Column(db.String(120), unique=True, nullable=True)

    # New: profile fields
    first_name = db.Column(db.String(120), nullable=True)
    last_name  = db.Column(db.String(120), nullable=True)
    phone      = db.Column(db.String(40),  nullable=True)
    notes      = db.Column(db.Text,        nullable=True)

    # New: status & lifecycle
    is_active      = db.Column(db.Boolean, nullable=False, server_default=db.text("true"))
    created_at     = db.Column(db.DateTime, nullable=False, server_default=db.func.now())
    updated_at     = db.Column(db.DateTime, nullable=False, server_default=db.func.now(), onupdate=db.func.now())
    last_login_at  = db.Column(db.DateTime, nullable=True)

    # Helpers
    def __repr__(self):
        return f"<User {self.email}>"

    def set_password(self, raw_password: str):
        self.password = generate_password_hash(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password_hash(self.password, raw_password)

    @property
    def full_name(self) -> str:
        parts = [self.first_name or "", self.last_name or ""]
        s = " ".join(p for p in parts if p).strip()
        return s or (self.email or f"User #{self.id}")
