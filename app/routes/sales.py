from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import Operation, User, db
from app.schemas import OperationSchema, SalesReportOperationSchema
from app.utils.decorators import role_required

sales_bp = Blueprint("sale", __name__, url_prefix="/api/sales")

@sales_bp.route("")
@jwt_required()
@role_required("customer")
def list_sales():
    schema = OperationSchema(many=True)
    sales = Operation.query.filter(
        Operation.customer_id == get_jwt_identity(),
        Operation.op_type == "report"
    )
    return schema.dump(sales), 200


@sales_bp.route("", methods=["POST"])
@jwt_required()
@role_required("customer")
def report_sale():
    user = User.query.get(get_jwt_identity())

    schema = SalesReportOperationSchema(user_id=user.id)
    data = request.get_json()

    report = schema.load(data)
    
    report.customer_id = user.id
    report.op_type = "report"
    db.session.add(report)
    db.session.commit()
    return schema.dump(report), 201
