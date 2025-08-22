from app.models import Operation, OperationItem, db
from sqlalchemy import func
from datetime import date

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
        .filter(Operation.customer_id == user_id)
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
        return True, None  # No previous deliveries, can request
    if last_delivery.op_type == "pending":
        return False, True
    report_exists = (
        Operation.query
        .filter_by(customer_id=user_id, op_type='report')
        .filter(Operation.date > last_delivery.date)
        .first()
    )
    return report_exists is not None, False

def parse_date(date_str: str):
    [year, mm, dd] = map(int, date_str.split("-"))
    return date(year=year, month=mm, day=dd)

def cancel_operation(customer_id, op_date, op_type="pending", is_admin=False):
    #op_date = parse_date(op_date)
    query = Operation.query.filter_by(customer_id=customer_id, op_type=op_type, date=op_date)

    op = query.first()

    if not op:
        raise ValueError("Not found")
    
    # Only admin can cancel any 
    if not is_admin and customer_id == op.customer_id:
        raise PermissionError("Not allowed")
    
    if op.op_type == "report":
        db.session.delete(op)
    else:
        op.op_type = "cancelled"
    db.session.commit()
    return op
