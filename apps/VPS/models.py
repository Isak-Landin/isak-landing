from extensions import db
from datetime import datetime


class VPS(db.Model):
    __tablename__ = 'vps'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    hostname = db.Column(db.String(64), nullable=False)
    ip_address = db.Column(db.String(45), nullable=False)  # IPv4/IPv6 safe
    status = db.Column(db.String(20), default='active')  # e.g. active, suspended, terminated
    created_at = db.Column(db.DateTime, default=datetime.now)


    # Optional extras
    os = db.Column(db.String(64))  # e.g. 'Ubuntu 24.04'
    location = db.Column(db.String(64))  # e.g. 'DE - Frankfurt'
    cpu_cores = db.Column(db.Integer)
    ram_mb = db.Column(db.Integer)
    disk_gb = db.Column(db.Integer)

    is_ready = db.Column(db.Boolean, default=False)  # Indicates if the VPS is ready for use

    # Relationship (optional if backref)
    user = db.relationship('User', backref=db.backref('vps_list', lazy=True))
