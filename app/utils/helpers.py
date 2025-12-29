from flask import jsonify

def error_res(message, status_code: int = 400, field = None):
    """
    Normalize all errors into the same structure.
    Example:
    {
        "errors": {
            "items": [
                {"book_id": 3, "error": "Not in inventory"}
            ]
        }
    }
    """
        
    error_payload = {"errors": {}}

    if field:
        error_payload["errors"][field] = message if isinstance(message, list) else [message]
    else:
        error_payload["errors"] = message
    
    return jsonify(error_payload), status_code

def error_response(message, status_code: int = 400, field=None):
    payload = {"errors": {}}

    # If you passed a field explicitly, message can be str or list
    if field:
        payload["errors"][field] = message if isinstance(message, list) else [message]
        return jsonify(payload), status_code

    # If no field: accept dict (from Marshmallow), str, or list
    if isinstance(message, dict):
        # Ensure every value is a list (Marshmallow usually already does this)
        for k, v in message.items():
            payload["errors"][k] = v if isinstance(v, list) else [v]
    elif isinstance(message, list):
        payload["errors"]["general"] = message
    else:
        payload["errors"]["general"] = [message]

    return jsonify(payload), status_code

