import io
import csv
from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required 
from sqlalchemy import case, desc, or_, and_
from app.models import Operation, OperationItem, Book, User, db
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

    if order.status == "pending":
        order.status = "approved"
        db.session.commit()
        log_event(
            "order approved",
            order_id=order.id,
            customer_id=order.customer.id,
            customer=order.customer.email,
            books_count=sum(item.quantity for item in order.items)
        )
        return jsonify({"msg": "Order approved"}), 200

    order.status = "delivered"
    order.type = 'order'
    db.session.commit()
    log_event(
        "order delivered",
        order_id=order.id,
        customer_id=order.customer.id,
        customer=order.customer.email,
        books_count=sum(item.quantity for item in order.items)
    )
    return jsonify({"msg": "Order delivered"}), 200


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
    # 0 = orders, 1 = reports (donc reports après)
    type_rank = case((Operation.type == "order", 0), else_=1)

    base = Operation.query.order_by(type_rank, desc(Operation.date), desc(Operation.id))

    actionable_q = or_(
        and_(Operation.type == "order", Operation.status.in_(["pending", "approved"])),
        # si tu veux garder une place pour reports "error" un jour :
        # and_(Operation.type == "report", Operation.status == "error"),
    )

    actionable = (
       base
        .filter(actionable_q)
        .order_by(Operation.date.desc())
        .all()
    )

    history = (
        base
        .filter(~actionable_q)
        .order_by(Operation.date.desc())
        .limit(25)
        .all()
    )

    schema = OperationSchema(many=True)
    return {"actionable": schema.dump(actionable), "history": schema.dump(history)}, 200




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

@admin_bp.route("/export/csv")
@jwt_required()
@role_required("admin")
def export_operations_csv():
    output = io.StringIO()
    writer = csv.writer(output)

    # En-têtes
    writer.writerow([
        "ID opération",
        "Date",
        "Client",
        "Livre",
        "Quantité",
        "Prix unitaire",
        "Total",
        "Type",
        "Statut",
        "Commentaire"
    ])

    # Requête : 1 ligne = 1 article
    rows = (
        db.session.query(
            Operation.id,
            Operation.date,
            User.name,
            Book.title,
            OperationItem.quantity,
            Book.unit_price,
            Operation.type,
            Operation.status,
        )
        .join(User, Operation.customer_id == User.id)
        .join(OperationItem, OperationItem.operation_id == Operation.id)
        .join(Book, OperationItem.book_id == Book.id)
        .order_by(Operation.date.desc())
        .limit(500)  # sécurité bêta
        .all()
    )

    for r in rows:
        total = r.quantity * r.unit_price
        writer.writerow([
            r.id,
            r.date.strftime("%Y-%m-%d"),
            r.name,
            r.title,
            r.quantity,
            r.unit_price,
            total,
            "Commande" if r.type == "order" else "Rapport",
            r.status or "—",
            ""
        ])

    output.seek(0)

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=toplivres_operations.csv"
        }
    )
