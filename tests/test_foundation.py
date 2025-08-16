def test_get_history(client, tokens):
    # Unauthenticated request
    res = client.get("/history")
    assert res.status_code == 401

    # Authenticated customer request
    res = client.get("/history", headers={"Authorization": f"Bearer {tokens['customer']}"})
    assert res.status_code == 200
    data = res.get_json()
    assert isinstance(data, list)  # history should be a list

    # Admin request (depends on your rules)
    res = client.get("/history", headers={"Authorization": f"Bearer {tokens['admin']}"})
    # Example: if admin not allowed
    assert res.status_code == 403


def test_post_books(client, tokens):
    new_book = {"title": "New Book", "unit_price": 25.5}

    # Unauthenticated
    res = client.post("/books", json=new_book)
    assert res.status_code == 401

    # Authenticated customer
    res = client.post("/books", json=new_book, headers={"Authorization": f"Bearer {tokens['customer']}"})
    assert res.status_code == 403

    # Authenticated admin
    res = client.post("/books", json=new_book, headers={"Authorization": f"Bearer {tokens['admin']}"})
    assert res.status_code == 201
    data = res.get_json()
    assert data["data"]["title"] == "New Book"
