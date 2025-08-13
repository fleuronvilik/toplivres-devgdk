import json
import pytest
from app import create_app, db

@pytest.fixture
def client():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"
    })
    
    #app.config[] = True
    #app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    
    with app.app_context():
        db.create_all()
    yield app.test_client()
    with app.app_context():
        db.drop_all()

def test_add_book(client):
    response = client.post(
        "/books",
        data=json.dumps({
            "title": "N'aime pas le sommeil",
            "unit_price": 15
        }),
        content_type="application/json"
    )
    assert response.status_code == 201
    assert b"Book added successfully" in response.data
    