# tests/test_orders.py

def test_customer_order_with_invalid_book(client, auth_headers):
    """Step 1: Alice places an order with a non-existing book"""
    payload = {"items": [{"book_id": 999, "quantity": 1}]}
    res = client.post("/api/orders", json=payload, headers=auth_headers["customer"])
    assert res.status_code == 400
    data = res.get_json()
    assert "items" in data["errors"]
    assert "No book with id 999" in data["errors"]["items"][0]


def test_customer_cannot_add_book(client, auth_headers):
    """Step 2: Alice tries to add a book (admin-only)"""
    payload = {"title": "Unauthorized Book", "unit_price": 12}
    res = client.post("/api/admin/books", json=payload, headers=auth_headers["customer"])
    assert res.status_code == 403
    data = res.get_json()
    assert "auth" in data["errors"]


def test_admin_can_add_book(client, auth_headers):
    """Step 3: Admin adds a book successfully"""
    payload = {"title": "New Book", "unit_price": 20}
    res = client.post("/api/admin/books", json=payload, headers=auth_headers["admin"])
    assert res.status_code == 201
    data = res.get_json()
    assert data["title"] == "New Book"

def test_customer_valid_order(client, auth_headers):
    """Step 4: Alice place a valid order (all books in catalog)"""
    payload = {
        "items": [
            {"book_id": 1, "quantity": 10},
            {"book_id": 2, "quantity": 10}
        ]
    }
    res = client.post("/api/orders", json=payload, headers=auth_headers["customer"])
    assert res.status_code == 201
    data = res.get_json()
    assert data["type"] == "order"
    assert data["status"] == "pending"

def test_customer_second_order_fails(client, auth_headers):
    """Step 5: Alice tries to place a new order while there is one pending"""
    payload = {
        "items": [
            {"book_id": 1, "quantity": 10},
            {"book_id": 2, "quantity": 10}
        ]
    }
    res = client.post("/api/orders", json=payload, headers=auth_headers["customer"])
    assert res.status_code == 201
    data = res.get_json()
    assert data["type"] == "order"
    assert data["status"] == "pending"

    res = client.post("/api/orders", json=payload, headers=auth_headers["customer"])
    assert res.status_code == 403
    data = res.get_json()
    assert "for delivery" in data["errors"]["order"][0]

def test_customer_cancel_order(client, auth_headers):
    """Step 6: Alice can cancel her own pending order/request"""
    payload = {
        "items": [
            {"book_id": 1, "quantity": 10},
            {"book_id": 2, "quantity": 10}
        ]
    }
    res = client.post("/api/orders", json=payload, headers=auth_headers["customer"])
    assert res.status_code == 201
    data = res.get_json()
    assert data["type"] == "order"
    assert data["status"] == "pending"

    res = client.delete("/api/orders/2", json=payload, headers=auth_headers["customer"])
    assert res.status_code == 204
    #data = res.get_json()
    #assert "cancelled successfully" in data["msg"]

    res = client.delete("/api/orders/1", json=payload, headers=auth_headers["customer"])
    assert res.status_code == 404
    data = res.get_json()
    assert "order" in data["errors"]
    assert "not found" in data["errors"]["order"][0]

    res = client.delete("/api/orders/3", json=payload, headers=auth_headers["customer"])
    assert res.status_code == 404
    data = res.get_json()
    assert "order" in data["errors"]
    assert "not found" in data["errors"]["order"][0]


def test_admin_only_can_confirm_order(client, auth_headers):
    """Step 7: Admin can confirm pending request, customer cannot even his own"""
    payload = {
        "items": [
            {"book_id": 1, "quantity": 10},
            {"book_id": 2, "quantity": 10}
        ]
    }

    res = client.post("/api/orders", json=payload, headers=auth_headers["customer"])
    assert res.status_code == 201
    data = res.get_json()
    assert data["type"] == "order"
    assert data["status"] == "pending"

    res = client.put("/api/admin/orders/2/confirm", json=payload, headers=auth_headers["customer"])
    assert res.status_code == 403
    data = res.get_json()
    assert "auth" in data["errors"]

    res = client.put("/api/admin/orders/2/confirm", json=payload, headers=auth_headers["admin"])
    assert res.status_code == 200
    data = res.get_json()
    assert "approved" in data["msg"]

def test_customer_cannot_cancel_after_confirmation(client, auth_headers):
    payload = {
        "items": [
            {"book_id": 1, "quantity": 10},
            {"book_id": 2, "quantity": 10}
        ]
    }

    res = client.post("/api/orders", json=payload, headers=auth_headers["customer"])
    assert res.status_code == 201
    data = res.get_json()
    assert data["type"] == "order"
    assert data["status"] == "pending"

    res = client.put("/api/admin/orders/2/confirm", json=payload, headers=auth_headers["admin"])
    assert res.status_code == 200

    res = client.delete("/api/orders/2", json=payload, headers=auth_headers["customer"])
    assert res.status_code == 403

def test_customer_order_unauthorized(client):
    # No JWT at all
    res = client.post("/api/orders", json={"items": [{"book_id": 1, "quantity": 1}]})
    assert res.status_code == 401
    data = res.get_json()
    assert "Missing" in data["msg"] or "authorization" in data["msg"].lower()
    

def test_admin_cannot_place_customer_order(client, auth_headers):
    res = client.post(
        "/api/orders",
        json={"items": [{"book_id": 1, "quantity": 1}]},
        headers=auth_headers["admin"],
    )
    assert res.status_code == 403
    data = res.get_json()
    assert "auth" in data["errors"]


def test_customer_order_with_empty_items(client, auth_headers):
    res = client.post(
        "/api/orders",
        json={"items": []},
        headers=auth_headers["customer"],
    )
    assert res.status_code == 400
    data = res.get_json()
    assert "items" in data["errors"]
    assert "required" in data["errors"]["items"][0]

def test_customer_must_report_before_new_order(client, auth_headers):
    payload = {
        "items": [
            {"book_id": 1, "quantity": 4},
            {"book_id": 2, "quantity": 6}
        ]
    }
    res = client.post('/api/orders', json=payload, headers=auth_headers["bob"])
    assert res.status_code == 403
    data = res.get_json()
    assert "order" in data["errors"]
    assert "report" in data["errors"]["order"][0]
