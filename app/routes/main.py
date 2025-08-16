from flask import Blueprint, jsonify, request
from app import db
from app.models import Book, Operation
from app.schemas import BookSchema, OpSchema

from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity

book_schema, books_schema = BookSchema(), BookSchema(many=True)
many_op = OpSchema(many=True)

main_bp = Blueprint('main', __name__)


# -------------------------
# CORE BUSINESS
# -------------------------

# -------------------------
# CUSTOMERS
# -------------------------
@main_bp.route("/history")
@jwt_required()
def get_history():
    user_id = get_jwt_identity()
    user_id = int(user_id)
    
    claims = get_jwt()

    if claims.get("role") == "customer":
        history = Operation.query.where(Operation.customer_id == user_id)
        return many_op.dump(history), 200
    return jsonify({"error": "expects a customer"}), 403


# -------------------------
# BOOKS
# -------------------------
@main_bp.route('/books', methods=["POST"])
@jwt_required()
def add_book():
    claims = get_jwt()

    if claims.get("role") == "customer":
        return jsonify({"message": "admin only"}), 403

    data = request.get_json()
    errors = book_schema.validate(data, session=db.session)
    if errors:
        return jsonify(errors), 400
    
    new_book = Book(**data)
    db.session.add(new_book)
    db.session.commit()
    return jsonify({ "data": new_book.to_dict() }), 201

@main_bp.route('/books')
def books_list():
    books = Book.query.all()
    return jsonify({ "data": books_schema.dump(books) }), 200

@main_bp.route('/books/<int:book_id>')
def show_book(book_id):
    book = db.get_or_404(Book, book_id) #Book.query.get(book_id)
    return jsonify({ "data": book_schema.dump(book) }), 200
