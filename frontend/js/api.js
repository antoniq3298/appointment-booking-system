const API = {
    base: "/api",
    token: () => localStorage.getItem("token") || "",

    async request(path, options = {}) {
        const headers = options.headers || {};
        headers["Content-Type"] = "application/json";

        const token = API.token();
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(API.base + path, { ...options, headers });
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;

        if (!res.ok) {
            const err = new Error("API_ERROR");
            err.status = res.status;
            err.data = data;
            throw err;
        }
        return data;
    },

    get(path) {
        return API.request(path, { method: "GET" });
    },
    post(path, body) {
        return API.request(path, { method: "POST", body: JSON.stringify(body || {}) });
    },
    patch(path, body) {
        return API.request(path, { method: "PATCH", body: JSON.stringify(body || {}) });
    },
    del(path) {
        return API.request(path, { method: "DELETE" });
    }
};

function setNotice(el, msg, ok) {
    el.className = "notice " + (ok ? "ok" : "err");
    el.textContent = msg;
}

function requireAuth(allowedRoles = []) {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    if (!token) window.location.href = "/login.html";
    if (allowedRoles.length && !allowedRoles.includes(role)) window.location.href = "/index.html";
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    window.location.href = "/index.html";
}
