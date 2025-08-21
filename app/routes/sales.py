from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import Operation, User, Book
from app.schemas import OperationSchema
from utils.decorators import role_required

sales_bp = Blueprint("sale", __name__, url_prefix="/api/sales")

@sales_bp.route("/")
@jwt_required()
@role_required("customer")
def list_sales():
    schema = OperationSchema(many=True)
    sales = Operation.query.filter(
        Operation.customer_id == get_jwt_identity(),
        Operation.op_type == "is_report"
    )
    return schema.dump(sales), 200

@sales_bp.route("/", methods=["POST"])
@jwt_required()
@role_required("customer")
def report_sale():
    user = User.query.get(get_jwt_identity())

    if not is_last_delivery(user.id):
        return jsonify({ "msg": "Cannot submit a new report" }), 403

    schema = OperationSchema()
    data = request.get_json()
    sale = schema.load(data)
    # import pdb; pdb.set_trace()
    for item in data["items"]:
        book = Book.query.get(item["book_id"])
        if not book:
            return jsonify({ "msg": "one item not in catalog" }), 400
        elif user.count_books(book.id) < item["quantity"]:
            print(f"Err: {book.title} (less than {item['quantity']})")
        else:
            print(f"Ok! {book.title}")
    return jsonify({ "msg": "work in progress" })

def is_last_delivery(customer_id):
    last = (
        Operation.query
        .filter_by(customer_id=customer_id)
        .order_by(Operation.date.desc())
        .first()
    )
    return last is not None and last.op_type == "delivered"
