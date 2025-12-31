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
    if not order or order.type != 'order' or order.status not in ('pending', 'approved'):
        return error_response("Order not found or not pending/approved", 404, "order")

    next_status = "approved" if order.status == "pending" else "delivered"
    order.status = next_status
    order.type = 'order'
    db.session.commit()
    log_event(
        f"order {next_status}",
        order_id=order.id,
        customer_id=order.customer.id,
        customer=order.customer.email,
        books_count=sum(item.quantity for item in order.items)
    )
    return jsonify({"msg": f"Order {next_status}"}), 200


@admin_bp.route("/operations/<int:operation_id>", methods=["DELETE"])
@jwt_required()
@role_required("admin")
def delete_operation(operation_id):
    op = Operation.query.get(operation_id)
    if not op:
        return error_response("Order or Report not found", 404, "operation")    
    if (op.type == 'order' and op.status != 'cancelled'):
        op.status = "cancelled"
        db.session.commit()
        return OperationSchema().dump(op), 200
    
    if op.type == 'report':
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
