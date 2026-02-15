const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { initDb, run, get, all } = require("./db/db");

const PORT = 3000;
const JWT_SECRET = "dev_secret_change_later";

const app = express();
app.use(cors());
app.use(express.json());

// serve frontend
app.use("/", express.static(path.join(__dirname, "..", "frontend")));

let db;

function signToken(user) {
    return jwt.sign(
        { id: user.id, role: user.role, email: user.email },
        JWT_SECRET,
        { expiresIn: "7d" }
    );
}

function authRequired(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ error: "NO_TOKEN" });

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: "INVALID_TOKEN" });
    }
}

function adminOnly(req, res, next) {
    if (req.user?.role !== "admin") return res.status(403).json({ error: "FORBIDDEN" });
    next();
}

app.get("/api/health", (req, res) => res.json({ ok: true }));

// AUTH
app.post("/api/auth/register", async (req, res) => {
    const { name, phone, email, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: "INVALID_INPUT" });

    const exists = await get(db, "SELECT id FROM users WHERE email = ?", [email]);
    if (exists) return res.status(409).json({ error: "EMAIL_EXISTS" });

    const password_hash = await bcrypt.hash(password, 10);
    const role = "client";

    const r = await run(
        db,
        "INSERT INTO users (name, phone, email, password_hash, role) VALUES (?,?,?,?,?)",
        [name, phone || "", email, password_hash, role]
    );

    const user = await get(db, "SELECT id, name, email, role FROM users WHERE id = ?", [r.lastID]);
    const token = signToken(user);
    res.status(201).json({ user, token });
});

app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "INVALID_INPUT" });

    const userRow = await get(db, "SELECT * FROM users WHERE email = ?", [email]);
    if (!userRow) return res.status(401).json({ error: "BAD_CREDENTIALS" });

    const ok = await bcrypt.compare(password, userRow.password_hash);
    if (!ok) return res.status(401).json({ error: "BAD_CREDENTIALS" });

    const user = { id: userRow.id, name: userRow.name, email: userRow.email, role: userRow.role };
    const token = signToken(user);
    res.json({ user, token });
});

// ADMIN bootstrap endpoint: create admin once
app.post("/api/admin/bootstrap", async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: "INVALID_INPUT" });

    const exists = await get(db, "SELECT id FROM users WHERE email = ?", [email]);
    if (exists) return res.status(409).json({ error: "EMAIL_EXISTS" });

    const password_hash = await bcrypt.hash(password, 10);
    const role = "admin";

    const r = await run(
        db,
        "INSERT INTO users (name, phone, email, password_hash, role) VALUES (?,?,?,?,?)",
        [name, "", email, password_hash, role]
    );

    const user = await get(db, "SELECT id, name, email, role FROM users WHERE id = ?", [r.lastID]);
    const token = signToken(user);
    res.status(201).json({ user, token });
});

// SERVICES
app.get("/api/services", async (req, res) => {
    const rows = await all(db, "SELECT id, name, duration_minutes, price FROM services WHERE is_active = 1 ORDER BY id DESC");
    res.json(rows);
});

app.post("/api/services", authRequired, adminOnly, async (req, res) => {
    const { name, duration_minutes, price } = req.body || {};
    if (!name || !duration_minutes || price === undefined) return res.status(400).json({ error: "INVALID_INPUT" });

    const r = await run(
        db,
        "INSERT INTO services (name, duration_minutes, price, is_active) VALUES (?,?,?,1)",
        [name, duration_minutes, price]
    );

    const row = await get(db, "SELECT id, name, duration_minutes, price FROM services WHERE id = ?", [r.lastID]);
    res.status(201).json(row);
});

app.delete("/api/services/:id", authRequired, adminOnly, async (req, res) => {
    const id = Number(req.params.id);
    await run(db, "UPDATE services SET is_active = 0 WHERE id = ?", [id]);
    res.json({ deleted: true });
});

// SLOTS
app.get("/api/slots", async (req, res) => {
    const date = (req.query.date || "").trim(); // YYYY-MM-DD
    if (!date) return res.status(400).json({ error: "DATE_REQUIRED" });

    const rows = await all(
        db,
        `
    SELECT s.id, s.start_datetime, s.end_datetime
    FROM slots s
    LEFT JOIN bookings b ON b.slot_id = s.id AND b.status = 'booked'
    WHERE s.is_active = 1
      AND date(s.start_datetime) = date(?)
      AND datetime(s.start_datetime) > datetime('now')
      AND b.id IS NULL
    ORDER BY s.start_datetime ASC
    `,
        [date]
    );

    const nowMs = Date.now();
    const filtered = rows.filter(s => new Date(s.start_datetime + "Z").getTime() > nowMs);
    res.json(filtered);

});

app.post("/api/slots", authRequired, adminOnly, async (req, res) => {
    const { start_datetime, end_datetime } = req.body || {};
    if (!start_datetime || !end_datetime) return res.status(400).json({ error: "INVALID_INPUT" });

    try {
        const r = await run(
            db,
            "INSERT INTO slots (start_datetime, end_datetime, is_active) VALUES (?,?,1)",
            [start_datetime, end_datetime]
        );
        const row = await get(db, "SELECT id, start_datetime, end_datetime FROM slots WHERE id = ?", [r.lastID]);
        res.status(201).json(row);
    } catch (e) {
        if (String(e.message || "").includes("UNIQUE")) return res.status(409).json({ error: "SLOT_EXISTS" });
        res.status(500).json({ error: "SERVER_ERROR" });
    }
});

