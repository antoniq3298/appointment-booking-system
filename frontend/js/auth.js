async function handleRegister() {
    const notice = document.getElementById("notice");
    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    try {
        const r = await API.post("/auth/register", { name, phone, email, password });
        localStorage.setItem("token", r.token);
        localStorage.setItem("role", r.user.role);
        localStorage.setItem("user", JSON.stringify(r.user));
        window.location.href = "/booking.html";
    } catch (e) {
        const code = e?.data?.error || "REGISTER_FAILED";
        setNotice(notice, code, false);
    }
}

async function handleLogin() {
    const notice = document.getElementById("notice");
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    try {
        const r = await API.post("/auth/login", { email, password });
        localStorage.setItem("token", r.token);
        localStorage.setItem("role", r.user.role);
        localStorage.setItem("user", JSON.stringify(r.user));

        if (r.user.role === "admin") window.location.href = "/admin.html";
        else window.location.href = "/booking.html";
    } catch (e) {
        const code = e?.data?.error || "LOGIN_FAILED";
        setNotice(notice, code, false);
    }
}

async function handleBootstrapAdmin() {
    const notice = document.getElementById("notice");
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    try {
        const r = await API.post("/admin/bootstrap", { name, email, password });
        localStorage.setItem("token", r.token);
        localStorage.setItem("role", r.user.role);
        localStorage.setItem("user", JSON.stringify(r.user));
        window.location.href = "/admin.html";
    } catch (e) {
        const code = e?.data?.error || "BOOTSTRAP_FAILED";
        setNotice(notice, code, false);
    }
}
