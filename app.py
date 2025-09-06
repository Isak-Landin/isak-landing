from flask import Flask, session, request, g
from flask_login import login_required, current_user
from dotenv import load_dotenv
from extensions import db, socketio
from decorators import admin_required, admin_2fa_required
from apps.admin.models import AdminUser
from apps.Users.models import User

# Import blueprints from different apps
from apps.home.home import home_blueprint
# from apps.websites.websites import blueprint as websites_bp
# from apps.about.about import blueprint as about_bp
# from apps.contact.contact import blueprint as contact_bp
# from apps.hosting.hosting import blueprint as hosting_bp
# from apps.server.server import blueprint as server_bp
# from apps.support.support import blueprint as support_bp
from apps.Users.auth import auth_blueprint
from apps.Users.users import blueprint as users_bp
from apps.store.store import store_blueprint
from apps.chat.chat import chat_blueprint
from apps.VPS.vps import vps_blueprint

from apps.admin.admin import admin_blueprint

from flask_login import LoginManager
import os

from apps.common.filters import register_jinja_filters

from apps.VPS.seed import seed_vps_plans
from apps.VPS.vps_catalog import VPS_PLANS
from apps.VPS.models import VPSPlan

from flask_migrate import Migrate


login_manager = LoginManager()
login_manager.login_view = 'auth_blueprint.login'


@users_bp.before_request
@login_required
def require_login_users():
    pass


@store_blueprint.before_request
@login_required
def require_login_store():
    pass


@chat_blueprint.before_request
@login_required
def require_login_chat():
    pass


PUBLIC_VPS_ENDPOINTS = {"vps_blueprint.vps_webhook"}


@vps_blueprint.before_request
def require_login_vps():
    # Allow Stripe webhooks (no auth)
    if request.endpoint in PUBLIC_VPS_ENDPOINTS:
        return None

    # Require login for everything else under /vps
    if current_user.is_authenticated:
        return None
    return login_manager.unauthorized()


@admin_blueprint.before_request
@admin_required
@admin_2fa_required
def require_admin():
    pass


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

    # Register blueprints
    _app.register_blueprint(home_blueprint)
    _app.register_blueprint(auth_blueprint)
    _app.register_blueprint(users_bp)
    _app.register_blueprint(store_blueprint)
    _app.register_blueprint(admin_blueprint)

    _app.register_blueprint(chat_blueprint)

    _app.register_blueprint(vps_blueprint)

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


@app.context_processor
def inject_asset_version():
    import os, time
    return {"config": {"ASSET_VERSION": os.getenv("ASSET_VERSION", str(int(time.time()))) }}


migrate = Migrate(app, db)

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

