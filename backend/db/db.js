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

    return db;
}

module.exports = { initDb, run, get, all };
