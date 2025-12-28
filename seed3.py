# seed.py

from app import create_app
from app.extensions import db
from app.models import User, Book, Operation, OperationItem
from werkzeug.security import generate_password_hash
from datetime import datetime, date

# Clear tables
# db.session.query(OperationItem).delete()
# db.session.query(Operation).delete()
# db.session.query(Book).delete()
# db.session.query(User).delete()
# db.session.commit()


def seed():
    app = create_app()
    with app.app_context():
        # clear tables first (for testing only, remove in prod!)
        db.drop_all()
        db.create_all()
        hp = generate_password_hash("trace")

        # --- Users ---
        admin = User(name="Admin", email="admin@toplivres.app", password_hash=hp, role="admin")
        alice = User(name="Alice", email="alice@example.com", password_hash=hp, role="customer")
        bob = User(name="Bob", email="bob@example.com", password_hash=hp, role="customer")

        db.session.add_all([admin, alice, bob])
        db.session.commit()

        # --- Books ---
        books = {
            "enfants": Book(title="Comment aider nos enfants à mieux réussir ?", unit_price=15.0),
            "barreau": Book(title="Du Ghetto au Barreau", unit_price=20.0),
            "mariage": Book(title="Tout le monde peut réussir son mariage", unit_price=15.0),
            "sommeil": Book(title="N'aime pas le sommeil", unit_price=15.0),
            "epargne": Book(title="Maîtriser l'art de l'épargne ", unit_price=15.0)
        }
        db.session.add_all(books.values())
        db.session.commit()

        # Helper to get book by title
        # book_map = {b.title: b for b in books}

        # --- Operations ---
        # Alice's timeline'
        op1 = Operation(type='order', status='delivered', customer=alice, date=date(2024, 6, 22)) # apôtres
        item1a = OperationItem(book=books["enfants"], quantity=5, operation=op1)
        item1b = OperationItem(book=books["mariage"], quantity=5, operation=op1)

        op2 = Operation(type='report', status='recorded', customer=alice, date=date(2024, 7, 14)) # france
        item2a = OperationItem(book=books["enfants"], quantity=-3, operation=op2)
        item2b = OperationItem(book=books["mariage"], quantity=-5, operation=op2)

        op3 = Operation(type='order', status='delivered', customer=alice, date=date(2024, 7, 28)) # stjeanne
        item3a = OperationItem(book=books["sommeil"], quantity=5, operation=op3)
        item3b = OperationItem(book=books["mariage"], quantity=5, operation=op3)

        # Bob's timeline
        op4 = Operation(type='order', status='delivered', customer=bob, date=date(2024, 10, 3)) # germany, stars
        item4a = OperationItem(book=books["barreau"], quantity=2, operation=op4)
        item4b = OperationItem(book=books["sommeil"], quantity=10, operation=op4)
        item4c = OperationItem(book=books["epargne"], quantity=3, operation=op4)

        op5 = Operation(type='report', status='recorded', customer=bob, date=date(2024, 12, 31)) # ndlt
        item5a = OperationItem(book=books["barreau"], quantity=-1, operation=op5)
        item5b = OperationItem(book=books["sommeil"], quantity=-6, operation=op5)

        # Add operations to session
        db.session.add_all([op1, op2, op3, op4, op5])
        db.session.commit()

        print("Seeding complete!")

if __name__ == "__main__":
    seed()
