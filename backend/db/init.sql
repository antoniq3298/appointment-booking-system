PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
                                     id INTEGER PRIMARY KEY AUTOINCREMENT,
                                     name TEXT NOT NULL,
                                     phone TEXT,
                                     email TEXT NOT NULL UNIQUE,
                                     password_hash TEXT NOT NULL,
                                     role TEXT NOT NULL CHECK(role IN ('client','admin')),
    reset_token_hash TEXT,
    reset_token_expires TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

CREATE TABLE IF NOT EXISTS services (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        name TEXT NOT NULL,
                                        duration_minutes INTEGER NOT NULL CHECK(duration_minutes > 0),
    price REAL NOT NULL CHECK(price >= 0),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1))
    );

CREATE TABLE IF NOT EXISTS slots (
                                     id INTEGER PRIMARY KEY AUTOINCREMENT,
                                     start_datetime TEXT NOT NULL UNIQUE,
                                     end_datetime TEXT NOT NULL,
                                     is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

CREATE TABLE IF NOT EXISTS bookings (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        user_id INTEGER NOT NULL,
                                        service_id INTEGER NOT NULL,
                                        slot_id INTEGER NOT NULL,
                                        note TEXT,
                                        status TEXT NOT NULL CHECK(status IN ('booked','canceled')),
    reminder_sent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(service_id) REFERENCES services(id),
    FOREIGN KEY(slot_id) REFERENCES slots(id)
    );
CREATE UNIQUE INDEX IF NOT EXISTS ux_bookings_slot_booked
    ON bookings(slot_id)
    WHERE status = 'booked';

-- one row per weekday (0=Sunday..6=Saturday) describing the admin-configured working hours
CREATE TABLE IF NOT EXISTS working_schedule (
    day_of_week INTEGER PRIMARY KEY CHECK(day_of_week BETWEEN 0 AND 6),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    interval_minutes INTEGER NOT NULL CHECK(interval_minutes > 0),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1))
    );

INSERT INTO services (name, duration_minutes, price, is_active)
SELECT 'Manicure', 60, 50.00, 1
    WHERE NOT EXISTS (SELECT 1 FROM services WHERE name='Manicure');

INSERT INTO services (name, duration_minutes, price, is_active)
SELECT 'Gel Polish', 90, 70.00, 1
    WHERE NOT EXISTS (SELECT 1 FROM services WHERE name='Gel Polish');

INSERT INTO services (name, duration_minutes, price, is_active)
SELECT 'Pedicure', 60, 60.00, 1
    WHERE NOT EXISTS (SELECT 1 FROM services WHERE name='Pedicure');
