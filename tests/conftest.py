import pytest
from app import create_app, db
from app.models import User, Book

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
        db.session.add_all([admin, customer])
        db.session.commit()
    yield app
    # Teardown
    with app.app_context():
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def tokens(client):
    # Get JWTs for admin and customer
    res_admin = client.post("/auth/login", json={"email": "admin@test.com", "password": "adminpass"})
    res_cust = client.post("/auth/login", json={"email": "cust@test.com", "password": "custpass"})
    return {
        "admin": res_admin.get_json()["access_token"],
        "customer": res_cust.get_json()["access_token"]
    }
