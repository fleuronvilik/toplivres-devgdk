# 📚 Toplivres — Book Depot Tracker

Toplivres is a backend system that replaces a shared Google Sheets workflow used to manage
**book dépôt-vente (consignment sales)** between an administrator and multiple partner organizations.

It provides a structured alternative to spreadsheets for handling **delivery requests, sales reporting,
inventory tracking, and revenue sharing**, with clear separation between customer and admin responsibilities.

---

## What problem it solves

Without Toplivres, managing dépôt-vente requires:
- shared spreadsheets per partner
- manual tracking of deliveries and sales
- error-prone reporting
- implicit trust with little enforcement

Toplivres centralizes this workflow into a single system that:
- enforces business rules automatically
- prevents invalid states (duplicate orders, missing reports)
- gives each user a clear, isolated view of their data

---

## Core workflow

Toplivres models a **closed operational loop**:

1. A customer submits a **delivery request** (order)
2. An admin **approves or rejects** the request
3. Approved requests are marked as **delivered**
4. The customer submits a **sales report**
5. Only then can a new delivery request be made

This sequencing is enforced by the system.

---

## Roles and permissions

- **Customers**
  - request book deliveries
  - submit sales reports
  - view their inventory, history, and statistics
  - cannot bypass workflow rules

- **Admins**
  - manage the book catalog
  - approve, reject, cancel, and deliver orders
  - correct errors by deleting reports when necessary
  - have global visibility over operations

Roles are strictly separated (RBAC).

---

## Design principles

- Business rules are enforced at the backend level
- Only one active order is allowed per customer
- A delivery must be followed by a sales report
- The system favors consistency over convenience
- Simplicity and clarity over architectural purity

---

## Project status

Toplivres is a **learning-driven backend project** built from a real operational need.
It prioritizes correctness, clarity, and maintainability over feature breadth or trend adoption.

The project evolves slowly through small, deliberate improvements.
