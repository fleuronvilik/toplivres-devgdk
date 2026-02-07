# app/cli_seed.py
import json
from datetime import datetime
import click
from werkzeug.security import generate_password_hash
from flask.cli import with_appcontext
from .extensions import db
from .models import User, Book, Operation, OperationItem  # adjust import

# ---------- helpers ----------
def upsert_user(email, name, role, raw_password=None):
    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(email=email, name=name, role=role)
        if raw_password:
            user.password_hash = generate_password_hash(raw_password)
        db.session.add(user)
    else:
        # keep id/relations stable; update fields that may change
        user.name = name or user.name
        user.role = role or user.role
        if raw_password:
            user.password_hash = generate_password_hash(raw_password)
    return user

def upsert_book(sku, title, unit_price, fixed_id=None):
    book = Book.query.filter_by(id=fixed_id).first()
    if not book:
        book = Book(id=fixed_id) if fixed_id else Book()
        book.title = title
        book.unit_price = unit_price
        db.session.add(book)
    else:
        book.title = title or book.title
        book.unit_price = unit_price if unit_price is not None else book.unit_price
    return book

def create_operation(op_dict, user_map, book_map):
    """
    op_dict keys: id, type ('order'|'sales_report'), status,
    user_id (logical id from seed), created_at, delivered_at, cancelled_at, items:[{book_id, qty}]
    """
    # Idempotency: don't duplicate operations with same id
    op = Operation.query.get(op_dict["id"])
    if op:
        return op

    # Map seed user id -> actual db user.id
    seed_user_id = op_dict["user_id"]
    user = user_map[seed_user_id]

    # Map combined type to normalized type/status
    legacy_type = op_dict.get("type")
    if legacy_type in ("pending", "delivered", "cancelled"):
        normalized_type, normalized_status = "order", legacy_type
    elif legacy_type == "report":
        normalized_type, normalized_status = "report", "recorded"
    else:
        normalized_type, normalized_status = "order", "pending"

    created_at = parse_ts(op_dict.get("created_at"))
    op = Operation(
        id=op_dict["id"],
        customer_id=user.id,
        type=normalized_type,
        status=normalized_status,
        created_at=created_at,
        date=created_at.date() if created_at else None,
    )
    db.session.add(op)
    db.session.flush()  # ensure op.id exists for items

    for it in op_dict.get("items", []):
        book = book_map[it["book_id"]]
        db.session.add(OperationItem(operation_id=op.id, book_id=book.id, quantity=it["qty"]))

    return op

def parse_ts(val):
    if not val:
        return None
    # Accept ISO strings; fallback to naive parse
    try:
        return datetime.fromisoformat(val.replace("Z", "+00:00"))
    except Exception:
        return datetime.fromisoformat(val)

# ---------- built-in seed fixture (same as your current dataset) ----------
SEED_FIXTURE = {
    "users": [
        {"id": 1, "role": "admin", "name": "JEANNE", "email": "jeanne.admin@example.com", "password": "Admin123!"},
        {"id": 2, "role": "customer", "name": "AYA DISTRIBUTION", "email": "aya.partner@example.com", "password": "Password123"},
        {"id": 3, "role": "customer", "name": "BENOIT BOOKS", "email": "benoit.partner@example.com", "password": "Password123"},
    ],
    "books": [
        {"id": 1, "title": "DOM: Foundations", "sku": "DOM-FND", "unit_price": 15},
        {"id": 2, "title": "DOM: Practice", "sku": "DOM-PRC", "unit_price": 17},
        {"id": 3, "title": "DOM: Mindset", "sku": "DOM-MND", "unit_price": 20},
        {"id": 4, "title": "DOM: Leadership", "sku": "DOM-LDR", "unit_price": 22},
        {"id": 5, "title": "DOM: Future", "sku": "DOM-FTR", "unit_price": 25},
    ],
    "operations": [
        {"id": 101, "type": "pending", "status": "pending", "user_id": 2, "created_at": "2025-09-07T11:30:00",
         "items": [{"book_id": 1, "qty": 3}, {"book_id": 3, "qty": 2}]},
        {"id": 102, "type": "delivered", "status": "delivered", "user_id": 3, "created_at": "2025-09-06T16:45:00",
         "delivered_at": "2025-09-07T09:00:00+02:00", "items": [{"book_id": 2, "qty": 6}, {"book_id": 4, "qty": 4}]},
        {"id": 201, "type": "report", "status": "recorded", "user_id": 3, "created_at": "2025-09-07T14:10:00",
         "items": [{"book_id": 2, "qty": -2}]},
        {"id": 103, "type": "cancelled", "status": "cancelled", "user_id": 2, "created_at": "2025-09-05T09:05:00",
         "cancelled_at": "2025-09-05T10:10:00+02:00", "items": [{"book_id": 5, "qty": 1}]},
        {"id": 202, "type": "report", "status": "recorded", "user_id": 3, "created_at": "2025-09-07T16:20:00",
         "items": [{"book_id": 4, "qty": -1}]},
    ],
}

def _load_seed_dict(seed_dict):
    # 1) Users
    user_map = {}
    for u in seed_dict.get("users", []):
        user = upsert_user(email=u["email"], name=u["name"], role=u["role"], raw_password=u.get("password"))
        db.session.flush()
        user_map[u["id"]] = user

    # 2) Books
    book_map = {}
    for b in seed_dict.get("books", []):
        book = upsert_book(sku=b["sku"], title=b["title"], unit_price=b["unit_price"], fixed_id=b.get("id"))
        db.session.flush()
        book_map[b["id"]] = book

    # 3) Operations (+ items)
    for op in seed_dict.get("operations", []):
        create_operation(op, user_map=user_map, book_map=book_map)

@click.command("seed")
@click.option("--from-json", "json_path", type=click.Path(exists=True, dir_okay=False), default=None,
              help="Optional path to a JSON seed file (otherwise uses built-in fixture).")
@click.option("--reset/--no-reset", default=False, help="DEV ONLY: drop+create tables before seeding.")
@with_appcontext
def seed_command(json_path, reset):
    """Idempotent seed command. Usage: `flask seed [--reset] [--from-json path]`"""
    if reset:
        click.echo("⚠️  DEV RESET: dropping and recreating all tables…")
        db.drop_all()
        db.create_all()

    seed_data = SEED_FIXTURE
    if json_path:
        click.echo(f"Loading seed from {json_path} …")
        with open(json_path, "r") as f:
            seed_data = json.load(f)

    try:
        _load_seed_dict(seed_data)
        db.session.commit()
        click.echo("✅ Seed completed (idempotent).")
    except Exception as exc:
        db.session.rollback()
        click.echo(f"❌ Seed failed: {exc}")
        raise
