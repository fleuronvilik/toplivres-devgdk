<!--
Now flask_jwt_extend setup is ready from installation to testing meaning phase 2 step 1 is completed. Phase is such a recurring word with all the breakdown. In the build order, people can sign up and login(1), but the auth routes are POST /auth/signup and POST /auth/login. As of step 2, protected book catalog, I've decided to let the catalogue publicly accessible, no JWT requirements to GET /books and GET /books/<id>. Instead the requirement is added for POST /books which return {error: "admin only"} 403 forbidden for customers trying to add books, but let admin do their thing.

To achieve this goals, I had to agree with your take. For this MVP learning mode, no extra complexityy needed. Option 1, single table inheritance was the choice instead with its pro and cons. The alternative was separated tables and share authentication logic.

Based on this review, I want you to start an outline of a README explaining architecture, tools and decisions made so far, how I've use AI to power my learning. And remember, we are reframing an excel tracker as a backend system.

-->

# 📚 Book Depot Tracker  
_A backend system reframing an Excel-based book dépôt-vente tracker into a fully functional web API._

## 1️⃣ Overview  
This project transforms an **Excel tracker** used for managing book dépôt-vente sales into a **backend application** powered by Flask, SQLAlchemy, and JWT-based authentication.  

The goal is **not only to build an MVP** but to use it as a **learning vehicle** for backend architecture, database design, and secure API development — guided and accelerated with AI assistance.  

---

## 2️⃣ Architecture  
### Core Stack  
- **Flask** — minimal Python web framework for routing and request handling.  
- **Flask-SQLAlchemy** — ORM for database modeling and queries.  
- **Flask-Migrate (Alembic)** — database migrations.  
- **Marshmallow + marshmallow-sqlalchemy** — schema-based serialization and validation.  
- **Flask-JWT-Extended** — JSON Web Token authentication and authorization.  

### Layered Design  
- **Models** (`models.py`) — ORM classes defining tables, relationships, and constraints.  
- **Schemas** (`schemas.py`) — Data serialization (Python → JSON) and deserialization (JSON → Python) with validation rules.  
- **Routes / Blueprints** (`routes.py`, `auth.py`) — HTTP endpoints organized by functionality.  
- **Seed Data** (`seed.py`) — Script to populate dev environment with sample data.  
- **Migrations** (`migrations/`) — Version-controlled DB schema evolution.

---

## 3️⃣ Tools & Environment  
- **Python 3.10+**  
- **pipenv / venv** for virtual environments.  
- **SQLite** for local development (switchable to Postgres in prod).  
- **Flask CLI** (`flask db migrate`, `flask db upgrade`) for DB changes.  
- **Postman / curl** for API testing.  

---

## 4️⃣ Key Design Decisions  
1. **From Excel to Backend** — Treat every sheet and column as entities and relationships in a relational database.  
2. **Single Table Inheritance for Users** — One `User` table with a `role` field (`admin`, `customer`) instead of separate `Admin` and `Customer` tables. Keeps MVP simple while enabling role-based permissions.  
3. **Public Catalog, Protected Mutations** —  
   - `GET /books` and `GET /books/<id>` → public  
   - `POST /books` → admin-only (JWT + role check)  
4. **Data Validation** — Marshmallow ensures required fields and type safety (e.g., `Email()` for user email).  
5. **Seed-first Dev Flow** — Always start from an empty DB and populate via migration + seed scripts.  

---

## 5️⃣ Authentication Flow  
- **Signup** (`POST /auth/signup`) — validates input, hashes password, stores new user.  
- **Login** (`POST /auth/login`) — verifies credentials, issues JWT with `id` and `role`.  
- **Protected Routes** — Require valid JWT in `Authorization: Bearer <token>` header, with role checks for admin-only actions.  

---

## 6️⃣ How AI Powered My Learning  
Instead of following a static tutorial, AI guided decisions and explained concepts step-by-step:  
- Broke down the **MVP into phases** (auth → catalog → orders → reporting).  
- Clarified **trade-offs** (single table vs multi-table inheritance).  
- Helped debug **JWT errors**, migration issues, and Marshmallow validation quirks.  
- Suggested **incremental refactoring** to keep the code clean while learning.  

---

## 7️⃣ Current Endpoints (Phase 2 Progress)  
**Auth**  
- `POST /auth/signup` — create new account (admin or customer)  
- `POST /auth/login` — returns JWT  

**Books**  
- `GET /books` — list all books  
- `GET /books/<id>` — get details of a book  
- `POST /books` — create a new book (**admin only**)  
