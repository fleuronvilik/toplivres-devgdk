from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models import Operation
from app.schemas import OperationSchema, DeliveryOperationSchema #, OperationCancelSchema
from app.services.operations import can_request_delivery
from app.utils.decorators import role_required
from app.utils.helpers import error_response
from app import log_event

order_bp = Blueprint("order", __name__, url_prefix="/api/orders")

@order_bp.route("", methods=["POST"])
@jwt_required()
@role_required("customer")
def create_order():
    schema = DeliveryOperationSchema()
    op = schema.load(request.json)

    user_id = get_jwt_identity()

    report, prev = can_request_delivery(user_id)
    if prev and prev.status == "pending":
        return error_response("Wait for delivery or cancel existing request first", 403, "order")
    if prev and not report:
        return error_response("A report since last delivery is required", 403, "order")
    
    op.customer_id = user_id
    op.type = 'order'
    op.status = 'pending'
    db.session.add(op)
    db.session.commit()
    log_event("order created", order_id=op.id, customer=op.customer.email, books_count=sum([item.quantity for item in op.items]))
    return schema.dump(op), 201


@order_bp.route("")
@jwt_required()
@role_required("customer")
def list_orders():
    schema = OperationSchema(many=True)
    orders = Operation.query.filter(
            Operation.customer_id == get_jwt_identity(),
            (Operation.type == 'order') & (Operation.status.in_(["delivered", "pending"]))
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
    if (not op) or (not (op.type == 'order' and op.status in ["delivered", "pending"])) or (not op.customer_id == int(get_jwt_identity())):
        return error_response("Order not found", 404, "order")
    #elif not op.customer_id == int(get_jwt_identity()):
    #    return jsonify({"msg": "You don't own the request you are trying to cancel."}), 403
    if not (op.status == "pending"):
        return error_response("You can only cancel pending order", 403, "order")   
    op.status = "cancelled"
    db.session.commit()
    log_event("order cancelled", order_id=op.id, customer=op.customer.email, reason="user_deleted_pending")
    return OperationSchema().dump(op), 204
