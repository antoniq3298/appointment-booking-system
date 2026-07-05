```mermaid
erDiagram
  USERS ||--o{ BOOKINGS : makes
  SERVICES ||--o{ BOOKINGS : for
  EMPLOYEES ||--o{ SLOTS : offers
  EMPLOYEES ||--o{ BOOKINGS : assigned_to
  SLOTS ||--o| BOOKINGS : reserves

  USERS {
    int id PK
    string name
    string phone
    string email UK
    string password_hash
    string role  "client|admin"
    string reset_token_hash
    datetime reset_token_expires
    datetime created_at
  }

  SERVICES {
    int id PK
    string name
    int duration_minutes
    decimal price
    int is_active
  }

  EMPLOYEES {
    int id PK
    string name
    int is_active
  }

  SLOTS {
    int id PK
    int employee_id FK
    datetime start_datetime "UK with employee_id"
    datetime end_datetime
    int is_active
    datetime created_at
  }

  BOOKINGS {
    int id PK
    int user_id FK
    int service_id FK
    int employee_id FK
    int slot_id FK UK
    string note
    string status "booked|canceled"
    int reminder_sent
    datetime created_at
  }

  WORKING_SCHEDULE {
    int day_of_week PK "0=Sunday..6=Saturday, shared across employees"
    string start_time
    string end_time
    int interval_minutes
    int is_active
  }

  CLOSED_PERIODS {
    int id PK
    date start_date
    date end_date
    string reason
    datetime created_at
  }
```

Notes:
- A slot belongs to exactly one employee, so two employees can each have their own slot at the same `start_datetime` (concurrent availability). The unique constraint on `slots` is `(employee_id, start_datetime)`, not `start_datetime` alone.
- `bookings.employee_id` is copied from the slot at booking time so client/admin views don't need an extra join back through `slots` just to know who the appointment is with.
- `working_schedule` is one shared weekly template (not per employee); generating slots from it creates one slot per active employee at each scheduled time.
- `closed_periods` is checked by slot listing, manual/bulk slot generation, and booking creation, so a closed date is hidden and unbookable everywhere consistently.
