from marshmallow import Schema, fields, validate

class BookSchema(Schema):
    id = fields.Integer(dump_only=True) # Only for output
    title = fields.String(
        required=True,
        validate=validate.Length(min=1, error="Title must not be empty")
    )
    unit_price = fields.Float(
        required=True,
        validate=validate.Range(min=0.01, error="Price must be greater than 0")
    )
