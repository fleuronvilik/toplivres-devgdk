from app import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import date


class BaseModel(db.Model):
    __abstract__ = True

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

class Series(BaseModel):
    __tablename__ = 'book_series'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.Text, unique=True, nullable=False)
    books = db.relationship('Book', backref='series', cascade='all, delete-orphan')

    __table_args__ = (
        db.UniqueConstraint('name', name='uq_book_series_name'),
    )

class Book(BaseModel):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(120), nullable=False)
    series_id = db.Column(
        db.Integer,
        db.ForeignKey('book_series.id', name='fk_book_series_id'),
        nullable=True
    )
    unit_price = db.Column(db.Float, nullable=False)

class User(BaseModel):
    __tablename__ = 'user'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(30), unique=True, nullable=False)
    email = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(10), default="customer", nullable=False)

    store_name = db.Column(db.String(30))
    address = db.Column(db.String(120))
    phone = db.Column(db.String(20))

    __table_args__ = (
        db.UniqueConstraint('name', name='uq_customer_name'),
        db.UniqueConstraint('email', name='uq_customer_email')
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Operation(db.Model):
    __tablename__ = "operation"

    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    op_type = db.Column(db.String(10), nullable=False, default="order")  # "order" or "sale"
    date = db.Column(db.Date, nullable=False, default=date.today)

    # relationships
    customer = db.relationship("User", backref="operations")
    items = db.relationship(
        "OperationItem",
        backref="operation",
        cascade="all, delete-orphan"
    )

    


class OperationItem(db.Model):
    __tablename__ = "operation_item"

    id = db.Column(db.Integer, primary_key=True)
    operation_id = db.Column(db.Integer, db.ForeignKey("operation.id"), nullable=False)
    book_id = db.Column(db.Integer, db.ForeignKey("book.id"), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)

    # relationships
    book = db.relationship("Book")
