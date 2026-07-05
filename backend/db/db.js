const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

const DB_PATH = path.join(__dirname, "database.sqlite");
const INIT_SQL_PATH = path.join(__dirname, "init.sql");

function openDb() {
    return new sqlite3.Database(DB_PATH);
}
  // INSERT,UPDATE,DELETE
function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

// CREATE TABLE IF NOT EXISTS in init.sql only shapes brand-new databases;
// existing ones need columns added after the fact. Safe to call repeatedly.
async function ensureColumn(db, table, column, definition) {
    const cols = await all(db, `PRAGMA table_info(${table})`);
    if (!cols.some((c) => c.name === column)) {
        await run(db, `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}

// Databases created before the "employees" feature have a slots table with a plain
// UNIQUE(start_datetime) constraint and no employee_id column. SQLite can't ALTER a
// column into/out of an inline UNIQUE constraint, so this rebuilds the table instead.
// Existing slots/bookings are kept and attached to the first employee row (the seed data
// in init.sql guarantees one exists; a placeholder "Unassigned" employee is created otherwise).
// No-op on fresh databases, since init.sql already creates the final shape directly.
async function migrateEmployeeAwareSlots(db) {
    const slotCols = await all(db, "PRAGMA table_info(slots)");
    if (slotCols.some((c) => c.name === "employee_id")) return;

    let defaultEmployee = await get(db, "SELECT id FROM employees ORDER BY id ASC LIMIT 1");
    if (!defaultEmployee) {
        const r = await run(db, "INSERT INTO employees (name, is_active) VALUES ('Unassigned', 1)");
        defaultEmployee = { id: r.lastID };
    }

    await run(db, "PRAGMA foreign_keys = OFF");
    await run(
        db,
        `CREATE TABLE slots_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL REFERENCES employees(id),
            start_datetime TEXT NOT NULL,
            end_datetime TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(employee_id, start_datetime)
        )`
    );
    await run(
        db,
        `INSERT INTO slots_new (id, employee_id, start_datetime, end_datetime, is_active, created_at)
         SELECT id, ?, start_datetime, end_datetime, is_active, created_at FROM slots`,
        [defaultEmployee.id]
    );
    await run(db, "DROP TABLE slots");
    await run(db, "ALTER TABLE slots_new RENAME TO slots");
    await run(db, "PRAGMA foreign_keys = ON");

    await ensureColumn(db, "bookings", "employee_id", "INTEGER REFERENCES employees(id)");
    await run(
        db,
        `UPDATE bookings SET employee_id = (SELECT employee_id FROM slots WHERE slots.id = bookings.slot_id)
         WHERE employee_id IS NULL`
    );
}

async function initDb() {
    const db = openDb();
    const initSql = fs.readFileSync(INIT_SQL_PATH, "utf-8");
    await run(db, "PRAGMA foreign_keys = ON;");
    for (const stmt of initSql.split(";")) {
        const s = stmt.trim();
        if (!s) continue;
        await run(db, s + ";");
    }

    await ensureColumn(db, "bookings", "reminder_sent", "INTEGER NOT NULL DEFAULT 0");
    await ensureColumn(db, "users", "reset_token_hash", "TEXT");
    await ensureColumn(db, "users", "reset_token_expires", "TEXT");
    await migrateEmployeeAwareSlots(db);

    return db;
}

module.exports = { initDb, run, get, all };
