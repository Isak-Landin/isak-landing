from flask import Flask
from dotenv import load_dotenv
from apps.home.home import blueprint as home_bp

# Load environment variables
load_dotenv()

app = Flask(__name__, template_folder='static/templates', static_folder='static')
app.register_blueprint(home_bp)

if __name__ == '__main__':
    app.run(debug=True)
