from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError
from app.models import Operation, User, Book, db
from app.schemas import OperationSchema, DeliveryOperationSchema #, OperationCancelSchema
from app.utils.decorators import role_required
from app.utils.helpers import can_request_delivery

order_bp = Blueprint("order", __name__, url_prefix="/api/orders")

@order_bp.route("", methods=["POST"])
@jwt_required()
@role_required("customer")
def create_order():
    try:
        schema = DeliveryOperationSchema()
        op = schema.load(request.json)
    except ValidationError as err:
        return jsonify(err.messages), 400

    user_id = get_jwt_identity()

    report, prev = can_request_delivery(user_id)
    if prev and prev.op_type == "pending":
        return jsonify({ "msg": "Wait for delivery or cancel existing request first" }), 403
    elif prev and not report:
        return jsonify({ "msg": "A report since last delivery is required" }), 403
    
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
