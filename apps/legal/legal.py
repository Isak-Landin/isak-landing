# apps/legal/legal.py
from flask import Blueprint

legal_blueprint = Blueprint(
    "legal_blueprint",
    __name__,
    template_folder="../../templates/legal",
    static_folder=None,
    url_prefix="/legal",
)

# Import routes (pattern like apps/admin/admin.py)
from .routes import index as _legal_routes_index  # noqa: F401
from .routes import docs as _legal_routes_docs    # noqa: F401
