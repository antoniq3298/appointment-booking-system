require("dotenv").config({ quiet: true });

const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { initDb, run, get, all } = require("./db/db");
const { sendEmail } = require("./services/mailer");
const { sendSms } = require("./services/sms");

const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_later";

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

// human-readable "YYYY-MM-DD HH:mm" for email/SMS bodies (stored datetimes are UTC without a "Z" suffix)
function formatSlot(slot) {
    return new Date(slot.start_datetime + "Z").toISOString().slice(0, 16).replace("T", " ");
}

// EMAIL + SMS: booking confirmation
async function notifyBookingCreated(reqUser, svc, slot) {
    const user = await get(db, "SELECT name, email, phone FROM users WHERE id = ?", [reqUser.id]);
    if (!user) return;

    await sendEmail({
        to: user.email,
        subject: "Booking confirmed",
        text: `Hi ${user.name},\n\nYour booking for "${svc.name}" on ${formatSlot(slot)} is confirmed.\n\nThank you!`
    });

    await sendSms({
        to: user.phone,
        body: `Booking confirmed: ${svc.name} on ${formatSlot(slot)}.`
    });
}

// SMS: reminder ~24h before the appointment, sent at most once per booking (reminder_sent flag)
async function sendUpcomingReminders() {
    const rows = await all(
        db,
        `
            SELECT b.id, s.name AS service_name, sl.start_datetime, u.phone
            FROM bookings b
                     JOIN services s ON s.id = b.service_id
                     JOIN slots sl ON sl.id = b.slot_id
                     JOIN users u ON u.id = b.user_id
            WHERE b.status = 'booked' AND b.reminder_sent = 0
        `
    );

    const nowMs = Date.now();
    for (const row of rows) {
        const startMs = new Date(row.start_datetime + "Z").getTime();
        const hoursUntilStart = (startMs - nowMs) / (1000 * 60 * 60);

        // fires once the appointment enters the 24h window; the poll interval must stay
        // shorter than this window or a booking could pass through unnoticed
        if (hoursUntilStart > 0 && hoursUntilStart <= 24) {
            await sendSms({
                to: row.phone,
                body: `Reminder: your "${row.service_name}" appointment is on ${formatSlot(row)} (in about 24h).`
            });
            await run(db, "UPDATE bookings SET reminder_sent = 1 WHERE id = ?", [row.id]);
        }
    }
}

// EMAIL: booking cancellation
async function notifyBookingCanceled(userId, svcName, slot) {
    const user = await get(db, "SELECT name, email FROM users WHERE id = ?", [userId]);
    if (!user) return;

    await sendEmail({
        to: user.email,
        subject: "Booking canceled",
        text: `Hi ${user.name},\n\nYour booking for "${svcName}" on ${formatSlot(slot)} has been canceled.`
    });
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

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// request a password reset link. Always responds the same way whether or not
// the email exists, so callers can't use this endpoint to probe registered emails.
app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "INVALID_INPUT" });

    const user = await get(db, "SELECT id, name, email FROM users WHERE email = ?", [email]);
    if (user) {
        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

        await run(db, "UPDATE users SET reset_token_hash = ?, reset_token_expires = ? WHERE id = ?", [
            tokenHash,
            expires,
            user.id
        ]);

        const resetLink = `${process.env.APP_BASE_URL || ""}/reset-password.html?token=${token}`;
        await sendEmail({
            to: user.email,
            subject: "Password reset",
            text: `Hi ${user.name},\n\nUse this link to reset your password (valid for 1 hour):\n${resetLink}\n\nIf you didn't request this, ignore this email.`
        });
    }

    res.json({ ok: true });
});

