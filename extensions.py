# extensions.py

from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO

# Database
db = SQLAlchemy()

# Realtime (kept as-is)
socketio = SocketIO(
    cors_allowed_origins="*",
    async_mode="eventlet",
    logger=True,
    engineio_logger=True
)

# Rate limiting (kept as-is)
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)

# CSRF protection (NEW)
# Matches your frontend which sends "X-CSRF-Token" via csrfFetch()
from flask_wtf.csrf import CSRFProtect
csrf = CSRFProtect()
