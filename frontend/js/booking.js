requireAuth(["client", "admin"]);

async function loadServices() {
    const sel = document.getElementById("service");
    sel.innerHTML = "";
    const services = await API.get("/services");
    for (const s of services) {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.duration_minutes} min) - ${s.price.toFixed(2)}`;
        sel.appendChild(opt);
    }
}

async function loadSlotsForDate(date) {
    const list = document.getElementById("slots");
    list.innerHTML = "";
    const slots = await API.get(`/slots?date=${encodeURIComponent(date)}`);

    if (!slots.length) {
        const div = document.createElement("div");
        div.className = "notice err";
        div.textContent = "NO_AVAILABILITY";
        list.appendChild(div);
        return;
    }

    for (const s of slots) {
        const row = document.createElement("div");
        row.className = "item";
        row.innerHTML = `
      <div>
        <div><b>${new Date(s.start_datetime + "Z").toLocaleString()}</b></div>
        <div class="small">Slot ID: ${s.id}</div>
      </div>
      <button data-id="${s.id}">Select</button>
    `;
        row.querySelector("button").addEventListener("click", () => {
            document.getElementById("slotId").value = s.id;
            document.getElementById("selectedSlot").textContent = `Selected slot: ${s.id}`;
        });
        list.appendChild(row);
    }
}

async function createBooking() {
    const notice = document.getElementById("notice");
    const service_id = Number(document.getElementById("service").value);
    const slot_id = Number(document.getElementById("slotId").value);
    const note = document.getElementById("note").value.trim();

    if (!slot_id) {
        setNotice(notice, "SLOT_REQUIRED", false);
        return;
    }

    try {
        const r = await API.post("/bookings", { service_id, slot_id, note });
        setNotice(notice, `BOOKED_ID_${r.id}`, true);

        const date = document.getElementById("date").value;
        await loadSlotsForDate(date);

        document.getElementById("slotId").value = "";
        document.getElementById("selectedSlot").textContent = "Selected slot: -";
    } catch (e) {
        const code = e?.data?.error || "BOOKING_FAILED";
        setNotice(notice, code, false);

        if (e.status === 409) {
            const date = document.getElementById("date").value;
            await loadSlotsForDate(date);
        }
    }
}

async function loadMyBookings() {
    const list = document.getElementById("myBookings");
    list.innerHTML = "";
    const rows = await API.get("/bookings/my");

    for (const b of rows) {
        const row = document.createElement("div");
        row.className = "item";
        row.innerHTML = `
      <div>
        <div><b>${b.service_name}</b> <span class="badge">${b.status}</span></div>
        <div class="small">${new Date(b.start_datetime + "Z").toLocaleString()}</div>
      </div>
      <button data-id="${b.id}">Cancel</button>
    `;
        row.querySelector("button").addEventListener("click", async () => {
            await API.patch(`/bookings/${b.id}/cancel`, {});
            await loadMyBookings();
        });
        list.appendChild(row);
    }
}

window.addEventListener("DOMContentLoaded", async () => {
    await loadServices();

    const dateEl = document.getElementById("date");
    const today = new Date();
    const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    dateEl.value = iso;

    await loadSlotsForDate(dateEl.value);
    await loadMyBookings();

    dateEl.addEventListener("change", async () => {
        document.getElementById("slotId").value = "";
        document.getElementById("selectedSlot").textContent = "Selected slot: -";
        await loadSlotsForDate(dateEl.value);
    });

    document.getElementById("reserve").addEventListener("click", createBooking);
    document.getElementById("logout").addEventListener("click", logout);
});
