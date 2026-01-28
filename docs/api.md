# API документация

Base URL: http://localhost:3000/api  
Content-Type: application/json  
Auth: Authorization: Bearer <token>

## POST /auth/register
Request
{
"name": "Antonia",
"phone": "+359...",
"email": "a@b.com",
"password": "pass1234"
}

Response 201
{
"user": { "id": 1, "name": "Antonia", "email": "a@b.com", "role": "client" },
"token": "..."
}

Errors
- 409 EMAIL_EXISTS

## POST /auth/login
Request
{ "email": "a@b.com", "password": "pass1234" }

Response 200
{ "user": { "id": 1, "name": "Antonia", "email": "a@b.com", "role": "client" }, "token": "..." }

## POST /admin/bootstrap
Request
{ "name": "Admin", "email": "admin@mail.bg", "password": "admin123" }

Response 201
{ "user": { "id": 2, "name": "Admin", "email": "admin@mail.bg", "role": "admin" }, "token": "..." }

## GET /services
Response 200
[
{ "id": 1, "name": "Manicure", "duration_minutes": 60, "price": 50.0 }
]

## POST /services (admin)
Request
{ "name": "Gel Polish", "duration_minutes": 90, "price": 70.0 }

Response 201
{ "id": 4, "name": "Gel Polish", "duration_minutes": 90, "price": 70.0 }

## DELETE /services/:id (admin)
Response 200
{ "deleted": true }

## GET /slots?date=YYYY-MM-DD
Response 200
[
{ "id": 21, "start_datetime": "2026-01-12T10:00:00", "end_datetime": "2026-01-12T10:30:00" }
]

## POST /slots/generate (admin)
Request
{ "date": "2026-01-12", "from": "10:00", "to": "18:00", "intervalMinutes": 30 }

Response 200
{ "created": 16, "skipped": 0 }

## POST /bookings (client)
Request
{ "service_id": 1, "slot_id": 21, "note": "..." }

Response 201
{ "id": 101, "user_id": 1, "service_id": 1, "slot_id": 21, "status": "booked", "created_at": "..." }

Errors
- 409 SLOT_ALREADY_BOOKED

## GET /bookings/my (client)
Response 200
[
{ "id": 101, "status": "booked", "service_name": "Manicure", "start_datetime": "...", "end_datetime": "...", "created_at": "..." }
]

## GET /bookings (admin)
Response 200
[
{ "id": 101, "status": "booked", "client_name": "Antonia", "client_email": "a@b.com", "service_name": "Manicure", "start_datetime": "...", "end_datetime": "...", "created_at": "..." }
]

## PATCH /bookings/:id/cancel
Response 200
{ "canceled": true }
