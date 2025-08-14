from app import db

class BaseModel(db.Model):
    __abstract__ = True

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

class Series(BaseModel):
    __tablename__ = 'book_series'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.Text, nullable=False)
    books = db.relationship('Book', backref='series', cascade='all, delete-orphan')

    __table_args__ = (
        db.UniqueConstraint('name', name='uq_book_series_name'),
    )


class Book(BaseModel):
    __tablename__ = 'book' # not neccessary

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(120), nullable=False)
    serie_id = db.Column(
        db.Integer,
        db.ForeignKey('book_series.id', name='fk_book_series_id'),
        nullable=True
    )
    unit_price = db.Column(db.Float, nullable=False)
