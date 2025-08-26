import pytest
from datetime import date
from app import create_app, db
from app.models import User, Book, Operation, OperationItem

@pytest.fixture
def app():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"
    })
    with app.app_context():
        db.create_all()
        # Seed minimal data for tests
        admin = User(name="admin", email="admin@test.com", role="admin")
        admin.set_password("adminpass")
        customer = User(name="customer", email="cust@test.com", role="customer")
        customer.set_password("custpass")
        bob = User(name="bob", email="bob@test.com", role="customer")
        bob.set_password("bobpass")

        book1 = Book(title="Book One", unit_price=10)
        book2 = Book(title="Book Two", unit_price=15)
        book3 = Book(title="Book Three", unit_price=20)

        op = Operation(customer=bob, op_type="delivered", date=date(2024, 10, 3)) # deutschland, rentrée stars
        db.session.add_all([
            OperationItem(operation=op, book=book1, quantity=2),
            OperationItem(operation=op, book=book2, quantity=10)
            # OperationItem(operation=op, book=epargne, quantity=3)
        ])

        db.session.add_all([admin, customer, bob, book1, book2, book3, op])
        db.session.commit()

    yield app

    # Teardown
    with app.app_context():
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def auth_headers(client):
    # Get JWTs for admin and customer
    res_admin = client.post("api/auth/login", json={"email": "admin@test.com", "password": "adminpass"})
    res_cust = client.post("/api/auth/login", json={"email": "cust@test.com", "password": "custpass"})
    res_bob = client.post("/api/auth/login", json={"email": "bob@test.com", "password": "bobpass"})

    return {
        # "admin": res_admin.get_json()["access_token"],
        # "customer": res_cust.get_json()["access_token"]
        "admin": {"Authorization": f'Bearer {res_admin.get_json()["access_token"]}'},
        "customer": {"Authorization": f'Bearer {res_cust.get_json()["access_token"]}'},
        "bob": {"Authorization": f'Bearer {res_bob.get_json()["access_token"]}'}

    }
