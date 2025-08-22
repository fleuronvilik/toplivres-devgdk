from flask import Blueprint, jsonify, request
from app import db
from app.models import Book, Operation, OperationItem, User
from app.schemas import BookSchema, OperationSchema, ItemSchema
from sqlalchemy import select, func, and_
from sqlalchemy.orm import aliased

from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity

book_schema, books_schema = BookSchema(), BookSchema(many=True)
many_op = OperationSchema(many=True)

main_bp = Blueprint('main', __name__)

from datetime import date


# -------------------------
# CORE BUSINESS
# -------------------------


# -------------------------
# ORDERS (request 4 delivery) and SALES REPORT
# -------------------------
# @main_bp.route('/orders', methods=["POST"])
# @jwt_required()
# def submit_order():
#     user_id, claims = int(get_jwt_identity()), get_jwt()
#     if claims["role"] != "customer":
#         return jsonify({ "msg": "Not a customer"}), 403

#     all_op = Operation.query.all()
#     pending = Operation.query.filter_by(op_type="pending")
#     if pending.first() is None:
#         items = request.json["items"]

#         op = Operation(
#             customer=User.query.get(user_id),
#             op_type = "pending",
#             date=date.today()
#         )
#         db.session.add(op)

#         items = [
#             OperationItem(operation=op, book=Book.query.get(ident=i["book_id"]), quantity=i["quantity"]
#             ) for i in items
#         ]
#         db.session.add_all(items)
#         db.session.commit()
                
#         schema = OperationSchema()
#         return schema.dump(op), 201
#     else:
#         return jsonify({ "msg": "Complete or cancel existing request first" }), 403
    
@main_bp.route('/sales', methods=["POST"])
@jwt_required()
def report_sale():
    user_id = get_jwt_identity(), get_jwt()
    user = User.query.get(user_id)
    

    all_op = Operation.query.where(Operation.customer_id==user_id).all()
    if all_op and all_op.pop()["op_type"] == "delivered":
        items, total = request.json["items"], 0
        for i in items:
            if i["quantity"] > user.count_books(i["book_id"]):
                b = Book.query.get(i["book_id"])
                return jsonify({"msg": f"Insufficient stock for {b.title}"})
            else:
                total += i["quantity"] * b["unit_price"]

        # profit = total * user_commission / 100

        op = Operation(
            customer=User.query.get(user_id),
            op_type = "report",
            date=date.today()
        )

        items = [
            OperationItem(operation=op, book=Book.query.get(ident=i["book_id"]), quantity=-i["quantity"]
            ) for i in items
        ]
        db.session.add_all(items)
        db.session.commit()

        schema = OperationSchema()
        return schema.dump(op), 201
    else:
        return jsonify({ "msg": "work in progress" })


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


@main_bp.route('/api/books')
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
                .where(and_(User.id == user_id, Operation.op_type != "pending", Operation.op_type != "cancelled"))
                .group_by(Book.title, User.name)
        )
    else:
        stmt = (
            select(User.name, Book.title, func.sum(OperationItem.quantity).label('stock'))
                .join(Operation, Operation.customer_id == User.id)
                .join(OperationItem, OperationItem.operation_id == Operation.id)
                .join(Book, OperationItem.book_id == Book.id)
                .where(Operation.op_type != "pending", Operation.op_type != "cancelled")
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

# @main_bp.route('/o/<int:id>', methods=("DELETE"))
# def cancel():
#     pass