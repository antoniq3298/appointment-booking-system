requireAuth(["client", "admin"]);

async function loadProfile() {
    const user = await API.get("/users/me");
    document.getElementById("email").value = user.email;
    document.getElementById("name").value = user.name;
    document.getElementById("phone").value = user.phone || "";
}

async function saveProfile() {
    const notice = document.getElementById("noticeProfile");
    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();

    try {
        const user = await API.patch("/users/me", { name, phone });
        localStorage.setItem("user", JSON.stringify(user));
        setNotice(notice, t("profile.updated"), true);
    } catch (e) {
        const code = e?.data?.error || "UPDATE_FAILED";
        setNotice(notice, t(`errors.${code}`), false);
    }
}

async function changePassword() {
    const notice = document.getElementById("noticePassword");
    const current_password = document.getElementById("currentPassword").value;
    const new_password = document.getElementById("newPassword").value;

    try {
        await API.post("/users/me/password", { current_password, new_password });
        setNotice(notice, t("profile.passwordChanged"), true);
        document.getElementById("currentPassword").value = "";
        document.getElementById("newPassword").value = "";
    } catch (e) {
        const code = e?.data?.error || "PASSWORD_CHANGE_FAILED";
        setNotice(notice, t(`errors.${code}`), false);
    }
}

window.addEventListener("DOMContentLoaded", async () => {
    await I18N.ready;
    await loadProfile();
    document.getElementById("saveProfile").addEventListener("click", saveProfile);
    document.getElementById("changePassword").addEventListener("click", changePassword);
    document.getElementById("logout").addEventListener("click", logout);
});
