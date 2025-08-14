from flask import Blueprint, jsonify, request
from . import db
from .models import Book, User
from .schemas import BookSchema, UserSchema

from werkzeug.security import generate_password_hash, check_password_hash

book_schema, books_schema = BookSchema(), BookSchema(many=True)
user_schema = UserSchema()

main = Blueprint('main', __name__)
auth_bp = Blueprint("auth", __name__)

@main.route('/books', methods=["POST"])
def add_book():
    data = request.get_json()
    errors = book_schema.validate(data, session=db.session)
    if errors:
        return jsonify(errors), 400
    
    new_book = Book(**data)
    db.session.add(new_book)
    db.session.commit()
    return jsonify({ "data": new_book.to_dict() }), 201

@main.route('/books')
def books_list():
    books = Book.query.all()
    return jsonify({ "data": books_schema.dump(books) }), 200

@main.route('/books/<int:book_id>')
def show_book(book_id):
    book = db.get_or_404(Book, book_id) #Book.query.get(book_id)
    return jsonify({ "data": book_schema.dump(book) }), 200

@auth_bp.route('/signup', methods=["POST"])
def create_user():
    user_data = request.get_json()
    errors = user_schema.validate(user_data, session=db.session)
    if errors:
        return jsonify(errors), 400

    if User.query.filter_by(email=user_data["email"]).first():
        return jsonify({"error": "Email already registered"}), 400
    
    hashed_password = generate_password_hash(user_data["password"])

    new_user = User(
        name=user_data["name"],
        email=user_data["email"],
        password_hash=hashed_password
    )


    db.session.add(new_user),
    db.session.commit()

    return jsonify(user_schema.dump(new_user)), 201
