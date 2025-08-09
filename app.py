from flask import Flask, session, request, g
from dotenv import load_dotenv
from extensions import db, socketio
from apps.admin.models import AdminUser

# Import blueprints from different apps
from apps.home.home import blueprint as home_bp
from apps.websites.websites import blueprint as websites_bp
from apps.about.about import blueprint as about_bp
from apps.contact.contact import blueprint as contact_bp
from apps.hosting.hosting import blueprint as hosting_bp
from apps.server.server import blueprint as server_bp
from apps.support.support import blueprint as support_bp
from apps.Users.auth import auth_blueprint
from apps.Users.users import blueprint as users_bp
from apps.Users.models import User
from apps.store.store import store_blueprint
from apps.admin.admin import admin_blueprint

from apps.chat.chat import chat_blueprint
# from apps.VPS.vps import vps_blueprint

from flask_login import LoginManager
import os

from apps.common.filters import register_jinja_filters

from apps.VPS.seed import seed_vps_plans
from apps.VPS.vps_catalog import VPS_PLANS
from apps.VPS.models import VPSPlan


login_manager = LoginManager()
login_manager.login_view = 'auth_blueprint.login'


@login_manager.user_loader
def load_user(user_id):
    if session.get('login_type') == 'admin':
        return AdminUser.query.get(user_id)
    return User.query.get(user_id)


def create_app():
    _app = Flask(__name__, template_folder='static/templates', static_folder='static')

    login_manager.init_app(_app)

    # Load environment variables
    load_dotenv()

    _app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')

    _app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
    _app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    socketio.init_app(_app)

    import apps.chat.socket_events

    _app.register_blueprint(home_bp)
    _app.register_blueprint(websites_bp)
    _app.register_blueprint(about_bp)
    _app.register_blueprint(contact_bp)
    _app.register_blueprint(hosting_bp)
    _app.register_blueprint(server_bp)
    _app.register_blueprint(support_bp)
    _app.register_blueprint(auth_blueprint)
    _app.register_blueprint(users_bp)
    _app.register_blueprint(store_blueprint)
    _app.register_blueprint(admin_blueprint)

    _app.register_blueprint(chat_blueprint)

    # _app.register_blueprint(vps_blueprint)

    # Register Jinja filters
    register_jinja_filters(_app)

    # Initialize the database here if needed
    db.init_app(_app)

    return _app


app = create_app()


@app.before_request
def set_request_timezone():
    tz_cookie = request.cookies.get("tz")
    if tz_cookie:
        g.tzname = tz_cookie


# Initialize the database
with app.app_context():
    db.create_all()

    if not AdminUser.query.first():
        from werkzeug.security import generate_password_hash

        default_admin = AdminUser(
            email='admin@admin.com',
            password=generate_password_hash('changeme')
        )
        db.session.add(default_admin)
        db.session.commit()
        print("✅ Default admin user created (admin / changeme)")

    try:
        catalog_codes = {p["plan_code"] for p in VPS_PLANS}
        existing_codes = {p.plan_code for p in VPSPlan.query.all()}

        missing = catalog_codes - existing_codes
        if missing:
            seed_vps_plans()
            print(f"✅ Seeded VPS plans (added/updated: {', '.join(sorted(missing))})")
        else:
            print("⏭️  VPS plans already present — skipping seed.")
    except Exception as e:
        print(f"⚠️  VPS plan seeding skipped due to error: {e}")


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5006, debug=True)

