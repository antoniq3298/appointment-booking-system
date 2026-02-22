requireAuth(["admin"]);

async function loadServicesAdmin() {
    const list = document.getElementById("servicesList");
    list.innerHTML = "";
    const services = await API.get("/services");

    for (const s of services) {
        const row = document.createElement("div");
        row.className = "item";
        row.innerHTML = `
      <div>
        <div><b>${s.name}</b></div>
        <div class="small">${s.duration_minutes} min | ${s.price.toFixed(2)} | ID: ${s.id}</div>
      </div>
      <button data-id="${s.id}">Disable</button>
    `;

        row.querySelector("button").addEventListener("click", async () => {
            await API.del(`/services/${s.id}`);
            await loadServicesAdmin();
        });

        list.appendChild(row);
    }
}

async function addService() {
    const notice = document.getElementById("noticeServices");
    const name = document.getElementById("svcName").value.trim();
    const duration_minutes = Number(document.getElementById("svcDuration").value);
    const price = Number(document.getElementById("svcPrice").value);

    try {
        await API.post("/services", { name, duration_minutes, price });
        setNotice(notice, "SERVICE_CREATED", true);
        await loadServicesAdmin();
    } catch (e) {
        setNotice(notice, e?.data?.error || "SERVICE_CREATE_FAILED", false);
    }
}

async function generateSlots() {
    const notice = document.getElementById("noticeSlots");
    const date = document.getElementById("slotDate").value;
    const from = document.getElementById("slotFrom").value;
    const to = document.getElementById("slotTo").value;
    const intervalMinutes = Number(document.getElementById("slotInterval").value);

    try {
        const r = await API.post("/slots/generate", { date, from, to, intervalMinutes });
        setNotice(notice, `CREATED_${r.created}_SKIPPED_${r.skipped}`, true);
    } catch (e) {
        setNotice(notice, e?.data?.error || "SLOTS_GENERATE_FAILED", false);
    }
}

async function loadBookingsAdmin() {
    const list = document.getElementById("bookingsList");
    list.innerHTML = "";

    let rows = await API.get("/bookings");

    // sort by date/time ascending (start_datetime)
    rows = rows.sort((a, b) => {
        const aMs = new Date(a.start_datetime + "Z").getTime();
        const bMs = new Date(b.start_datetime + "Z").getTime();
        return aMs - bMs;
    });

    const nowMs = Date.now();

    for (const b of rows) {
        const row = document.createElement("div");
        row.className = "item";

        const startMs = new Date(b.start_datetime + "Z").getTime();
        const isPast = startMs <= nowMs;
        const canDelete = b.status === "canceled" || isPast;

        row.innerHTML = `
      <div>
        <div><b>${b.client_name}</b> <span class="badge">${b.status}</span></div>
        <div class="small">${b.client_phone || "-"} | ${b.client_email} | ${b.service_name}</div>
        <div class="small">${new Date(b.start_datetime + "Z").toLocaleString()}</div>
      </div>
      <div>
        ${
            canDelete
                ? `<button data-delete="${b.id}">Delete</button>`
                : `<button data-cancel="${b.id}">Cancel</button>`
        }
      </div>
    `;

        const cancelBtn = row.querySelector("[data-cancel]");
        if (cancelBtn) {
            cancelBtn.addEventListener("click", async () => {
                await API.patch(`/bookings/${b.id}/cancel`, {});
                await loadBookingsAdmin();
            });
        }

        const deleteBtn = row.querySelector("[data-delete]");
        if (deleteBtn) {
            deleteBtn.addEventListener("click", async () => {
                await API.del(`/bookings/${b.id}`);
                await loadBookingsAdmin();
            });
        }

        list.appendChild(row);
    }
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function loadSchedule() {
    const notice = document.getElementById("noticeSchedule");
    const list = document.getElementById("scheduleList");
    list.innerHTML = "";

    const rows = await API.get("/schedule");
    const byDay = new Map(rows.map((r) => [r.day_of_week, r]));

    for (let day = 0; day < 7; day++) {
        const entry = byDay.get(day) || { start_time: "09:00", end_time: "17:00", interval_minutes: 30, is_active: 0 };

        const row = document.createElement("div");
        row.className = "item";
        row.innerHTML = `
      <div>
        <div><b>${DAY_NAMES[day]}</b></div>
        <label><input type="checkbox" data-role="active" ${entry.is_active ? "checked" : ""}/> Active</label>
        <input type="time" data-role="start" value="${entry.start_time}" />
        <input type="time" data-role="end" value="${entry.end_time}" />
        <input type="number" data-role="interval" value="${entry.interval_minutes}" style="width:70px" />
      </div>
      <button data-role="save">Save</button>
    `;

        row.querySelector('[data-role="save"]').addEventListener("click", async () => {
            const start_time = row.querySelector('[data-role="start"]').value;
            const end_time = row.querySelector('[data-role="end"]').value;
            const interval_minutes = Number(row.querySelector('[data-role="interval"]').value);
            const is_active = row.querySelector('[data-role="active"]').checked;

            try {
                await API.put(`/schedule/${day}`, { start_time, end_time, interval_minutes, is_active });
                setNotice(notice, `${DAY_NAMES[day]} saved.`, true);
            } catch (e) {
                setNotice(notice, e?.data?.error || "SCHEDULE_SAVE_FAILED", false);
            }
        });

        list.appendChild(row);
    }
}

async function generateFromSchedule() {
    const notice = document.getElementById("noticeSchedule");
    const days = Number(document.getElementById("scheduleDays").value) || 14;

    try {
        const r = await API.post("/slots/generate-from-schedule", { days });
        setNotice(notice, `CREATED_${r.created}_SKIPPED_${r.skipped}`, true);
    } catch (e) {
        setNotice(notice, e?.data?.error || "SCHEDULE_GENERATE_FAILED", false);
    }
}

window.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("logout").addEventListener("click", logout);

    await loadServicesAdmin();
    await loadBookingsAdmin();
    await loadSchedule();

    document.getElementById("addService").addEventListener("click", addService);
    document.getElementById("genSlots").addEventListener("click", generateSlots);
    document.getElementById("refreshBookings").addEventListener("click", loadBookingsAdmin);
    document.getElementById("genFromSchedule").addEventListener("click", generateFromSchedule);

    const d = new Date();
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);

    document.getElementById("slotDate").value = iso;
});