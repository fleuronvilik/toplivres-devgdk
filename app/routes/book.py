from flask import Blueprint, jsonify, request
from app import db
from app.models import Book
from app.schemas import BookSchema

book_schema, books_schema = BookSchema(), BookSchema(many=True)

main = Blueprint('main', __name__, url_prefix='/books')

@main.route('/', methods=["POST"])
def add_book():
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
