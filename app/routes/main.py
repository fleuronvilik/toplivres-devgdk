from flask import Blueprint, jsonify, request, render_template, redirect, url_for
from app.extensions import db
from app.models import Book, Operation, OperationItem, User
from app.schemas import BookSchema, OperationSchema, UserSchema, UserUpdateSchema
from app.utils.decorators import role_required
from app.utils.helpers import error_response
from sqlalchemy import select, func, and_
from sqlalchemy.orm import aliased

from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity, decode_token
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError

book_schema, books_schema = BookSchema(), BookSchema(many=True)

main_bp = Blueprint('main', __name__)



# -------------------------
# SSR-first
# -------------------------
def current_user():
    token = request.cookies.get("access_token_cookie")
    if not token:
        return None
    print(decode_token(token))
    return User.query.get(decode_token(token)["sub"])

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
    
# @main_bp.route('/sales', methods=["POST"])
# @jwt_required()
# def report_sale():
#     user_id = get_jwt_identity(), get_jwt()
#     user = User.query.get(user_id)
    

#     all_op = Operation.query.where(Operation.customer_id==user_id).all()
#     if all_op and all_op.pop()["op_type"] == "delivered":
#         items, total = request.json["items"], 0
#         for i in items:
#             if i["quantity"] > user.count_books(i["book_id"]):
#                 b = Book.query.get(i["book_id"])
#                 return jsonify({"msg": f"Insufficient stock for {b.title}"})
#             else:
#                 total += i["quantity"] * b["unit_price"]

#         # profit = total * user_commission / 100

#         op = Operation(
#             customer=User.query.get(user_id),
#             op_type = "report",
#             date=date.today()
#         )

#         items = [
#             OperationItem(operation=op, book=Book.query.get(ident=i["book_id"]), quantity=-i["quantity"]
#             ) for i in items
#         ]
#         db.session.add_all(items)
#         db.session.commit()

#         schema = OperationSchema()
#         return schema.dump(op), 201
#     else:
#         return jsonify({ "msg": "work in progress" })


# -------------------------
# CUSTOMERS
# -------------------------
@main_bp.route('/api/users/me')
@jwt_required()
def user_info():
    schema = UserSchema()
    current_user = User.query.get(get_jwt_identity())
    return schema.dump(current_user), 200


@main_bp.route('/api/users/inventory')
@jwt_required()
def get_inventory():
    user_id, claims = int(get_jwt_identity()), get_jwt()

    if claims["role"] == "customer":
        stmt = (
            select(User.id, User.name, Book.title, func.sum(OperationItem.quantity).label('stock'))
                .join(Operation, Operation.customer_id == User.id)
                .join(OperationItem, OperationItem.operation_id == Operation.id)
                .join(Book, OperationItem.book_id == Book.id)
                .where(and_(User.id == user_id, Operation.op_type != "pending", Operation.op_type != "cancelled"))
                # .group_by(Book.title, User.name)
        )
    else:
        stmt = (
            select(User.id, User.name, Book.title, func.sum(OperationItem.quantity).label('stock'))
                .join(Operation, Operation.customer_id == User.id)
                .join(OperationItem, OperationItem.operation_id == Operation.id)
                .join(Book, OperationItem.book_id == Book.id)
                .where(Operation.op_type != "pending", Operation.op_type != "cancelled")
                # .group_by(Book.title, User.name)
        )
        if request.args:
            user_id = request.args["id"]
            stmt = stmt.where(User.id == user_id)

    inventory = db.session.execute(stmt.group_by(Book.title, User.name)).all()
    inventory = [
        {
            "id": row.id,
            "name": row.name,
            "title": row.title,
            "stock": row.stock,
        } for row in inventory
    ]

    return {"data": inventory}, 200


