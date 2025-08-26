import os
from flask import Flask
from flask_migrate import Migrate
from marshmallow import ValidationError
from dotenv import load_dotenv

from flask_jwt_extended import JWTManager

from app.extensions import db
from app.utils.helpers import error_response

migrate = Migrate()
jwt = JWTManager()

def register_error_handler(app):
    @app.errorhandler(ValidationError)
    def handle_marshmallow_error(err):
        """
        Normalize Marshmallow ValidationError into our unified format.
        """
        # err.messages can be a dict or a list depending on the schema
        normalized = normalize_marshmallow_messages(err.messages)
        return error_response(normalized, 400)

    
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


def create_app(test_config=None):
    load_dotenv() # <- this loads .env automatically

    app = Flask(__name__)
    
    # Config from env vars
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///app.db")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")

    if test_config:
        app.config.update(test_config)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    register_error_handler(app)

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

    return app