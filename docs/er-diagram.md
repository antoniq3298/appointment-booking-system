```mermaid
erDiagram
  USERS ||--o{ BOOKINGS : makes
  SERVICES ||--o{ BOOKINGS : for
  SLOTS ||--o| BOOKINGS : reserves

  USERS {
    int id PK
    string name
    string phone
    string email UK
    string password_hash
    string role  "client|admin"
    datetime created_at
  }

  SERVICES {
    int id PK
    string name
    int duration_minutes
    decimal price
    int is_active
  }

  SLOTS {
    int id PK
    datetime start_datetime UK
    datetime end_datetime
    int is_active
    datetime created_at
  }

  BOOKINGS {
    int id PK
    int user_id FK
    int service_id FK
    int slot_id FK UK
    string note
    string status "booked|canceled"
    datetime created_at
  }
