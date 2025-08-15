from app import create_app, db
from app.models import Book, Series, User
from werkzeug.security import generate_password_hash

def seed():
    """Seed the database with initial data."""

    app = create_app()
    with app.app_context():
        db.drop_all()
        db.create_all()
        # Create series
        bien_penser = Series(name="Bien penser pour mieux réussir") # , status="ongoing")
        prier_puissance = Series(name="Prier avec puissance") # , status="completed")
        db.session.add_all([bien_penser, prier_puissance])
        db.session.commit()

        # Create books (must have series first)
        b1 = Book(title="La perception divine", unit_price=17.23, series=bien_penser)
        b2 = Book(title="L'art de l'intercession", unit_price=17.45, series=prier_puissance)
        b3 = Book(title="Du Ghetto au Barreau", unit_price=20.29)
        b4 = Book(title="Comment aider nos enfants à mieux réussir", unit_price=20.33, series=bien_penser)
        b5 = Book(title="Racines et Destinées", unit_price=11.76)

        db.session.add_all([b1, b2, b3, b4, b5])

        # Create customers
        c1 = User(
            name="Jeanne Nolan",
            email="jeanne@example.com",
            password_hash=generate_password_hash("t8re1t"),
            address="123 Main St"
        )
        c2 = User(
            name="Books",
            email="contact@booksunltd.com",
            password_hash=generate_password_hash("3r51t5"),
            address="456 Market Rd"
        )
        db.session.add_all([c1, c2])

        # Create one admin
        me = User(
            name="_devgdk",
            email="gdk@jeunesprodiges.net",
            password_hash=generate_password_hash("r5138"),
            role="admin"
        )
        db.session.add(me)

        db.session.commit()
        print("Database seeded")

if __name__ == "__main__":
    seed()
