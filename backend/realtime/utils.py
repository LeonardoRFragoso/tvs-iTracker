from flask import request
from flask_jwt_extended import decode_token
from database import db
from models.user import User


def _authenticate_websocket_user(auth=None, token=None):
    """Autentica usuário WebSocket e retorna informações básicas (id, role, company).
    Token pode vir via auth handshake, query string (?token=) ou Authorization header.
    """
    info = {}
    if not token:
        if isinstance(auth, dict):
            token = auth.get('token') or auth.get('access_token')
        token = token or request.args.get('token')
        token = token or (request.headers.get('Authorization') or '').replace('Bearer ', '').strip()

    if token:
        try:
            decoded = decode_token(token)
            uid = decoded.get('sub')
            u = db.session.get(User, uid) if uid else None
            if u:
                info = {
                    'user_id': str(uid),
                    'role': getattr(u, 'role', None),
                    'company': getattr(u, 'company', None)
                }
        except Exception:
            # Token inválido não deve derrubar a conexão
            pass
    return info
