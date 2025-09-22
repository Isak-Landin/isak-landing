# apps/security/models.py
from extensions import db

# We store SHA-256 (lowercased password) as 64-char hex; primary key for O(1) lookups
class WeakPassword10k(db.Model):
    __tablename__ = "weak_passwords_10k"
    hash = db.Column(db.String(64), primary_key=True)

class WeakPassword10m(db.Model):
    __tablename__ = "weak_passwords_10m"
    hash = db.Column(db.String(64), primary_key=True)
