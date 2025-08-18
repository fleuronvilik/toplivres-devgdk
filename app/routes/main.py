from flask import Blueprint, jsonify, request
from app import db
from app.models import Book, Operation, OperationItem, User
from app.schemas import BookSchema, OpSchema
from sqlalchemy import select, func
from sqlalchemy.orm import aliased

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

@main_bp.route('/inventory')
@jwt_required()
def get_inventory():
    user_id, claims = int(get_jwt_identity()), get_jwt()

    if claims["role"] == "customer":
        stmt = (
            select(User.name, Book.title, func.sum(OperationItem.quantity).label('stock'))
                .join(Operation, Operation.customer_id == User.id)
                .join(OperationItem, OperationItem.operation_id == Operation.id)
                .join(Book, OperationItem.book_id == Book.id)
                .where(User.id == user_id)
                .group_by(Book.title, User.name)
        )
    else:
        stmt = (
            select(User.name, Book.title, func.sum(OperationItem.quantity).label('stock'))
                .join(Operation, Operation.customer_id == User.id)
                .join(OperationItem, OperationItem.operation_id == Operation.id)
                .join(Book, OperationItem.book_id == Book.id)
                .group_by(Book.title, User.name)
        )

    inventory = db.session.execute(stmt).all()
    inventory = [
        {
            "name": row.name,
            "title": row.title,
            "stock": row.stock,
        } for row in inventory
    ]
    return jsonify({"data": inventory}), 200

