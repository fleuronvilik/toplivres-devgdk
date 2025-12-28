import os
import uuid
import json
import logging
import time

from flask import Flask, send_from_directory, g, render_template, request
from flask_migrate import Migrate
from marshmallow import ValidationError
from dotenv import load_dotenv

from flask_jwt_extended import JWTManager, get_jwt_identity, jwt_required
from flask_cors import CORS
from flasgger import Swagger

from app.extensions import db
from app.utils.helpers import error_response

migrate = Migrate()
jwt = JWTManager()

template = {
    "swagger": "2.0",
    "info": {
        "title": "Toplivres API",
        "description": "API for managing books, orders, and sales",
        "version": "1.0.0"
    },
    "basePath": "/api",
    "schemes": ["http"],
    "tags": [
        {"name": "Customer", "description": "Customer-facing endpoints"},
        {"name": "Admin", "description": "Admin-only endpoints"}
    ],
    "definitions": {
        "Book": {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "title": {"type": "string"},
                "unit_price": {"type": "number", "format": "decimal"}
            },
            "required": ["title", "unit_price"]
        },
        "Customer": {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "name": {"type": "string"}
            },
            "required": ["id", "name"]
        },
        "OperationItemRequest": {
            "type": "object",
            "properties": {
                #"book": {"$ref": "#/definitions/Book"},
                "book_id": {"type": "integer"},
                "quantity": {"type": "integer"} # ,"unit_price_at_time": {"type": "number", "format": "float"}
            },
            "required": ["book_id", "quantity"] # , "unit_price_at_time"]
        },
        "OperationItemResponse": {
            "type": "object",
            "properties": {
                "book": {"type": "string"}, #{"$ref": "#/definitions/Book"},
                "book_id": {"type": "integer"},
                "quantity": {"type": "integer"} # ,"unit_price_at_time": {"type": "number", "format": "float"}
            },
            "required": ["book_id", "quantity"] # , "unit_price_at_time"]
        },
        "Operation": {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "type": {"type": "string", "enum": ["order","report"]},
                "status": {"type": "string", "enum": ["pending","delivered","cancelled","recorded"]},
                "date": {"type": "string", "format": "date-time"},
                "customer": {"$ref": "#/definitions/Customer"}, #"customer_id": {"type": "integer"},
                "items": {
                    "type": "array",
                    "items": {"$ref": "#/definitions/OperationItemResponse"}
                }
            },
            "required": ["id", "date", "customer"]
        }
    },
    "paths": {
        # Books
        "/books": {
            "get": {
                "summary": "Get list of books",
                #"tags": ["Admin"],
                "responses": {
                    200: {
                        "description": "List of books",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "data": {
                                    "type": "array",
                                    "items": {"$ref": "#/definitions/Book"}
                                }
                            }
                        }
                    }
                }
            },
            "post": {
                "summary": "Add a new book",
                "tags": ["Admin"],
                "parameters": [
                    {
                        "name": "body",
                        "in": "body",
                        "required": True,
                        "schema": {"$ref": "#/definitions/Book"}
                    }
                ],
                "responses": {
                    201: {"description": "Book created", "schema": {"$ref": "#/definitions/Book"}}
                }
            }
        },
        # Orders
        "/orders": {
            "get": {
                "summary": "Get customer orders",
                "tags": ["Customer"],
                "responses": {
                    200: {
                        "description": "List of operations",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "data": {
                                    "type": "array",
                                    "items": {"$ref": "#/definitions/Operation"}
                                }
                            }
                        }
                    }
                }
            },
            "post": {
                "summary": "Place a new order",
                "tags": ["Customer"],
                "parameters": [
                    {
                        "name": "body",
                        "in": "body",
                        "required": True,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "items": {
                                    "type": "array",
                                    "items": {"$ref": "#/definitions/OperationItemRequest"}
                                }
                            }
                        }
                    }
                ],
                "responses": {
                    201: {"description": "Order created", "schema": {"$ref": "#/definitions/Operation"}}
                }
            },
        },
        # Order cancellation
        "/orders/{id}": {
            "delete": {
                "summary": "Cancel pending order",
                "tags": ["Customer"],
                "parameters": [
                    {"name": "id", "in": "path", "type": "integer", "required": True, "description": "ID of the order to cancel"}
                ],
                "responses": {
                    204: {"description": "Order cancelled successfully"},
                    404: {
                        "description": "Order not found",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "errors": {
                                    "type": "object",
                                    "properties": {
                                        "order": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                            "example": ["not found"]
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        # Sales
        "/sales": {
            "get": {
                "summary": "Get customer sales reports",
                "tags": ["Customer"],
                "responses": {
                    200: {
                        "description": "List of operations",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "data": {
                                    "type": "array",
                                    "items": {"$ref": "#/definitions/Operation"}
                                }
                            }
                        }
                    }
                }
            },
            "post": {
                "summary": "Report a new sale",
                "tags": ["Customer"],
                "parameters": [
                    {
                        "name": "body",
                        "in": "body",
                        "required": True,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "items": {
                                    "type": "array",
                                    "items": {"$ref": "#/definitions/OperationItemRequest"}
                                }
                            }
                        }
                    }
                ],
                "responses": {
                    201: {"description": "Sale reported", "schema": {"$ref": "#/definitions/Operation"}}
                }
            }
        },
        # Admin operations
        "/admin/orders/{id}/confirm": {
            "put": {
                "summary": "Confirm a pending operation (admin only)",
                "tags": ["Admin"],
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "type": "integer",
                        "required": True,
                        "description": "ID of the pending order to confirm"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Operation confirmed",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "message": {"type": "string", "example": "Operation delivered"}
                            }
                        }
                    },
                    "403": {
                        "description": "Forbidden — user not admin or order not pending",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "errors": {"type": "object"}
                            }
                        }
                    },
                    "404": {
                        "description": "Operation not found",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "errors": {"type": "object"}
                            }
                        }
                    }
                }
            }
        },
        "/admin/operations/{id}": {
            "delete": {
                "summary": "Admin delete operation",
                "tags": ["Admin"],
                "parameters": [
                    {"name": "id", "in": "path", "type": "integer", "required": True}
                ],
                "responses": {
                    204: {
                        "description": "Operation deleted"
                    }
                }
            }
        },
        # Authentication
        "/auth/login": {
            "post": {
                "summary": "Customer authenticates with email and password",
                "consumes": ["application/json"],
                "produces": ["application/json"],
                "parameters": [
                    {
                        "name": "body",
                        "in": "body",
                        "required": True,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "email": {"type": "string"},
                                "password": {"type": "string"}
                            },
                            "required": ["email", "password"]
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "JWT access token",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "access_token": {"type": "string"}
                            }
                        }
                    },
                    "401": {"description": "Invalid credentials"}
                }
            }
        },
    },
    "securityDefinitions": {
        "BearerAuth": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
            "description": "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\""
        }
    },
    "security": [
        {
            "BearerAuth": []
        }
    ]
}



