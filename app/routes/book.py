from flask import Blueprint, jsonify, request
from app import db
from app.models import Book
from app.schemas import BookSchema

from flask_jwt_extended import jwt_required, get_jwt

book_schema, books_schema = BookSchema(), BookSchema(many=True)

main = Blueprint('main', __name__, url_prefix='/books')

@main.route('/', methods=["POST"])
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

@main.route('/')
def books_list():
    books = Book.query.all()
    return jsonify({ "data": books_schema.dump(books) }), 200

@main.route('/<int:book_id>')
def show_book(book_id):
    book = db.get_or_404(Book, book_id) #Book.query.get(book_id)
    return jsonify({ "data": book_schema.dump(book) }), 200
