import marshmallow as mmlo
from marshmallow_sqlalchemy import SQLAlchemyAutoSchema, fields, auto_field
from .models import Book, Series, User

class BookSeriesSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = Series
        load_instance = True
        include_relationships = True
    
    name = auto_field()

class BookSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = Book
        load_instance = True
        include_relationships = True

    id = auto_field(dump_only=True)
    title = auto_field()
    unit_price = auto_field()
    series_id = auto_field()

    # Nested field to display related BookSeries info
    series = fields.Nested(BookSeriesSchema, only=("name",), dump_only=True)

class UserSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = User
        load_instance = True
        exclude = ("password_hash", "address", "role", "phone")

    id = auto_field(dump_only=True)
    name = auto_field()
    email = mmlo.fields.Email(required=True)
    password = mmlo.fields.String(required=True, load_only=True)

    