// complete a password reset using the token emailed by /forgot-password
app.post("/api/auth/reset-password", async (req, res) => {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: "INVALID_INPUT" });

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await get(db, "SELECT id, reset_token_expires FROM users WHERE reset_token_hash = ?", [tokenHash]);
    if (!user) return res.status(400).json({ error: "INVALID_OR_EXPIRED_TOKEN" });

    if (new Date(user.reset_token_expires).getTime() < Date.now()) {
        return res.status(400).json({ error: "INVALID_OR_EXPIRED_TOKEN" });
    }

    const password_hash = await bcrypt.hash(password, 10);
    await run(db, "UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?", [
        password_hash,
        user.id
    ]);

    res.json({ ok: true });
});

// PROFILE
app.get("/api/users/me", authRequired, async (req, res) => {
    const user = await get(db, "SELECT id, name, phone, email, role FROM users WHERE id = ?", [req.user.id]);
    res.json(user);
});

app.patch("/api/users/me", authRequired, async (req, res) => {
    const { name, phone } = req.body || {};
    if (!name) return res.status(400).json({ error: "INVALID_INPUT" });

    await run(db, "UPDATE users SET name = ?, phone = ? WHERE id = ?", [name, phone || "", req.user.id]);
    const user = await get(db, "SELECT id, name, phone, email, role FROM users WHERE id = ?", [req.user.id]);
    res.json(user);
});

app.post("/api/users/me/password", authRequired, async (req, res) => {
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) return res.status(400).json({ error: "INVALID_INPUT" });

    const userRow = await get(db, "SELECT password_hash FROM users WHERE id = ?", [req.user.id]);
    const ok = await bcrypt.compare(current_password, userRow.password_hash);
    if (!ok) return res.status(401).json({ error: "BAD_CREDENTIALS" });

    const password_hash = await bcrypt.hash(new_password, 10);
    await run(db, "UPDATE users SET password_hash = ? WHERE id = ?", [password_hash, req.user.id]);
    res.json({ ok: true });
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
// RETURN ALL ACTIVE SERVICES
app.get("/api/services", async (req, res) => {
    const rows = await all(
        db,
        "SELECT id, name, duration_minutes, price FROM services WHERE is_active = 1 ORDER BY id DESC"
    );
    res.json(rows);
});
// ADD SERVICES
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
// DELETE SERVICES
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
    const filtered = rows.filter((s) => new Date(s.start_datetime + "Z").getTime() > nowMs);
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

// WORKING SCHEDULE
app.get("/api/schedule", authRequired, adminOnly, async (req, res) => {
    const rows = await all(
        db,
        "SELECT day_of_week, start_time, end_time, interval_minutes, is_active FROM working_schedule ORDER BY day_of_week ASC"
    );
    res.json(rows);
});

// upsert the hours for one weekday (0=Sunday..6=Saturday)
app.put("/api/schedule/:day", authRequired, adminOnly, async (req, res) => {
    const day = Number(req.params.day);
    const { start_time, end_time, interval_minutes, is_active } = req.body || {};
    if (Number.isNaN(day) || day < 0 || day > 6) return res.status(400).json({ error: "INVALID_DAY" });
    if (!start_time || !end_time || !interval_minutes) return res.status(400).json({ error: "INVALID_INPUT" });

    await run(
        db,
        `
            INSERT INTO working_schedule (day_of_week, start_time, end_time, interval_minutes, is_active)
            VALUES (?,?,?,?,?)
            ON CONFLICT(day_of_week) DO UPDATE SET
                start_time = excluded.start_time,
                end_time = excluded.end_time,
                interval_minutes = excluded.interval_minutes,
                is_active = excluded.is_active
        `,
        [day, start_time, end_time, interval_minutes, is_active ? 1 : 0]
    );

    const row = await get(
        db,
        "SELECT day_of_week, start_time, end_time, interval_minutes, is_active FROM working_schedule WHERE day_of_week = ?",
        [day]
    );
    res.json(row);
});

// local YYYY-MM-DD (not UTC) so slot generation lines up with the admin's wall-clock day
function toLocalDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

// generate slots for the next N days from the configured weekly schedule instead of one date at a time
app.post("/api/slots/generate-from-schedule", authRequired, adminOnly, async (req, res) => {
    const days = Number(req.body?.days) || 14;

    const schedule = await all(db, "SELECT * FROM working_schedule WHERE is_active = 1");
    const byDay = new Map(schedule.map((s) => [s.day_of_week, s]));

    let created = 0;
    let skipped = 0;

    for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const entry = byDay.get(d.getDay());
        if (!entry) continue;

        const dateStr = toLocalDateStr(d);
        const start = new Date(`${dateStr}T${entry.start_time}:00`);
        const end = new Date(`${dateStr}T${entry.end_time}:00`);
        const step = entry.interval_minutes * 60 * 1000;

        for (let t = start.getTime(); t + step <= end.getTime(); t += step) {
            const a = new Date(t);
            const b = new Date(t + step);
            try {
                await run(db, "INSERT INTO slots (start_datetime, end_datetime, is_active) VALUES (?,?,1)", [
                    a.toISOString().slice(0, 19),
                    b.toISOString().slice(0, 19)
                ]);
                created++;
            } catch (e) {
                skipped++;
            }
        }
    }

    res.json({ created, skipped });
});

