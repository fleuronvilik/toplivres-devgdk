from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required 
from app.models import Operation, db
from app.schemas import BookSchema, OperationCancelSchema, OperationSchema
from app.utils.decorators import role_required
from app.utils.helpers import error_response
from app import log_event

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

@admin_bp.route("/orders/<int:order_id>/confirm", methods=["PUT"])
@jwt_required()
@role_required("admin")
def confirm_order(order_id: int):
    """
    Admin confirm order
    """
    order = Operation.query.get(order_id)
    if not order or not (order.type == 'order' and order.status == 'pending'):
        return error_response("Order not found or not pending", 404, "order")
    
    # Transition to delivered (normalized + back-compat)
    order.status = "delivered"
    order.type = 'order'
    db.session.commit()
    log_event(
        "order confirmed",
        order_id=order.id,
        customer_id=order.customer.id,
        customer=order.customer.email,
        books_count=sum(item.quantity for item in order.items)
    )
    return jsonify({"msg": "Order confirmed"}), 200


@admin_bp.route("/operations/<int:operation_id>", methods=["DELETE"])
@jwt_required()
@role_required("admin")
def delete_operation(operation_id):
    op = Operation.query.get(operation_id)
    if not op:
        return error_response("Order or Report not found", 404, "operation")    
    if (op.type == 'order' and op.status == 'delivered'):
        op.status = "cancelled"
        db.session.commit()
        return OperationSchema().dump(op), 200
    
    db.session.delete(op)
    db.session.commit()
    return "", 204


@admin_bp.route("/operations", methods=["GET"])
@jwt_required()
@role_required("admin")
def all_operations():
    all_op = Operation.query.filter_by()
    return OperationSchema(many=True).dump(all_op)



@admin_bp.route("/books", methods=["POST"])
@jwt_required()
@role_required("admin")
def add_book():
    data = request.get_json()
    schema = BookSchema()
    # errors = schema.validate(data, session=db.session)
    # if errors:
    #     return jsonify(errors), 400
    
    book = schema.load(data, session=db.session)
    db.session.add(book)
    db.session.commit()

    return schema.dump(book), 201
