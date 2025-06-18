from flask import Flask
from dotenv import load_dotenv

# Import blueprints from different apps
from apps.home.home import blueprint as home_bp
from apps.websites.websites import blueprint as websites_bp
from apps.about.about import blueprint as about_bp
from apps.contact.contact import blueprint as contact_bp
from apps.hosting.hosting import blueprint as hosting_bp
from apps.server.server import blueprint as server_bp
from apps.support.support import blueprint as support_bp


# Load environment variables
load_dotenv()

app = Flask(__name__, template_folder='static/templates', static_folder='static')
app.register_blueprint(home_bp)
app.register_blueprint(websites_bp)
app.register_blueprint(about_bp)
app.register_blueprint(contact_bp)
app.register_blueprint(hosting_bp)
app.register_blueprint(server_bp)
app.register_blueprint(support_bp)

if __name__ == '__main__':
    app.run(debug=True)
