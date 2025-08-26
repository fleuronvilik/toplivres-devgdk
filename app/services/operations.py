from app.extensions import db
from app.models import Operation, OperationItem
from sqlalchemy import func

# def inventory(customer_id=None, book_id=None):
#     if not customer_id and not book_id:
#         print("a sequence, it is")
#     elif customer_id and book_id:
#         print("how many of given book customer has")
#         timeline = Operation.query.filter_by(customer_id=customer_id)
#         count = 0
#         for op in timeline:
#             for i in op.items:
#                 if (not op.op_type == "pending" and i.book_id == book_id):
#                     count += i.quantity
#                 return count

def get_inventory(user_id):
    rows = (
        db.session.query(OperationItem.book_id, func.sum(OperationItem.quantity))
        .join(Operation)
        .filter(Operation.customer_id == user_id, Operation.op_type.notin_(["cancelled", "pending"]))
        .group_by(OperationItem.book_id)
        .all()
    )
    # Turn list of tuples into dict { book_id: quantity }
    return {book_id: qty or 0 for book_id, qty in rows}

def can_request_delivery(user_id):
    last_delivery = (
        Operation.query
        .filter_by(customer_id=user_id)
        .filter(Operation.op_type.in_(['pending', 'delivered']))
        .order_by(Operation.date.desc())
        .first()
    )
    if not last_delivery:
        return None, None # No previous deliveries, can request
    # if last_delivery.op_type == "pending":
    #     return False, True
    report_exists = (
        Operation.query
        .filter_by(customer_id=user_id, op_type='report')
        .filter(Operation.id > last_delivery.id) #.filter(Operation.date > last_delivery.date)
        .first()
    )
    return report_exists is not None, last_delivery