import pytest, pprint
from datetime import date
from http.cookies import SimpleCookie
from app import create_app, db
from app.models import User, Book, Operation, OperationItem

collect_ignore = ["_legacy"]

@pytest.fixture
def app():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "JWT_SECRET_KEY": "test-secret",
        # Accept both headers and cookies for JWT in tests
        "JWT_TOKEN_LOCATION": ["headers", "cookies"],
        # In tests, disable CSRF protection for JWT cookies to simplify auth
        "JWT_COOKIE_CSRF_PROTECT": False
    })
    with app.app_context():
        db.create_all()
        # Seed minimal data for tests
        # Ensure Bob has id=1 to match test expectations (inventory lookups)
        bob = User(name="bob", email="bob@test.com", role="customer")
        bob.set_password("bobpass")
        admin = User(name="admin", email="admin@test.com", role="admin")
        admin.set_password("adminpass")
        customer = User(name="customer", email="cust@test.com", role="customer")
        customer.set_password("custpass")

        book1 = Book(title="Book One", unit_price=10)
        book2 = Book(title="Book Two", unit_price=15)
        book3 = Book(title="Book Three", unit_price=20)

        op = Operation(customer=bob, type='order', status='delivered', date=date(2024, 10, 3)) # deutschland, rentrée stars
        db.session.add_all([
            OperationItem(operation=op, book=book2, quantity=2),
            OperationItem(operation=op, book=book1, quantity=10)
            # OperationItem(operation=op, book=epargne, quantity=3)
        ])

        db.session.add_all([bob, admin, customer, book1, book2, book3, op])
        db.session.commit()

    yield app

    # Teardown
    with app.app_context():
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

# Push application context for each test function to allow direct DB helpers
@pytest.fixture(autouse=True)
def _app_ctx(app):
    with app.app_context():
        yield

@pytest.fixture
def auth_headers(app):
    """Return per-user headers for cookie-based JWT with CSRF.

    Provides a mapping of role->headers to pass on each request.
    Includes Cookie (access_token_cookie, csrf_access_token) and X-CSRF-TOKEN.
    """
    def login_and_headers(email, password):
        # Use an ephemeral client per identity to get a clean cookie pair
        with app.test_client() as c:
            res = c.post("/api/auth/login", json={"email": email, "password": password})
            assert res.status_code == 200
            set_cookies = res.headers.getlist('Set-Cookie')
            payload = res.get_json() or {}
            token = payload.get('access_token')
        cookie_values = {}
        for header in set_cookies:
            sc = SimpleCookie()
            sc.load(header)
            for key, morsel in sc.items():
                cookie_values[key] = morsel.value
        access = cookie_values.get('access_token_cookie')
        csrf = cookie_values.get('csrf_access_token')
        cookie_header = []
        if access:
            cookie_header.append(f'access_token_cookie={access}')
        if csrf:
            cookie_header.append(f'csrf_access_token={csrf}')
        headers = {}
        if cookie_header:
            headers['Cookie'] = '; '.join(cookie_header)
        if csrf:
            headers['X-CSRF-TOKEN'] = csrf
        if token:
            headers['Authorization'] = f'Bearer {token}'
        return headers

    return {
        "admin": login_and_headers("admin@test.com", "adminpass"),
        "customer": login_and_headers("cust@test.com", "custpass"),
        "bob": login_and_headers("bob@test.com", "bobpass"),
    }