@main_bp.route('/api/users', methods=['PUT'])
@jwt_required()
def update_current_user():
    """Update the authenticated user's profile (partial updates allowed)."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return error_response("User not found", 404)

    schema = UserUpdateSchema()
    try:
        payload = schema.load(request.get_json(silent=True) or {})
    except ValidationError as err:
        return error_response(err.messages, 400)

    # Normalize: trim string fields; drop empty strings for partial updates
    for k, v in list(payload.items()):
        if isinstance(v, str):
            v = v.strip()
            if v == "":
                payload.pop(k)
                continue
            payload[k] = v

    # Case-insensitive uniqueness checks (avoid duplicates with different case)
    if "name" in payload:
        exists = (
            User.query
            .filter(func.lower(User.name) == payload["name"].lower())
            .filter(User.id != user_id)
            .first()
        )
        if exists:
            return error_response("Name already in use", 400, "name")

    if "email" in payload:
        exists = (
            User.query
            .filter(func.lower(User.email) == payload["email"].lower())
            .filter(User.id != user_id)
            .first()
        )
        if exists:
            return error_response("Email already in use", 400, "email")

    # Apply allowed fields only
    for field, value in payload.items():
        setattr(user, field, value)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return error_response("Name or email already in use", 400)

    return UserSchema().dump(user), 200


@main_bp.route('/api/users/<int:id>/stats')
@jwt_required()
def get_user_stats(id):
    user_id, claims = int(get_jwt_identity()), get_jwt()

    if claims["role"] == "customer" and id != user_id:
        return error_response("Unauthorized", 403, "reports")
    query = (
        db.session.query(
            User.id,  # Selecting User ID
            User.name,  # Selecting User Name
            func.sum(-OperationItem.quantity * Book.unit_price).label('total_amount')  # Calculating the Sum and labeling
        )
        .join(Operation, Operation.customer_id == User.id)  # Joining User with Operation
        .join(OperationItem, OperationItem.operation_id == Operation.id)  # Joining Operation with OperationItem
        .join(Book, OperationItem.book_id == Book.id)  # Joining OperationItem with Book
        .filter(OperationItem.quantity < 0)  # Filtering for quantity less than 0
        .filter(User.id == id)
        #.group_by(User.id, User.name)  # Grouping by User ID and Name
    )

    row = query.first()
    if not row:
        return {"data": None}
    
    total_sales = (
        db.session.query(func.sum(-OperationItem.quantity))
        .join(Operation, OperationItem.operation_id == Operation.id)
        .filter(Operation.customer_id == id)
        .filter(OperationItem.quantity < 0)
        .scalar()
    )

    total_delivered = (
        db.session.query(func.sum(OperationItem.quantity))
        .join(Operation, OperationItem.operation_id == Operation.id)
        .filter(Operation.customer_id == id)
        .filter(Operation.op_type == "delivered")
        .scalar()
    )

    delivery_ratio = (
        round(total_delivered / total_sales, 2) if total_sales > 0 else None
    )
    
    result = {
        "id": row.id,
        "name": row.name,
        "total_amount": float(row.total_amount) if row.total_amount else 0.0,
        "total_sales": total_sales,
        "total_delivered": total_delivered,
        "delivery_ratio": delivery_ratio
    }
    return {"data": result}

@main_bp.route("/api/operations")
@jwt_required()
@role_required("customer")
def get_history():
        query = Operation.query.filter_by(customer_id = get_jwt_identity())
        if (request.args):
            op_type = request.args["type"]
            if op_type == "order":
                query = query.filter(Operation.op_type.in_(["pending", "delivered"]))
            elif op_type == "report":
                query = query.filter(Operation.op_type == "report")
            else:
                query = query.filter(Operation.op_type != "cancelled")
        schema = OperationSchema(many=True)
        return jsonify({"data": schema.dump(query.all())}), 200


# -------------------------
# BOOKS
# -------------------------
@main_bp.route('/api/books')
def books_list():
    """
    Get all books
    ---
    responses:
      200:
        description: A list of books
        schema:
          type: object
          properties:
            data:
              type: array
              items:
                $ref: '#/definitions/Book'
    """
    books = Book.query.all()
    return jsonify({ "data": books_schema.dump(books) }), 200


@main_bp.route('/books/<int:book_id>')
def show_book(book_id):
    book = db.get_or_404(Book, book_id) #Book.query.get(book_id)
    return jsonify({ "data": book_schema.dump(book) }), 200

# -------------------------
# FRONTEND
# -------------------------
@main_bp.route("/")
def customer_self():
    user = current_user()
    if not user:
        return render_template("customer.html", role="")
    if user.role == "customer":
        return render_template("customer.html", role="customer", customer_id=user.id, customer_name=user.name)
    else:
        return redirect(url_for("main.admin"))

@main_bp.route("/admin")
def admin():
    user = current_user()
    if not user:
        return render_template("admin.html", role="")
    if user.role == "customer":
        return redirect(url_for("main.customer_self"))
    return render_template("admin.html", role="admin")

@main_bp.route("/admin/users/<int:id>")
def admin_user_detail(id):
    # Template is empty shell; data comes via JS fetches
    user = current_user()
    if not user or user.role == "customer":
        return redirect(url_for("main.customer_self"))
    customer = User.query.get(id)
    return render_template("customer_detail.html", role="admin", customer=customer)
