from flask import Flask
from dotenv import load_dotenv
from extensions import db

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

from flask_login import LoginManager
import os

login_manager = LoginManager()
login_manager.login_view = 'auth_blueprint.login'


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


def create_app():
    _app = Flask(__name__, template_folder='static/templates', static_folder='static')

    login_manager.init_app(_app)

    _app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')

    _app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
    _app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

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

    # Initialize the database here if needed
    db.init_app(_app)

    return _app


app = create_app()


if __name__ == '__main__':
    app.run(debug=True)
