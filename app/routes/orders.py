from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
# from sqlalchemy import or_
from app.models import Operation, User, Book, db
from app.schemas import OperationSchema, DeliveryOperationSchema #, OperationCancelSchema
from app.utils.decorators import role_required
from app.utils.helpers import cancel_operation, can_request_delivery

order_bp = Blueprint("order", __name__, url_prefix="/api/orders")

@order_bp.route("", methods=["POST"])
@jwt_required()
@role_required("customer")
def create_order():
    data = request.get_json()
    schema = DeliveryOperationSchema()
    errors = schema.validate(data)
    if errors:
        return jsonify(errors), 400

    user_id = get_jwt_identity()
    report, pending = can_request_delivery(user_id)
    if pending:
        return jsonify({ "msg": "Wait for delivery or cancel existing request first" }), 403
    elif not report:
        return jsonify({ "msg": "A report since last delivery is required" }), 403

    op = schema.load(data)
    
    op.customer_id = user_id
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

@order_bp.route("/<int:operation_id>", methods=["DELETE"])
@jwt_required()
@role_required("customer")
def cancel_order(operation_id):
    # Does the operation exists,
    # is it of the pending type
    # is it owned by the customer sending the request
    op = Operation.query.get(operation_id)
    if not op or (op.op_type not in ["delivered", "pending"]) or (not op.customer_id == int(get_jwt_identity())):
        return jsonify({"msg": "Not found"}), 404
    #elif not op.customer_id == int(get_jwt_identity()):
    #    return jsonify({"msg": "You don't own the request you are trying to cancel."}), 403
    elif not op.op_type == "pending":
        return jsonify({"msg": "You can only cancel pending request"}), 403
    
    op.op_type = "cancelled"
    db.session.commit()
    return OperationSchema().dump(op), 204
