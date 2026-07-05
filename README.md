
<img width="1316" height="832" alt="image" src="https://github.com/user-attachments/assets/d81744cf-a75d-406e-ac4c-a1a88641a512" />

# Appointment Booking System (Slot-Based) — Full-Stack Web App

A lightweight web-based appointment booking system for small service businesses.  
Clients book services into predefined time slots. Admin manages services, slots, and bookings.

## Features

### Client
- Register / Login
- Forgot / reset password (emailed link, 1h expiry)
- Edit profile (name, phone) and change password
- View active services
- Select a date and see available slots per employee
- Create booking (conflict-safe, per employee)
- Email + SMS booking confirmation, cancellation email, 24h-before SMS reminder
- View own bookings (with assigned employee)
- Cancel own booking (blocked within 12h of the appointment)

### Admin
- One-time admin bootstrap (demo)
- Add / disable services
- Add / disable employees
- Configure a shared weekly working schedule (hours per weekday)
- Configure closed dates / vacation periods (blocks booking + slot generation)
- Generate slots for a date + employee (work range + interval), or bulk-generate from the weekly schedule for every active employee
- View all bookings (with client, employee, service)
- Cancel or delete any booking

## Tech Stack
- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Node.js, Express (REST API)
- Database: SQLite
- Auth: JWT (Bearer token)
- Passwords: bcryptjs
  appointment-booking/
├── backend/
│ ├── package.json
│ ├── server.js
│ ├── .env.example
│ ├── services/
│ │ ├── mailer.js
│ │ └── sms.js
│ └── db/
│ ├── db.js
│ └── init.sql
├── frontend/
│ ├── index.html
│ ├── login.html
│ ├── register.html
│ ├── forgot-password.html
│ ├── reset-password.html
│ ├── profile.html
│ ├── booking.html
│ ├── admin.html
│ ├── css/
│ │ └── style.css
│ └── js/
│ ├── api.js
│ ├── auth.js
│ ├── profile.js
│ ├── booking.js
│ └── admin.js
├── docs/
│ ├── api.md
│ ├── er-diagram.md
│ └── use-cases.md
└── .gitignore


## Requirements
- Node.js (LTS recommended)
- npm

## Setup & Run (Windows / PowerShell)

1) Install dependencies
```powershell
cd backend
npm install
Start server
node server.js
Open in browser

App: http://localhost:3000

Health check: http://localhost:3000/api/health

Stop server: Ctrl + C
First-Time Demo Flow
1) Create admin (one-time)

Open: http://localhost:3000
Fill the “Admin bootstrap” form and create an admin user.

2) Admin actions

Open: http://localhost:3000/admin.html

Add a service

Generate slots (date + from/to + interval)

Refresh bookings list

3) Client actions

Open: http://localhost:3000/register.html

Register as client

Go to booking page

Select date, pick slot, reserve

Check “My bookings”

Cancel booking (optional)

Booking Rules & Data Integrity

A slot is offered only when:

slots.is_active = 1

there is no booking with status = 'booked' for that slot

Booking conflicts are prevented server-side:

if two clients try the same slot, the second request returns 409 SLOT_ALREADY_BOOKED

API (Quick Overview)

Base URL: http://localhost:3000/api
Auth header: Authorization: Bearer <token>

POST /auth/register

POST /auth/login

POST /auth/forgot-password

POST /auth/reset-password

POST /admin/bootstrap (demo)

GET /users/me · PATCH /users/me · POST /users/me/password

GET /services · POST /services (admin) · DELETE /services/:id (admin)

GET /employees · POST /employees (admin) · DELETE /employees/:id (admin)

GET /schedule (admin) · PUT /schedule/:day (admin)

GET /closed-periods (admin) · POST /closed-periods (admin) · DELETE /closed-periods/:id (admin)

GET /slots?date=YYYY-MM-DD

POST /slots (admin) · POST /slots/generate (admin) · POST /slots/generate-from-schedule (admin)

POST /bookings (client)

GET /bookings/my (client)

GET /bookings (admin)

PATCH /bookings/:id/cancel (client/admin) · DELETE /bookings/:id (admin)

Full documentation: docs/api.md

Database

SQLite file is created at:

backend/db/database.sqlite

Schema and seed data:

backend/db/init.sql

ER diagram (Mermaid):

docs/er-diagram.md

Use cases:

docs/use-cases.md

Screenshots Checklist (for thesis)

Create folder: docs/screenshots/ and capture:

01-home-bootstrap.png — Home + bootstrap admin

02-admin-services.png — Add/disable services

03-admin-generate-slots.png — Slot generation

04-register.png — Client registration

05-booking-available-slots.png — Date + available slots

06-booking-confirmation.png — Successful booking

07-admin-bookings.png — Admin bookings list

08-conflict-409.png — Conflict case (SLOT_ALREADY_BOOKED)

Notes on npm audit

npm audit can report vulnerabilities from transitive dependencies.
For this academic scope (local demo), stability is prioritized. Avoid npm audit fix --force during development unless you plan to re-test all dependencies.

## Project Structure
