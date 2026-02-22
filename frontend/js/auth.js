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

async function handleForgotPassword() {
    const notice = document.getElementById("notice");
    const email = document.getElementById("email").value.trim();

    try {
        await API.post("/auth/forgot-password", { email });
        setNotice(notice, "If that email exists, a reset link was sent.", true);
    } catch (e) {
        const code = e?.data?.error || "REQUEST_FAILED";
        setNotice(notice, code, false);
    }
}

async function handleResetPassword() {
    const notice = document.getElementById("notice");
    const password = document.getElementById("password").value;
    const token = new URLSearchParams(window.location.search).get("token");

    if (!token) {
        setNotice(notice, "MISSING_TOKEN", false);
        return;
    }

    try {
        await API.post("/auth/reset-password", { token, password });
        setNotice(notice, "Password reset. Redirecting to login...", true);
        setTimeout(() => (window.location.href = "/login.html"), 1500);
    } catch (e) {
        const code = e?.data?.error || "RESET_FAILED";
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
