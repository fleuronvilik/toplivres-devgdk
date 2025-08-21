from app import db, create_app
from app.models import User, Book, Series, Operation, OperationItem
from werkzeug.security import generate_password_hash
from datetime import date

hp = generate_password_hash("trace")

def seed():
    app = create_app()
    with app.app_context():
        # clear tables first (for testing only, remove in prod!)
        db.drop_all()
        db.create_all()

        # --- Series ---
        bien_penser = Series(name="Bien penser pour mieux réussir")
        prier = Series(name="Prier avec puissance")
        db.session.add_all([bien_penser, prier])
        db.session.commit()

        # --- Books ---
        enfants = Book(title="Comment aider nos enfants à réussir", unit_price=10.99, series=bien_penser)
        barreau = Book(title="Du Ghetto au Barreau", unit_price=15.99)
        mariage = Book(title="Tout le monde peut réussir son mariage", unit_price=12.50)
        sommeil = Book(title="N'aime pas le sommeil", unit_price=12.90)
        epargne = Book(title="Maitriser l'art de l'épargne", unit_price=15)
        db.session.add_all([enfants, barreau, mariage, sommeil, epargne])
        db.session.commit()

        # --- Users ---
        alice = User(name="Alice", email="alice@example.com", password_hash=hp, role="customer")
        bob = User(name="Bob", email="bob@example.com", password_hash=hp, role="customer")
        admin = User(name="Admin", email="admin@example.com", password_hash=hp, role="admin")
        db.session.add_all([alice, bob, admin])
        db.session.commit()

        # --- Operations ---
        # Alice's timeline
        o1 = Operation(customer=alice, op_type="delivered", date=date(2024, 6, 22)) # apôtres
        db.session.add_all([
            OperationItem(operation=o1, book=enfants, quantity=5),
            OperationItem(operation=o1, book=mariage, quantity=5),
        ])
        s1 = Operation(customer=alice, op_type="is_report", date=date(2024, 7, 14)) # france
        db.session.add_all([
            OperationItem(operation=s1, book=enfants, quantity=-3),
            OperationItem(operation=s1, book=mariage, quantity=-5),
        ])
        o2 = Operation(customer=alice, op_type="delivered", date=date(2024, 7, 28)) # stjeanne
        db.session.add_all([
            OperationItem(operation=o1, book=sommeil, quantity=5),
            OperationItem(operation=o1, book=mariage, quantity=5),
        ])
        db.session.add_all([o1, s1, o2])
        db.session.commit()

        # Bob submits a is_reports report
        o3 = Operation(customer=bob, op_type="delivered", date=date(2024, 10, 3)) # deutschland, rentrée stars
        db.session.add_all([
            OperationItem(operation=o3, book=barreau, quantity=2),
            OperationItem(operation=o3, book=sommeil, quantity=10),
            OperationItem(operation=o3, book=epargne, quantity=3)
        ])

        
        s2 = Operation(customer=bob, op_type="is_report", date=date(2024, 12, 31)) # ndlt
        db.session.add_all([
            OperationItem(operation=s2, book=barreau, quantity=-1),
            OperationItem(operation=s2, book=sommeil, quantity=-6)
        ])
        db.session.add(o3)
        db.session.add(s2)
        db.session.commit()

        print("✅ Database seeded: alice is ICC Berlin and Bob ICC Bremen")

if __name__ == "__main__":
    seed()
