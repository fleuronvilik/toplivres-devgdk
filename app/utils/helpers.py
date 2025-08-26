from flask import jsonify

def error_response(message, status_code: int = 400, field = None):
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
