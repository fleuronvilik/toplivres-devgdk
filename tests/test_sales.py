# test/test_sales.py

from app.services.operations import get_inventory # from pprint import pprint

def test_customer_report_with_empty_items(client, auth_headers):
    res = client.post('/api/sales', json={"items": []}, headers=auth_headers["bob"])
    assert res.status_code == 400
    data = res.get_json()
    assert "least" in data["items"][0]

def test_customer_report_contains_only_book_in_his_inventory(client, auth_headers):
    payload = {
        "items": [
            {"book_id": 1, "quantity": 1},
            {"book_id": 3, "quantity": 1}
        ]
    }
    res = client.post('/api/sales', json=payload, headers=auth_headers["bob"])
    assert res.status_code == 400
    data = res.get_json()
    assert data["items"][0]["book_id"] == 3
    assert "inventory" in data["items"][0]["error"]

def test_customer_report_with_invalid_quantities(client, auth_headers):
    payload = {
        "items": [
            {"book_id": 1, "quantity": 5},
            {"book_id": 2, "quantity": 1}
        ]
    }
    res = client.post('/api/sales', json=payload, headers=auth_headers["bob"])
    assert res.status_code == 400
    data = res.get_json()
    assert data["items"][0]["book_id"] == 1
    assert "Insufficient stock" in data["items"][0]["error"]

def test_multiple_valid_reports(client, auth_headers):
    payload = {
        "items": [
            {"book_id": 1, "quantity": 1},
            {"book_id": 2, "quantity": 3}
        ]
    }

    res = client.post('/api/sales', json=payload, headers=auth_headers["bob"])
    assert res.status_code == 201

    res = client.post('/api/sales', json=payload, headers=auth_headers["bob"])
    assert res.status_code == 201

def test_inventory_decrease(client, auth_headers):
    payload = {
        "items": [
            {"book_id": 1, "quantity": 2},
            {"book_id": 2, "quantity": 3}
        ]
    }

    inventory = get_inventory(1)
    assert inventory[1] == 2 and inventory[2] == 10

    res = client.post('/api/sales', json=payload, headers=auth_headers["bob"])

    inventory = get_inventory(1)
    assert inventory[1] == 0 and inventory[2] == 7

def test_admin_cannot_report_sale(client, auth_headers):
    res = client.post('/api/sales', json={}, headers=auth_headers["admin"])
    assert res.status_code == 403
    data = res.get_json()
    assert data["msg"] == "Forbidden"

def test_admin_can_delete_sale_report(client, auth_headers):
    payload = {
        "items": [
            {"book_id": 1, "quantity": 2},
            {"book_id": 2, "quantity": 3}
        ]
    }

    inventory = get_inventory(1)
    assert inventory[1] == 2 and inventory[2] == 10

    res = client.post('/api/sales', json=payload, headers=auth_headers["bob"])
    report_id = res.get_json()["id"]

    res = client.delete(f'/api/admin/operations/{report_id}', headers=auth_headers["bob"])
    assert res.status_code == 403
    data = res.get_json()
    assert data["msg"] == "Forbidden"

    res = client.delete(f'/api/admin/operations/{report_id}', headers=auth_headers["admin"])
    assert res.status_code == 204
    inventory = get_inventory(1)
    assert inventory[1] == 2 and inventory[2] == 10

    res = client.delete(f'/api/admin/operations/{report_id}', headers=auth_headers["admin"])
    assert res.status_code == 404
