from flask import Blueprint, jsonify, request
from . import db
from .models import Book

main = Blueprint('main', __name__)

@main.route('/books', methods=["POST"])
def add_book():
    data = request.get_json()
    new_book = Book(
        title=data["title"],
        unit_price=data["unit_price"]
    )
    db.session.add(new_book)
    db.session.commit()
    return jsonify({"message": "Book added successfully"}), 201

@main.route('/books')
def books_list():
    books = Book.query.all()
    return jsonify({
        "data": [b.to_dict() for b in books]
    }), 200

@main.route('/books/<int:book_id>')
def show_book(book_id):
    book = db.get_or_404(Book, book_id) #Book.query.get(book_id)
    return jsonify({
        "data": book.to_dict()
    }), 200