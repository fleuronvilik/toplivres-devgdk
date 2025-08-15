from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash, check_password_hash
from app import db
from app.models import User
from app.schemas import UserSchema

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

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
    
    return jsonify({"message": f"Welcome {user.name}!"}), 200
