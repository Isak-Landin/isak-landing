from flask import Blueprint, render_template, redirect, url_for

home_blueprint = Blueprint("home_blueprint", __name__, template_folder="../../static/templates")

@home_blueprint.route("/")
def index():
    return render_template("public/index.html")

# Optional: legacy URL redirects → '/'
@home_blueprint.route("/about")
@home_blueprint.route("/contact")
@home_blueprint.route("/hosting")
@home_blueprint.route("/server")
@home_blueprint.route("/websites")
def legacy_redirect():
    return redirect(url_for("home_blueprint.index"), code=301)
