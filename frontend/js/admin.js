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
    const rows = await API.get("/bookings");

    for (const b of rows) {
        const row = document.createElement("div");
        row.className = "item";
        row.innerHTML = `
      <div>
        <div><b>${b.client_name}</b> <span class="badge">${b.status}</span></div>
        <div class="small">${b.client_phone || "-"} | ${b.client_email} | ${b.service_name}</div>
        <div class="small">${new Date(b.start_datetime + "Z").toLocaleString()}</div>
      </div>
      <button data-id="${b.id}">Cancel</button>
    `;
        row.querySelector("button").addEventListener("click", async () => {
            await API.patch(`/bookings/${b.id}/cancel`, {});
            await loadBookingsAdmin();
        });
        list.appendChild(row);
    }
}

window.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("logout").addEventListener("click", logout);

    await loadServicesAdmin();
    await loadBookingsAdmin();

    document.getElementById("addService").addEventListener("click", addService);
    document.getElementById("genSlots").addEventListener("click", generateSlots);
    document.getElementById("refreshBookings").addEventListener("click", loadBookingsAdmin);

    const d = new Date();
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    document.getElementById("slotDate").value = iso;
});