// BOOKINGS
    // CREATE NEW SLOT
app.post("/api/bookings", authRequired, async (req, res) => {
    const { service_id, slot_id, note } = req.body || {};
    if (!service_id || !slot_id) return res.status(400).json({ error: "INVALID_INPUT" });

    // slot must be active
    const slot = await get(db, "SELECT id, start_datetime, end_datetime FROM slots WHERE id = ? AND is_active = 1", [slot_id]);
    if (!slot) return res.status(404).json({ error: "SLOT_NOT_FOUND" });

    const startMs = new Date(slot.start_datetime + "Z").getTime();
    if (startMs <= Date.now()) return res.status(400).json({ error: "SLOT_IN_PAST" });

    // service must be active
    const svc = await get(db, "SELECT id, name FROM services WHERE id = ? AND is_active = 1", [service_id]);
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

        // fire-and-forget notifications: a mail/SMS provider hiccup must not fail the booking
        notifyBookingCreated(req.user, svc, slot).catch((e) => console.error("notifyBookingCreated failed:", e));
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
            ORDER BY sl.start_datetime ASC
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
     // CANCEL
app.patch("/api/bookings/:id/cancel", authRequired, async (req, res) => {
    const id = Number(req.params.id);

    const row = await get(
        db,
        `
            SELECT b.id, b.user_id, s.name AS service_name, sl.start_datetime, sl.end_datetime
            FROM bookings b
                     JOIN services s ON s.id = b.service_id
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

    // fire-and-forget: a mail provider hiccup must not fail the cancellation
    notifyBookingCanceled(row.user_id, row.service_name, row).catch((e) =>
        console.error("notifyBookingCanceled failed:", e)
    );
});

// DELETE booking: allowed only if canceled OR completed (after end_datetime)
app.delete("/api/bookings/:id", authRequired, adminOnly, async (req, res) => {
    const id = Number(req.params.id);

    const row = await get(
        db,
        `
            SELECT b.id, b.status, sl.end_datetime
            FROM bookings b
                     JOIN slots sl ON sl.id = b.slot_id
            WHERE b.id = ?
        `,
        [id]
    );
    if (!row) return res.status(404).json({ error: "NOT_FOUND" });

    const endMs = new Date(row.end_datetime + "Z").getTime();
    const isCompleted = endMs <= Date.now();
    const isCanceled = row.status === "canceled";

    if (!isCanceled && !isCompleted) {
        return res.status(400).json({ error: "ONLY_CANCELED_OR_COMPLETED_CAN_BE_DELETED" });
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

    // 24h-appointment-reminder poll: runs every 10 minutes, well under the 24h window it watches for
    const REMINDER_POLL_MS = 10 * 60 * 1000;
    sendUpcomingReminders().catch((e) => console.error("sendUpcomingReminders failed:", e));
    setInterval(() => {
        sendUpcomingReminders().catch((e) => console.error("sendUpcomingReminders failed:", e));
    }, REMINDER_POLL_MS);
})();