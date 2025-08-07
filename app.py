from flask import Flask, session
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

from flask_login import LoginManager
import os


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

    _app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')

    _app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
    _app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    socketio.init_app(_app)

    # Load environment variables
    load_dotenv()

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

    app.register_blueprint(chat_blueprint)

    # Initialize the database here if needed
    db.init_app(_app)

    return _app


app = create_app()

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


if __name__ == '__main__':
    app.run(debug=True)
