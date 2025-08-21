from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
# from sqlalchemy import or_
from app.models import Operation, User, Book, db
from app.schemas import OperationSchema, OperationCancelSchema
from utils.decorators import role_required
from utils.helpers import cancel_operation

order_bp = Blueprint("order", __name__, url_prefix="/api/orders")

@order_bp.route("", methods=["POST"])
@jwt_required()
@role_required("customer")
def create_order():
    data = request.get_json()
    schema = OperationSchema()
    errors = schema.validate(data)
    if errors:
        return jsonify(errors), 400

    pending = Operation.query.filter_by(op_type="pending")
    if pending.first():
        return jsonify({ "msg": "Complete or cancel existing request first" }), 403
    
    op = schema.load(data)

    ## book exists checks, could be skipped because of validation on the frontend
    for item in data["items"]:
        book_id = item["book_id"]
        book = Book.query.get(book_id)
        if not book:
            return jsonify({ "msg": f"No book with id {book_id} in catalog" }), 400
    
    op.customer_id = get_jwt_identity()  # assuming this is user id
    db.session.add(op)
    db.session.commit()
    return schema.dump(op), 201

@order_bp.route("")
@jwt_required()
@role_required("customer")
def list_orders():
    schema = OperationSchema(many=True)
    orders = Operation.query.filter(
            Operation.customer_id==get_jwt_identity(),
            (Operation.op_type == "delivered") | (Operation.op_type == "pending")
        ).all()
    return jsonify({"data": schema.dump(orders)}), 200

@order_bp.route("", methods=["DELETE"])
@jwt_required()
@role_required("customer")
def cancel_order_customer():
    data = OperationCancelSchema().load(request.json)
    customer_id = get_jwt_identity()
    op = cancel_operation(customer_id, data["op_date"])
    return OperationSchema().dump(op), 200
