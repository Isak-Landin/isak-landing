# Secure for python -3.9
from __future__ import annotations

from extensions import db
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin


class AdminUser(db.Model, UserMixin):
    __tablename__ = 'admin_user'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    totp_secret = db.Column(db.String(32), nullable=True)

    def __repr__(self):
        return f'<AdminUser {self.email}>'

    def set_password(self, password):
        # Hash the password before storing it
        self.password = generate_password_hash(password)

    def check_password(self, password):
        # Check if the provided password matches the stored hash
        return check_password_hash(self.password, password)