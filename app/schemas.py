import marshmallow as mml

from app import db

from marshmallow_sqlalchemy import SQLAlchemyAutoSchema, fields, auto_field
#from marshmallow import fields, validates_schema, ValidationError
from app.models import Book, Series, User, Operation, OperationItem
from app.utils.helpers import get_inventory

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
        sqla_session = db.session
        exclude = ("password_hash", "address", "role", "phone")

    id = auto_field(dump_only=True)
    name = auto_field()
    email = mml.fields.Email(required=True)
    password = mml.fields.String(required=True, load_only=True)

class ItemSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = OperationItem
        include_fk = True
        load_instance = True
        sqla_session = db.session
        exclude = ("id", "operation_id")

    book_id = auto_field(required=True)
    quantity = auto_field(required=True)

    # @mml.validates_schema
    # def validate_items(self, data, **kwargs):
    #     if not len(data) > 0:
    #         raise mml.ValidationError("At least one item is required.", "items")

class OperationSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = Operation
        load_instance = True
        include_relationships = True
        sqla_session = db.session
        exclude = ("id", "customer")

    # Only needed on input (payload)
    items = mml.fields.List(
        mml.fields.Nested(ItemSchema),
        required=True,
        load_only=True
    )
    customer_id = auto_field(dump_only=True)
    # customer = mml.fields.Nested(UserSchema)

    # @mml.validates_schema
    # def validate_books_exist(self, data, **kwargs):
    #     items =  data.get("items", [])
    #     if not len(items) > 0:
    #         raise mml.ValidationError("At least one item is required.", "items")
    #     for item in items:
    #         if not Book.query.get(item.book_id):
    #             raise mml.ValidationError(f"No book with id {item.book_id} in catalog")

class BaseOperationSchema(OperationSchema):
    class Meta(OperationSchema.Meta):
        pass  # inherit model, fields, etc.

class DeliveryOperationSchema(BaseOperationSchema):
    @mml.validates_schema
    def validate_items_for_delivery(self, data, **kwargs):
        # only check structure + book existence
        items = data.get("items", [])
        if not items:
            raise mml.ValidationError("At least one item is required.", "items")
        for item in items:
            if not Book.query.get(item.book_id):
                raise mml.ValidationError(f"No book with id {item.book_id} in catalog", "items")

class SalesReportOperationSchema(BaseOperationSchema):
    def __init__(self, *args, **kwargs):
        self.user_id = kwargs.pop("user_id", None)   # pull it out manually
        super().__init__(*args, **kwargs)

    @mml.validates_schema
    def validate_items_for_sales(self, data, **kwargs):
        # check structure + book existence + inventory
        items = data.get("items", [])
        if not items:
            raise mml.ValidationError("At least one item is required.", "items")

        #user_id = self.context.get("user_id")  # pass user_id when loading
        inventory, errors = get_inventory(self.user_id), {}
        import pdb; pdb.set_trace()


        for item in items:
            # book_id = item.book_id #["book_id"]
            # if not Book.query.get(book_id):
            #     raise mml.ValidationError(f"No book with id {book_id} in catalog", "items")
            # if inventory.get(book_id, 0) < item.quantity:
            #     raise mml.ValidationError(
            #         f"Insufficient stock for book {book_id}", "items"
            #     )

            book_id = item.book_id
            qty = item.quantity

            if book_id not in inventory:
                errors.setdefault("items", []).append(
                    {"book_id": book_id, "error": "Not in your inventory"}
                )
            elif inventory[book_id] < qty:
                errors.setdefault("items", []).append(
                    {"book_id": book_id, "error": f"Insufficient stock (have {inventory[book_id]})"}
                )
            item.quantity = -qty
        
        if errors:
            raise mml.ValidationError(errors)


class OperationCancelSchema(mml.Schema):
    customer_id = mml.fields.Integer(load_only=True)
    op_date = mml.fields.Date(required=True, load_only=True)
    op_type = mml.fields.String(load_only=True)
