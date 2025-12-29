import marshmallow as ma

from app.extensions import db

from marshmallow_sqlalchemy import SQLAlchemyAutoSchema, fields, auto_field
#from marshmallow import fields, validates_schema, ValidationError
from app.models import Book, Series, User, Operation, OperationItem
from app.services.operations import get_inventory

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
    unit_price = auto_field(validate=ma.validate.Range(min=0.01))
    # series_id = auto_field()

    # Nested field to display related BookSeries info
    series = fields.Nested(BookSeriesSchema, only=("name",), dump_only=True)

class UserSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = User
        load_instance = True
        sqla_session = db.session
        exclude = ("password_hash", "address", "role", "phone")

    id = auto_field(dump_only=True)
    name = auto_field()
    email = ma.fields.Email(required=True)
    password = ma.fields.String(required=True, load_only=True)


class UserUpdateSchema(ma.Schema):
    """Validation for profile updates from the authenticated user.
    Only allows safe fields; all optional to support partial updates.
    """
    name = ma.fields.String(validate=ma.validate.Length(min=1, max=30))
    email = ma.fields.Email()
    store_name = ma.fields.String(validate=ma.validate.Length(max=30))
    address = ma.fields.String(validate=ma.validate.Length(max=120))
    phone = ma.fields.String(
        validate=ma.validate.And(
            ma.validate.Length(max=20),
            ma.validate.Regexp(r"^[0-9+(). \-]*$", error="Invalid phone format")
        )
    )

    @ma.validates_schema
    def ensure_non_empty(self, data, **kwargs):
        if not data:
            raise ma.ValidationError("No fields provided for update.")

class ItemSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = OperationItem
        include_fk = True
        load_instance = True
        sqla_session = db.session
        exclude = ("id", "operation_id")
        #include_relationship = True

    book_id = auto_field(required=True)
    quantity = auto_field(required=True)
    # book = ma.fields.Nested(BookSchema, only=("title",), dump_only=True)
    book = ma.fields.Function(lambda obj: obj.book.title if obj.book else None)

    # @ma.validates_schema
    # def validate_items(self, data, **kwargs):
    #     if not len(data) > 0:
    #         raise ma.ValidationError("At least one item is required.", "items")

class OperationSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = Operation
        load_instance = True
        include_relationships = True
        sqla_session = db.session
        # include_fk = True
        # exclude = ("customer",)

    # Only needed on input (payload)
    # items = ma.fields.List(
    #     ma.fields.Nested(ItemSchema),
    #     required=True,
    # )
    items = ma.fields.Nested(ItemSchema, many=True)
    customer = ma.fields.Nested(UserSchema, only=("id", "name")) #customer_id = auto_field(dump_only=True)


class BaseOperationSchema(OperationSchema):
    class Meta(OperationSchema.Meta):
        pass  # inherit model, fields, etc.


class DeliveryOperationSchema(BaseOperationSchema):
    @ma.validates_schema
    def validate_items_for_delivery(self, data, **kwargs):
        # only check structure + book existence
        items = data.get("items", [])
        if not items:
            raise ma.ValidationError("At least one item is required.", "items")
        for item in items:
            if not Book.query.get(item.book_id):
                raise ma.ValidationError(f"No book with id {item.book_id} in catalog", "items")

class SalesReportOperationSchema(BaseOperationSchema):
    def __init__(self, *args, **kwargs):
        self.user_id = kwargs.pop("user_id", None)   # pull it out manually
        super().__init__(*args, **kwargs)

    @ma.validates_schema
    def validate_items_for_sales(self, data, **kwargs):
        # check structure + book existence + inventory
        items = data.get("items", [])
        if not items:
            raise ma.ValidationError("At least one item is required.", "items")

        #user_id = self.context.get("user_id")  # pass user_id when loading
        inventory, errors = get_inventory(self.user_id), {}


        for item in items:
            book_id = item.book_id
            qty = item.quantity

            book = Book.query.get(book_id)

            if not book:
                errors.setdefault("items", []).append(f"No book with id {book_id} in the catalog")
            elif book_id not in inventory:
                errors.setdefault("items", []).append(f"{book.title} not in your inventory")
            elif inventory[book_id] < qty:
                errors.setdefault("items", []).append(f"Insufficient stock ({inventory[book_id]}x {book.title})")
            else:
                item.quantity = -qty
        if errors:
            raise ma.ValidationError(errors)


class OperationCancelSchema(ma.Schema):
    customer_id = ma.fields.Integer(load_only=True)
    op_date = ma.fields.Date(required=True, load_only=True)
