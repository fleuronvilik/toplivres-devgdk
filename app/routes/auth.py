from flask import Blueprint, jsonify, request, make_response
from flask_jwt_extended import create_access_token, set_access_cookies, unset_access_cookies
from werkzeug.security import generate_password_hash
from app.extensions import db
from app.models import User
from app.schemas import UserSchema
from datetime import timedelta

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

user_schema = UserSchema()

# -------------------------
# SIGNUP
# -------------------------
@auth_bp.route('/signup', methods=["POST"])
def create_user():
    # Deserialize and Validate
    user_data = request.get_json()
    errors = user_schema.validate(user_data, session=db.session)
    if errors:
        return jsonify(errors), 400

    # Check if email already exists
    if User.query.filter_by(email=user_data["email"]).first():
        return jsonify({"error": "Email already registered"}), 400
    
    # Create new user
    hashed_password = generate_password_hash(user_data["password"])
    new_user = User(
        name=user_data["name"],
        email=user_data["email"],
        password_hash=hashed_password
    )
    
    db.session.add(new_user),
    db.session.commit()

    # Serialize without password
    return jsonify(user_schema.dump(new_user)), 201


# -------------------------
# LOGIN
# -------------------------
@auth_bp.route('/login', methods=["POST"])
def login():
    email = request.json.get("email")
    password = request.json.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password are required"})
    
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email and password"}), 401
    
    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role},
        expires_delta=timedelta(hours=6)
    )

    resp = make_response(jsonify({"access_token": token}))
    set_access_cookies(resp, token, max_age=6*3600)
    return resp

@auth_bp.route('/logout')
def logout():
    resp = make_response(jsonify({"msg": "logout successful"}))
    unset_access_cookies(resp)
    return resp, 200
