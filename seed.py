from app import create_app, db
from app.models import Book

def seed_data():
    app = create_app()
    with app.app_context():
        books = [
            Book(title="Clean Code", unit_price=29.99),
            Book(title="The Pragmatic Programmer", unit_price=34.50),
            Book(title="Fluent Python", unit_price=45.00),
            Book(title="Du Ghetto au Barreau", unit_price=20.00),
            Book(title="La mentalité des personnes exceptionnelles", unit_price=15.00),
            Book(title="Le chemin de la vie", unit_price=20.00),
            Book(title="L'art de l'intercession", unit_price=20.00),
            Book(title="Ils sont partis", unit_price=18.49)
        ]
        db.session.add_all(books)
        db.session.commit()
        print("Seed data inserted")

if __name__ == "__main__":
    seed_data()
