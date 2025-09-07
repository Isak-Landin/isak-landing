# apps/legal/routes/index.py
from flask import render_template
from apps.legal.legal import legal_blueprint
from apps.legal.models import LEGAL_DOCS

@legal_blueprint.route("/", methods=["GET"])
def legal_index():
    groups = {}
    for d in LEGAL_DOCS:
        groups.setdefault(d["category"], []).append(d)
    for group in groups.values():
        group.sort(key=lambda x: x["title"].lower())
    # templates/legal/legal.html (you already have this)
    return render_template("legal/legal.html", groups=groups)
