# apps/legal/routes/docs.py
from flask import render_template, abort, url_for
from apps.legal.legal import legal_blueprint
from apps.legal.models import DOC_INDEX


@legal_blueprint.route("/<slug>", methods=["GET"])
def legal_detail(slug: str):
    doc = DOC_INDEX.get(slug)
    if not doc:
        abort(404)
    pdf_url = url_for("static", filename=f"legal/{doc['filename']}")
    # templates/legal/detail.html (you already have this)
    return render_template("legal/detail.html", doc=doc, pdf_url=pdf_url)
