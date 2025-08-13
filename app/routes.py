from flask import Blueprint, jsonify, request
from . import db
from .models import Book
from .schemas import BookSchema

book_schema, books_schema = BookSchema(), BookSchema(many=True)

main = Blueprint('main', __name__)

@main.route('/books', methods=["POST"])
def add_book():
    data = request.get_json()
    errors = book_schema.validate(data)
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
