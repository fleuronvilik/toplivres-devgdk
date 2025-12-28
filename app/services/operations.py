from app.extensions import db
from app.models import Operation, OperationItem
from sqlalchemy import func, and_, or_

# legacy commented helpers removed

def get_inventory(user_id):
    rows = (
        db.session.query(OperationItem.book_id, func.sum(OperationItem.quantity))
        .join(Operation)
        .filter(
            Operation.customer_id == user_id,
            or_(
                and_(Operation.type == 'order', Operation.status == 'delivered'),
                (Operation.type == 'report')
            )
        )
        .group_by(OperationItem.book_id)
        .all()
    )
    # Turn list of tuples into dict { book_id: quantity }
    return {book_id: qty or 0 for book_id, qty in rows}

def can_request_delivery(user_id):
    last_delivery = (
        Operation.query
        .filter_by(customer_id=user_id)
        .filter(and_(Operation.type == 'order', Operation.status.in_(['pending', 'delivered'])))
        .order_by(Operation.id.desc())  # Operation.date.desc()
        .first()
    )
    if not last_delivery:
        return None, None # No previous deliveries, can request
    # last_delivery == pending case handled by caller's checks
    report_exists = (
        Operation.query
        .filter_by(customer_id=user_id)
        .filter(Operation.type == 'report')
        .filter(Operation.id > last_delivery.id)  # .filter(Operation.date > last_delivery.date)
        .first()
    )
    return report_exists is not None, last_delivery
