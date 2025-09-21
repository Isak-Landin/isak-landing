# apps/admin/models.py

from extensions import db
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from sqlalchemy import event


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


# Normalize email to lowercase on insert/update (no schema change)
def _normalize_admin_email(mapper, connection, target: AdminUser):
    if getattr(target, "email", None):
        target.email = target.email.strip().lower()

event.listen(AdminUser, "before_insert", _normalize_admin_email)
event.listen(AdminUser, "before_update", _normalize_admin_email)
