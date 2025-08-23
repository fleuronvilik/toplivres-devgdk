from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import Operation, User, Book, db
from app.schemas import OperationSchema, SalesReportOperationSchema
from app.utils.decorators import role_required
from app.utils.helpers import get_inventory

sales_bp = Blueprint("sale", __name__, url_prefix="/api/sales")

@sales_bp.route("/")
@jwt_required()
@role_required("customer")
def list_sales():
    schema = OperationSchema(many=True)
    sales = Operation.query.filter(
        Operation.customer_id == get_jwt_identity(),
        Operation.op_type == "report"
    )
    return schema.dump(sales), 200

@sales_bp.route("/", methods=["POST"])
@jwt_required()
@role_required("customer")
def report_sale():
    user = User.query.get(get_jwt_identity())

    # if not is_last_delivery(user.id):
    #    return jsonify({ "msg": "Cannot submit a new report" }), 403

    schema = SalesReportOperationSchema(user_id=user.id)
    data = request.get_json()
    errors = schema.validate(data)
    if errors:
        return jsonify(errors), 400
    # import pdb; pdb.set_trace()
    # for i, item in enumerate(data["items"]):
    #     book = Book.query.get(item["book_id"])
    #     if not book:
    #         return jsonify({ "msg": "one item not in catalog" }), 400
    #     elif user.count_books(book.id) < item["quantity"]:
    #         print(f"Err: {book.title} (less than {item['quantity']})")
    #         return jsonify({ "err": f'Less than {item["quantity"]} of {book.title} in your inventory'})
    #     else:
    #         print(f"Ok! {book.title}")
    #         sale.items[i].quantity = -item["quantity"]

    sale = schema.load(data) #inventory, errors = get_inventory(get_jwt_identity()), []
    
    #for i, item in enumerate(sale.items):
        # book = Book.query.get(item["book_id"])   # still validate existence
        # if not book:
        #     errors.append({"book_id": item["book_id"], "error": "Not in catalog"})
        #     continue

        # current_qty = inventory.get(book.id, 0)  # 0 if never had this book
        # if current_qty < item["quantity"]:
        #     errors.append({
        #         "book_id": book.id,
        #         "error": f"Insufficient stock (have {current_qty}, need {item['quantity']})"
        #     })
        #     continue

        # Flip sign to mark sale
        # sale.items[i].quantity = -item["quantity"]
    #    item.quantity = -item.quantity
    
    #if errors:
    #    return jsonify({"errors": errors}), 400
    
    sale.customer_id = user.id
    sale.op_type = "report"
    db.session.add(sale)
    db.session.commit()
    return schema.dump(sale), 201

def is_last_delivery(customer_id):
    last = (
        Operation.query
        .filter_by(customer_id=customer_id)
        .order_by(Operation.date.desc())
        .first()
    )
    return last is not None and last.op_type == "delivered"
