PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
                                     id INTEGER PRIMARY KEY AUTOINCREMENT,
                                     name TEXT NOT NULL,
                                     phone TEXT,
                                     email TEXT NOT NULL UNIQUE,
                                     password_hash TEXT NOT NULL,
                                     role TEXT NOT NULL CHECK(role IN ('client','admin')),
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
                                        slot_id INTEGER NOT NULL UNIQUE,
                                        note TEXT,
                                        status TEXT NOT NULL CHECK(status IN ('booked','canceled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(service_id) REFERENCES services(id),
    FOREIGN KEY(slot_id) REFERENCES slots(id)
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
