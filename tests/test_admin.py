# tests/test_admin.py

def test_admin_delete_delivered_sets_cancelled(client, auth_headers):
    # Assume Bob already has operation id=1 in the seed with delivered order
    op_id = 1

    # Delete as customer should fail
    res = client.delete(f"/api/admin/operations/{op_id}", headers=auth_headers["bob"])
    assert res.status_code == 403

    # Delete as admin should cancel, not remove
    res = client.delete(f"/api/admin/operations/{op_id}", headers=auth_headers["admin"])
    assert res.status_code == 200
    data = res.get_json()
    assert data["id"] == op_id

    # Verify in DB it's still there, but cancelled
    from app.models import Operation
    op = Operation.query.get(op_id)
    assert op is not None
    assert op.type == 'order'
    assert op.status == "cancelled"
