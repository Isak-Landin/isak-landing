from extensions import db
from datetime import datetime


class VPS(db.Model):
    __tablename__ = 'vps'

    @property
    def vps(self):
        return self.vps_list

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


class VPSPlan(db.Model):
    __tablename__ = 'vps_plan'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), nullable=False)  # e.g. 'Basic', 'Pro'
    cpu_cores = db.Column(db.Integer, nullable=False)
    ram_mb = db.Column(db.Integer, nullable=False)
    disk_gb = db.Column(db.Integer, nullable=False)
    price_per_month = db.Column(db.Numeric(10, 2), nullable=False)

    description = db.Column(db.Text)
    stripe_price_id = db.Column(db.String(128))
    is_active = db.Column(db.Boolean, default=True)

    def __repr__(self):
        return f"<VPSPlan {self.name} - {self.cpu_cores} cores, {self.ram_mb}MB RAM, {self.disk_gb}GB Disk>"
