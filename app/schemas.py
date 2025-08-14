from marshmallow_sqlalchemy import SQLAlchemyAutoSchema, auto_field # from marshmallow import Schema, fields, validate
from .models import Book

class BookSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = Book

    id = auto_field(dump_only=True)
    title = auto_field()
    unit_price = auto_field()
    serie_id = auto_field()
