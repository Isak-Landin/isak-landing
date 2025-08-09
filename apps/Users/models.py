from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db


class User(UserMixin, db.Model):
    __tablename__ = 'user'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)

    # Stripe integration
    stripe_customer_id = db.Column(db.String(120), unique=True, nullable=True)

    def __repr__(self):
        return f'<User {self.email}>'

    def set_password(self, password):
        # Hash the password before storing it
        _password_hash = generate_password_hash(password)
        self.password = _password_hash

    def check_password(self, password):
        # Check if the provided password matches the stored hash
        return check_password_hash(self.password, password)
