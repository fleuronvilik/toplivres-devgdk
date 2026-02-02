from app.models import User


def test_change_password_success(client, auth_headers):
    headers = auth_headers["customer"]
    res = client.put(
        "/api/users/password",
        json={"current_password": "custpass", "new_password": "newpass123"},
        headers=headers,
    )
    assert res.status_code == 200

    user = User.query.filter_by(email="cust@test.com").first()
    assert user is not None
    assert user.check_password("newpass123") is True


def test_change_password_wrong_current(client, auth_headers):
    headers = auth_headers["customer"]
    res = client.put(
        "/api/users/password",
        json={"current_password": "badpass", "new_password": "newpass123"},
        headers=headers,
    )
    assert res.status_code == 400


def test_change_password_same_as_current(client, auth_headers):
    headers = auth_headers["customer"]
    res = client.put(
        "/api/users/password",
        json={"current_password": "custpass", "new_password": "custpass"},
        headers=headers,
    )
    assert res.status_code == 400


def test_change_password_too_short(client, auth_headers):
    headers = auth_headers["customer"]
    res = client.put(
        "/api/users/password",
        json={"current_password": "custpass", "new_password": "short"},
        headers=headers,
    )
    assert res.status_code == 400


def test_change_password_missing_fields(client, auth_headers):
    headers = auth_headers["customer"]
    res = client.put(
        "/api/users/password",
        json={"current_password": ""},
        headers=headers,
    )
    assert res.status_code == 400