app.post("/api/slots/generate", authRequired, adminOnly, async (req, res) => {
    const { date, from, to, intervalMinutes } = req.body || {};
    if (!date || !from || !to || !intervalMinutes) return res.status(400).json({ error: "INVALID_INPUT" });

    const start = new Date(`${date}T${from}:00`);
    const end = new Date(`${date}T${to}:00`);
    const step = Number(intervalMinutes) * 60 * 1000;

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || step <= 0) {
        return res.status(400).json({ error: "INVALID_TIME" });
    }

    let created = 0;
    let skipped = 0;

    for (let t = start.getTime(); t + step <= end.getTime(); t += step) {
        const a = new Date(t);
        const b = new Date(t + step);

        const start_datetime = a.toISOString().slice(0, 19);
        const end_datetime = b.toISOString().slice(0, 19);

        try {
            await run(db, "INSERT INTO slots (start_datetime, end_datetime, is_active) VALUES (?,?,1)", [
                start_datetime,
                end_datetime
            ]);
            created++;
        } catch (e) {
            skipped++;
        }
    }

    res.json({ created, skipped });
});

app.delete("/api/slots/:id", authRequired, adminOnly, async (req, res) => {
    const id = Number(req.params.id);
    await run(db, "UPDATE slots SET is_active = 0 WHERE id = ?", [id]);
    res.json({ deleted: true });
});

// BOOKINGS
app.post("/api/bookings", authRequired, async (req, res) => {
    const { service_id, slot_id, note } = req.body || {};
    if (!service_id || !slot_id) return res.status(400).json({ error: "INVALID_INPUT" });

    // slot must be active
    const slot = await get(db, "SELECT id, start_datetime FROM slots WHERE id = ? AND is_active = 1", [slot_id]);
    if (!slot) return res.status(404).json({ error: "SLOT_NOT_FOUND" });
    const startMs = new Date(slot.start_datetime + "Z").getTime();
    if (startMs <= Date.now()) return res.status(400).json({ error: "SLOT_IN_PAST" });

    // service must be active
    const svc = await get(db, "SELECT id FROM services WHERE id = ? AND is_active = 1", [service_id]);
    if (!svc) return res.status(404).json({ error: "SERVICE_NOT_FOUND" });

    try {
        const r = await run(
            db,
            "INSERT INTO bookings (user_id, service_id, slot_id, note, status) VALUES (?,?,?,?, 'booked')",
            [req.user.id, service_id, slot_id, note || ""]
        );

        const row = await get(
            db,
            "SELECT id, user_id, service_id, slot_id, status, created_at FROM bookings WHERE id = ?",
            [r.lastID]
        );
        res.status(201).json(row);
    } catch (e) {
        if (String(e.message || "").includes("UNIQUE")) return res.status(409).json({ error: "SLOT_ALREADY_BOOKED" });
        res.status(500).json({ error: "SERVER_ERROR" });
    }
});

app.get("/api/bookings/my", authRequired, async (req, res) => {
    const rows = await all(
        db,
        `
    SELECT b.id, b.status, b.created_at,
           s.name AS service_name,
           sl.start_datetime, sl.end_datetime
    FROM bookings b
    JOIN services s ON s.id = b.service_id
    JOIN slots sl ON sl.id = b.slot_id
    WHERE b.user_id = ?
    ORDER BY sl.start_datetime DESC
    `,
        [req.user.id]
    );
    res.json(rows);
});

app.get("/api/bookings", authRequired, adminOnly, async (req, res) => {
    const rows = await all(
        db,
        `
    SELECT b.id, b.status, b.created_at,
           u.name AS client_name, u.email AS client_email,
           u.phone AS client_phone,
           s.name AS service_name,
           sl.start_datetime, sl.end_datetime
    FROM bookings b
    JOIN users u ON u.id = b.user_id
    JOIN services s ON s.id = b.service_id
    JOIN slots sl ON sl.id = b.slot_id
    ORDER BY sl.start_datetime DESC
    `
    );
    res.json(rows);
});

app.patch("/api/bookings/:id/cancel", authRequired, async (req, res) => {
    const id = Number(req.params.id);

    const row = await get(
        db,
        `
        SELECT b.id, b.user_id, sl.start_datetime
        FROM bookings b
        JOIN slots sl ON sl.id = b.slot_id
        WHERE b.id = ?
        `,
        [id]
    );
    if (!row) return res.status(404).json({ error: "NOT_FOUND" });

    const isOwner = row.user_id === req.user.id;
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) return res.status(403).json({ error: "FORBIDDEN" });

    // 12-hour cancellation rule: applies to clients (owners), admin can always cancel
    if (!isAdmin) {
        const startMs = new Date(row.start_datetime + "Z").getTime();
        const nowMs = Date.now();
        const diffHours = (startMs - nowMs) / (1000 * 60 * 60);

        if (diffHours < 12) {
            return res.status(400).json({ error: "CANCEL_NOT_ALLOWED_WITHIN_12H" });
        }
    }

    await run(db, "UPDATE bookings SET status = 'canceled' WHERE id = ?", [id]);
    res.json({ canceled: true });
});

app.delete("/api/bookings/:id", authRequired, adminOnly, async (req, res) => {
    const id = Number(req.params.id);

    const row = await get(db, "SELECT id, status FROM bookings WHERE id = ?", [id]);
    if (!row) return res.status(404).json({ error: "NOT_FOUND" });

    if (row.status !== "canceled") {
        return res.status(400).json({ error: "ONLY_CANCELED_CAN_BE_DELETED" });
    }

    await run(db, "DELETE FROM bookings WHERE id = ?", [id]);
    res.json({ deleted: true });
});

// start
(async () => {
    db = await initDb();
    app.listen(PORT, () => {
        console.log(`Server running: http://localhost:${PORT}`);
    });
})();
