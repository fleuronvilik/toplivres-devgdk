from app.models import Operation, db
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

def can_request_delivery(user_id):
    last_delivery = (
        Operation.query
        .filter_by(user_id=user_id)
        .filter(Operation.op_type.in_(['pending', 'delivered']))
        .order_by(Operation.op_date.desc())
        .first()
    )
    if not last_delivery:
        return True  # No previous deliveries, can request
    report_exists = (
        Operation.query
        .filter_by(user_id=user_id, op_type='report')
        .filter(Operation.op_date > last_delivery.op_date)
        .first()
    )
    return report_exists is not None

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
    
    op.op_type = "cancelled"
    db.session.commit()
    return op
