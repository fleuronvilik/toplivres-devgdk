from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required 
from app.models import Operation, db
from app.schemas import BookSchema, OperationCancelSchema, OperationSchema
from app.utils.decorators import role_required
from app.utils.helpers import cancel_operation
from datetime import date

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

@admin_bp.route("/orders/<int:order_id>/confirm", methods=["PUT"])
@jwt_required()
@role_required("admin")
def confirm_order(order_id: int):
    """
    Admin confirm order
    """
    order = Operation.query.get(order_id)
    if not order or order.op_type != "pending":
        return jsonify({"msg": "Order not found or not pending"}), 404
    
    order.op_type = "delivered"
    db.session.commit()

    return jsonify({"msg": "Order confirmed"}), 200

@admin_bp.route("/operations", methods=["DELETE"])
@jwt_required()
@role_required("admin")
def cancel_op_admin():
    data = OperationCancelSchema().load(request.json)
    op = cancel_operation(data["customer_id"], data["op_date"], data["op_type"], is_admin=True)
    return OperationSchema().dump(op), 200


    # op = Operation.query.get(operation_id)
    # if op is None:
    #     return jsonify({ "msg": "Not found" }), 404
    
    # schema = OperationCancelSchema()
    # confirmation_data = request.get_json()
    # errors = schema.validate(confirmation_data)
    # if errors:
    #     return jsonify(errors)
    
    # op_date: str = confirmation_data["delete_date"]
    # print(op_date)
    # [year, mm, dd] = map(int, op_date.split("-"))
    
    # if (op.date == date(year=year, month=mm, day=dd) and op.customer_id == confirmation_data["delete_customer_id"]):
    #     db.session.delete(op)
    #     db.session.commit()
    # else:
    #     return { "msg": "No match, either date or customer_id" }, 200

    # schema = OperationSchema()
    # return schema.dump(op), 204

@admin_bp.route("/operations/<int:operation_id>", methods=["DELETE"])
@jwt_required()
@role_required("admin")
def delete_operation(operation_id):
    op = Operation.query.get(operation_id)
    if not op:
        return jsonify({"msg": "Not found"}), 404
    db.session.delete(op)
    db.session.commit()
    return OperationSchema().dump(op), 204

@admin_bp.route("/operations", methods=["GET"])
@jwt_required()
@role_required("admin")
def all_operations():
    all_op = Operation.query.all()
    return OperationSchema(many=True).dump(all_op)


@admin_bp.route("/books", methods=["POST"])
@jwt_required()
@role_required("admin")
def add_book():
    data = request.get_json()
    schema = BookSchema()
    errors = schema.validate(data, session=db.session)
    if errors:
        return jsonify(errors), 400
    
    book = schema.load(data, session=db.session)
    db.session.add(book)
    db.session.commit()

    return schema.dump(book), 201
