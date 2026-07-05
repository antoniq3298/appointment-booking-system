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

## POST /auth/forgot-password
Request
{ "email": "a@b.com" }

Response 200 (always, whether or not the email exists)
{ "ok": true }

Sends an email with a reset link (`/reset-password.html?token=...`) if the email is registered. The token is valid for 1 hour and single-use.

## POST /auth/reset-password
Request
{ "token": "...", "password": "newpass123" }

Response 200
{ "ok": true }

Errors
- 400 INVALID_OR_EXPIRED_TOKEN

## POST /admin/bootstrap
Request
{ "name": "Admin", "email": "admin@mail.bg", "password": "admin123" }

Response 201
{ "user": { "id": 2, "name": "Admin", "email": "admin@mail.bg", "role": "admin" }, "token": "..." }

## GET /users/me
Response 200
{ "id": 1, "name": "Antonia", "phone": "+359...", "email": "a@b.com", "role": "client" }

## PATCH /users/me
Request
{ "name": "Antonia Ivanova", "phone": "+359..." }

Response 200
{ "id": 1, "name": "Antonia Ivanova", "phone": "+359...", "email": "a@b.com", "role": "client" }

## POST /users/me/password
Request
{ "current_password": "pass1234", "new_password": "newpass123" }

Response 200
{ "ok": true }

Errors
- 401 BAD_CREDENTIALS

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

## GET /employees
Response 200
[
{ "id": 1, "name": "Dr. Smith" }
]

## POST /employees (admin)
Request
{ "name": "Dr. Jones" }

Response 201
{ "id": 2, "name": "Dr. Jones" }

## DELETE /employees/:id (admin)
Soft-disables the employee (existing slots/bookings are kept).

Response 200
{ "deleted": true }

## GET /schedule (admin)
One shared weekly template, applied to every active employee when generating slots.

Response 200
[
{ "day_of_week": 1, "start_time": "09:00", "end_time": "17:00", "interval_minutes": 30, "is_active": 1 }
]

## PUT /schedule/:day (admin)
`:day` is 0 (Sunday) .. 6 (Saturday).

Request
{ "start_time": "09:00", "end_time": "17:00", "interval_minutes": 30, "is_active": true }

Response 200
{ "day_of_week": 1, "start_time": "09:00", "end_time": "17:00", "interval_minutes": 30, "is_active": 1 }

## GET /closed-periods (admin)
Response 200
[
{ "id": 1, "start_date": "2026-12-24", "end_date": "2026-12-26", "reason": "Christmas break" }
]

## POST /closed-periods (admin)
Request
{ "start_date": "2026-12-24", "end_date": "2026-12-26", "reason": "Christmas break" }

Response 201
{ "id": 1, "start_date": "2026-12-24", "end_date": "2026-12-26", "reason": "Christmas break" }

Dates inside a closed period are hidden from `GET /slots`, rejected by slot generation, and rejected by booking creation.

## DELETE /closed-periods/:id (admin)
Response 200
{ "deleted": true }

## GET /slots?date=YYYY-MM-DD
Response 200
[
{ "id": 21, "employee_id": 1, "employee_name": "Dr. Smith", "start_datetime": "2026-01-12T10:00:00", "end_datetime": "2026-01-12T10:30:00" }
]

Returns `[]` if the date falls inside a closed period. Each employee's availability is a separate slot, so the same time can appear once per employee.

## POST /slots (admin)
Request
{ "employee_id": 1, "start_datetime": "2026-01-12T10:00:00", "end_datetime": "2026-01-12T10:30:00" }

Response 201
{ "id": 21, "employee_id": 1, "start_datetime": "2026-01-12T10:00:00", "end_datetime": "2026-01-12T10:30:00" }

Errors
- 400 DATE_CLOSED
- 409 SLOT_EXISTS (same employee already has a slot at that start time)

## POST /slots/generate (admin)
Request
{ "employee_id": 1, "date": "2026-01-12", "from": "10:00", "to": "18:00", "intervalMinutes": 30 }

Response 200
{ "created": 16, "skipped": 0 }

Errors
- 400 DATE_CLOSED

## POST /slots/generate-from-schedule (admin)
Generates slots for the next N days from the shared weekly schedule - one slot per active employee per scheduled time. Days inside a closed period are skipped.

Request
{ "days": 14 }

Response 200
{ "created": 96, "skipped": 4 }

## POST /bookings (client)
Request
{ "service_id": 1, "slot_id": 21, "note": "..." }

Response 201
{ "id": 101, "user_id": 1, "service_id": 1, "employee_id": 1, "slot_id": 21, "status": "booked", "created_at": "..." }

Sends a confirmation email and SMS (or logs them to the console if SMTP/Twilio aren't configured).

Errors
- 400 DATE_CLOSED
- 409 SLOT_ALREADY_BOOKED

## GET /bookings/my (client)
Response 200
[
{ "id": 101, "status": "booked", "service_name": "Manicure", "employee_name": "Dr. Smith", "start_datetime": "...", "end_datetime": "...", "created_at": "..." }
]

## GET /bookings (admin)
Response 200
[
{ "id": 101, "status": "booked", "client_name": "Antonia", "client_email": "a@b.com", "client_phone": "+359...", "service_name": "Manicure", "employee_name": "Dr. Smith", "start_datetime": "...", "end_datetime": "...", "created_at": "..." }
]

## PATCH /bookings/:id/cancel
Sends a cancellation email. Clients are blocked within 12 hours of the appointment; admins can always cancel.

Response 200
{ "canceled": true }

Errors
- 400 CANCEL_NOT_ALLOWED_WITHIN_12H

## DELETE /bookings/:id (admin)
Only allowed once a booking is canceled or its slot's end time has passed.

Response 200
{ "deleted": true }

Errors
- 400 ONLY_CANCELED_OR_COMPLETED_CAN_BE_DELETED
