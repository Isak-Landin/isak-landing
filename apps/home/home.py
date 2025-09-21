from flask import Blueprint, render_template, redirect, url_for, request, Response
from datetime import datetime, timezone

home_blueprint = Blueprint("home_blueprint", __name__, template_folder="../../static/templates")


@home_blueprint.route("/")
def index():
    from apps.VPS.vps_catalog import VPS_PLANS

    # pick first 3 plans as teaser
    plans_teaser = VPS_PLANS[:3]

    return render_template("public/index.html", plans_teaser=plans_teaser)



@home_blueprint.route("/robots.txt")
def robots_txt():
    lines = [
        "User-agent: *",
        "Allow: /",
        f"Sitemap: {request.url_root.rstrip('/')}/sitemap.xml",
        ""
    ]
    return Response("\n".join(lines), mimetype="text/plain")


def _abs(url_path: str) -> str:
    return f"{request.url_root.rstrip('/')}{url_path}"


@home_blueprint.route("/sitemap.xml")
def sitemap_xml():
    # List only stable, public URLs. Add more later if needed.
    # Avoid url_for here to not explode if a blueprint isn’t registered yet.
    pages = [
        ("/", "weekly"),
        ("/vps", "daily"),            # if your list route is /vps
        ("/store", "weekly"),       # include only if public & registered
        ("/auth/login", "monthly"),
        ("/auth/register", "monthly"),
    ]

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for path, freq in pages:
        xml += [
            "  <url>",
            f"    <loc>{_abs(path)}</loc>",
            f"    <lastmod>{now}</lastmod>",
            f"    <changefreq>{freq}</changefreq>",
            "  </url>",
        ]
    xml.append("</urlset>")
    return Response("\n".join(xml), mimetype="application/xml")


# Optional: legacy URL redirects → '/'
@home_blueprint.route("/about")
@home_blueprint.route("/contact")
@home_blueprint.route("/hosting")
@home_blueprint.route("/server")
@home_blueprint.route("/websites")
def legacy_redirect():
    return "", 302, {"Location": url_for("home_blueprint.index")}
