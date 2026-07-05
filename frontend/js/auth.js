async function handleRegister() {
    await I18N.ready;
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
        setNotice(notice, t(`errors.${code}`), false);
    }
}

async function handleLogin() {
    await I18N.ready;
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
        setNotice(notice, t(`errors.${code}`), false);
    }
}

async function handleForgotPassword() {
    await I18N.ready;
    const notice = document.getElementById("notice");
    const email = document.getElementById("email").value.trim();

    try {
        await API.post("/auth/forgot-password", { email });
        setNotice(notice, t("forgotPassword.sent"), true);
    } catch (e) {
        const code = e?.data?.error || "REQUEST_FAILED";
        setNotice(notice, t(`errors.${code}`), false);
    }
}

async function handleResetPassword() {
    await I18N.ready;
    const notice = document.getElementById("notice");
    const password = document.getElementById("password").value;
    const token = new URLSearchParams(window.location.search).get("token");

    if (!token) {
        setNotice(notice, t("resetPassword.missingToken"), false);
        return;
    }

    try {
        await API.post("/auth/reset-password", { token, password });
        setNotice(notice, t("resetPassword.success"), true);
        setTimeout(() => (window.location.href = "/login.html"), 1500);
    } catch (e) {
        const code = e?.data?.error || "RESET_FAILED";
        setNotice(notice, t(`errors.${code}`), false);
    }
}

async function handleBootstrapAdmin() {
    await I18N.ready;
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
        setNotice(notice, t(`errors.${code}`), false);
    }
}
