# utils/decorators.py
from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from functools import wraps
from app.models import User
from app.utils.helpers import error_response

def role_required(role):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user_id = get_jwt_identity()
            user = User.query.get(user_id)
            if not user or user.role != role:
                return error_response(f"Forbidden to {role}", 403, "auth")
            return fn(*args, **kwargs)
        return wrapper
    return decorator
