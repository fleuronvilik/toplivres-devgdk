from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import Operation, User, db
from app.schemas import OperationSchema, SalesReportOperationSchema
from app.utils.decorators import role_required
from app import log_event

sales_bp = Blueprint("sale", __name__, url_prefix="/api/sales")

@sales_bp.route("")
@jwt_required()
@role_required("customer")
def list_sales():
    customer_id = int(get_jwt_identity())
    schema = OperationSchema(many=True)
    sales = Operation.query.filter(
        Operation.customer_id == customer_id,
        Operation.type == "report"
    )
    return jsonify({"data": schema.dump(sales)}), 200


@sales_bp.route("", methods=["POST"])
@jwt_required()
@role_required("customer")
def report_sale():
    customer_id = int(get_jwt_identity())
    user = User.query.get(customer_id)

    schema = SalesReportOperationSchema(user_id=user.id)
    data = request.get_json()

    report = schema.load(data)
    
    report.customer_id = user.id
    report.type = "report"
    report.status = "recorded"
    db.session.add(report)
    db.session.commit()
    log_event("report submitted", report_id=report.id, customer=report.customer.email,
              books_count=-sum([item.quantity for item in report.items]))
    return schema.dump(report), 201