def register_error_handler(app):
    @app.errorhandler(ValidationError)
    def handle_marshmallow_error(err):
        """
        Normalize Marshmallow ValidationError into our unified format.
        """
        # err.messages can be a dict or a list depending on the schema
        normalized = normalize_marshmallow_messages(err.messages)
        return error_response(normalized, 400)

    @app.errorhandler(404)
    def handle_not_found(err):
        # Serve a friendly 404 page for unknown routes
        try:
            return render_template('404.html'), 404
        except Exception:
            return {"error": "Not found"}, 404

    
def normalize_marshmallow_messages(messages):
    """
    Convert marshmallow's err.messages into a predictable format:
      - Dict[str, list[str]] for field errors
      - Or Dict[str, list[dict]] if the schema provided structured messages
    """
    if isinstance(messages, dict):
        return messages  # Already field → list of messages
    if isinstance(messages, list):
        # If it's a bare list, wrap it under a generic key
        return {"_schema": messages}
    return {"_schema": [str(messages)]}

def log_event(event_name, **kwargs):
    data = {
        "correlation_id": str(g.correlation_id),
        "event": event_name,
        "user_id": get_jwt_identity() or "unknown",
        **kwargs
    }
    #logging.info(json.dumps(data))
    print(json.dumps(data))


def create_app(test_config=None):
    load_dotenv() # <- this loads .env automatically

    app = Flask(__name__)
    
    # Config from env vars
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///app.db")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
    app.config.update(
        JWT_TOKEN_LOCATION=["headers", "cookies"],  # accept both
        JWT_COOKIE_SECURE=os.getenv("FLASK_ENV") == "production" or os.getenv("APP_ENV") == "production",
        JWT_COOKIE_SAMESITE="Lax",
        JWT_COOKIE_CSRF_PROTECT=True,               # enables CSRF double-submit
        JWT_CSRF_IN_COOKIES=True,                  # store CSRF token in a cookie
    )

    if test_config:
        app.config.update(test_config)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    from .cli_seed import seed_command
    app.cli.add_command(seed_command)

    register_error_handler(app)

    @app.before_request
    def add_correlation_id():
        g.correlation_id = uuid.uuid4() 
        g.request_id = request.headers.get('X-Request-ID', str(uuid.uuid4()))
        g._t0 = time.time()

    @app.after_request
    @jwt_required(optional=True)
    def access_log(resp):
        from app.routes.main import current_user
        cu = current_user()
        t1 = time.time()
        duration = int((t1 - g._t0) * 1000)  # in ms
        data = {
            # "correlation_id": str(g.correlation_id),
            "request_id": g.request_id,
            # "remote_addr": request.remote_addr,
            "method": request.method,
            # "scheme": request.scheme,
            "path": request.path,
            "status": resp.status_code,
            "duration": duration,
            "user_agent": request.user_agent.string,
            "user_id": cu.id if cu else "anonymous"
        }
        # log_event("http.access", **data) # logging.info(json.dumps(data))
        return resp


    from app.routes.auth import auth_bp
    from app.routes.main import main_bp
    from app.routes.orders import order_bp
    from app.routes.sales import sales_bp
    from app.routes.admin import admin_bp
    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(order_bp)
    app.register_blueprint(sales_bp)
    app.register_blueprint(admin_bp)

    CORS(app, resources={
        r"/api/*": {
            "origins": [
                "http://127.0.0.1:8887",  # ok web server
                "http://localhost:3000",  # dev frontend
                "https://toplivres.app"   # production frontend
            ]
        }
    })

    swagger = Swagger(app, template=template)

    @app.route("/test")
    @jwt_required()
    def tester_page():
        log_event("test_event", detail="this is a test")
        return { "status": "ok" }

    return app
