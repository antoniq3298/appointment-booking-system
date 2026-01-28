const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

const DB_PATH = path.join(__dirname, "database.sqlite");
const INIT_SQL_PATH = path.join(__dirname, "init.sql");

function openDb() {
    return new sqlite3.Database(DB_PATH);
}

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

async function initDb() {
    const db = openDb();
    const initSql = fs.readFileSync(INIT_SQL_PATH, "utf-8");
    await run(db, "PRAGMA foreign_keys = ON;");
    for (const stmt of initSql.split(";")) {
        const s = stmt.trim();
        if (!s) continue;
        await run(db, s + ";");
    }
    return db;
}

module.exports = { initDb, run, get, all };
