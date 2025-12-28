from decimal import Decimal


def test_auth_me_works(client, auth_headers):
    res = client.get("/api/users/me", headers=auth_headers["customer"])
    assert res.status_code == 200
    data = res.get_json()
    assert "id" in data and "name" in data


def test_admin_adds_book_success(client, auth_headers):
    payload = {"title": "Happy Path Book", "unit_price": 12.5}
    res = client.post("/api/admin/books", json=payload, headers=auth_headers["admin"])
    assert res.status_code == 201
    data = res.get_json()
    assert data["title"] == payload["title"]
    # Marshmallow dumps Decimal for Numeric columns; allow both float/str forms
    assert str(data["unit_price"]) in {"12.50", "12.5"}


def test_customer_order_and_admin_confirm_flow(client, auth_headers):
    # Customer places a valid order
    order_payload = {"items": [{"book_id": 1, "quantity": 2}, {"book_id": 2, "quantity": 3}]}
    res = client.post("/api/orders", json=order_payload, headers=auth_headers["customer"])
    assert res.status_code == 201
    order_id = res.get_json()["id"]
    assert res.get_json()["type"] == "order"
    assert res.get_json()["status"] == "pending"

    # Admin confirms the order
    res = client.put(f"/api/admin/orders/{order_id}/confirm", headers=auth_headers["admin"])
    assert res.status_code == 200

    # Customer sees delivered order in their list
    res = client.get("/api/orders", headers=auth_headers["customer"])
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert any(op["id"] == order_id and op.get("type") == "order" and op.get("status") == "delivered" for op in data)


def test_inventory_after_delivery(client, auth_headers):
    # Place and confirm an order first
    order_payload = {"items": [{"book_id": 1, "quantity": 4}, {"book_id": 2, "quantity": 6}]}
    res = client.post("/api/orders", json=order_payload, headers=auth_headers["customer"])  # pending
    order_id = res.get_json()["id"]
    client.put(f"/api/admin/orders/{order_id}/confirm", headers=auth_headers["admin"])  # delivered

    # Inventory should reflect delivered quantities
    res = client.get("/api/users/inventory", headers=auth_headers["customer"])
    assert res.status_code == 200
    items = res.get_json()["data"]
    stocks = [item["stock"] for item in items]
    # Two seeded books exist: Book One (id=1), Book Two (id=2)
    assert sorted(stocks) == sorted([4, 6])


def test_customer_reports_sale_success_and_inventory_decreases(client, auth_headers):
    # Prepare inventory: deliver books to the customer
    order_payload = {"items": [{"book_id": 1, "quantity": 5}, {"book_id": 2, "quantity": 7}]}
    res = client.post("/api/orders", json=order_payload, headers=auth_headers["customer"])  # pending
    order_id = res.get_json()["id"]
    client.put(f"/api/admin/orders/{order_id}/confirm", headers=auth_headers["admin"])  # delivered

    # Report a valid sale (subset of inventory)
    sale_payload = {"items": [{"book_id": 1, "quantity": 2}, {"book_id": 2, "quantity": 3}]}
    res = client.post("/api/sales", json=sale_payload, headers=auth_headers["customer"])
    assert res.status_code == 201

    # Inventory should decrease accordingly: (5-2, 7-3) => (3, 4)
    res = client.get("/api/users/inventory", headers=auth_headers["customer"])
    items = res.get_json()["data"]
    stocks = [item["stock"] for item in items]
    assert sorted(stocks) == sorted([3, 4])


def test_sales_list_and_stats(client, auth_headers):
    # Deliver then report a sale
    order_payload = {"items": [{"book_id": 1, "quantity": 10}, {"book_id": 2, "quantity": 10}]}
    res = client.post("/api/orders", json=order_payload, headers=auth_headers["customer"])  # pending
    order_id = res.get_json()["id"]
    client.put(f"/api/admin/orders/{order_id}/confirm", headers=auth_headers["admin"])  # delivered

    sale_payload = {"items": [{"book_id": 1, "quantity": 2}, {"book_id": 2, "quantity": 3}]}
    res = client.post("/api/sales", json=sale_payload, headers=auth_headers["customer"])  # report
    assert res.status_code == 201

    # Sales listing should include the new report
    res = client.get("/api/sales", headers=auth_headers["customer"])
    assert res.status_code == 200
    sales = res.get_json()["data"]
    assert any(op.get("type") == "report" for op in sales)

    # Stats reflect totals for this customer
    me = client.get("/api/users/me", headers=auth_headers["customer"]).get_json()
    user_id = me["id"]
    res = client.get(f"/api/users/{user_id}/stats", headers=auth_headers["customer"]) 
    assert res.status_code == 200
    stats = res.get_json()["data"]
    assert stats is not None
    # After one delivery (10,10) and one sale (2,3):
    # total_sales = 5, total_delivered = 20, ratio = 0.25 (sold/delivered), amount = 2*10 + 3*15 = 65
    assert stats["total_sales"] == 5
    assert stats["total_delivered"] == 20
    assert stats["delivery_ratio"] == 0.25
    assert stats["total_amount"] > 0


def test_update_profile_success(client, auth_headers):
    payload = {"name": "Customer One", "store_name": "  My Store  ", "address": " 123 Road ", "phone": "(+99) 123-456"}
    res = client.put("/api/users", json=payload, headers=auth_headers["customer"])
    assert res.status_code == 200
    data = res.get_json()
    assert data["name"] == "Customer One"
    assert data["store_name"] == "My Store"  # trimmed
    # Schema excludes address/phone from response; ensure they weren't echoed
    assert "address" not in data
    assert "phone" not in data
