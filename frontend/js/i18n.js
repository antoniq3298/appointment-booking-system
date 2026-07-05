const I18N_SUPPORTED = ["en", "bg"];
const I18N_DEFAULT = "bg";

let i18nTranslations = {};
let i18nCurrentLang = I18N_DEFAULT;

function getStoredLang() {
    const stored = localStorage.getItem("lang");
    return I18N_SUPPORTED.includes(stored) ? stored : I18N_DEFAULT;
}

// dot-path lookup with {{var}} interpolation; falls back to the last path
// segment (e.g. a raw backend error code) if the key isn't translated
function t(path, vars) {
    const parts = path.split(".");
    let node = i18nTranslations;
    for (const p of parts) {
        node = node && typeof node === "object" && p in node ? node[p] : undefined;
    }
    if (node === undefined) node = parts[parts.length - 1];

    if (typeof node === "string" && vars) {
        for (const key in vars) node = node.replace(new RegExp(`{{${key}}}`, "g"), vars[key]);
    }
    return node;
}

function applyTranslations(root) {
    root = root || document;
    root.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = t(el.dataset.i18n);
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });
}

// stored datetimes have no timezone suffix but represent UTC (see backend formatSlot)
function formatDateTime(isoNoZone) {
    return new Date(isoNoZone + "Z").toLocaleString(i18nCurrentLang === "bg" ? "bg-BG" : "en-US");
}

function renderLangSwitch() {
    const sel = document.getElementById("langSwitch");
    if (!sel) return;
    sel.value = i18nCurrentLang;
    sel.addEventListener("change", () => {
        localStorage.setItem("lang", sel.value);
        location.reload();
    });
}

async function loadTranslations(lang) {
    const res = await fetch(`/i18n/${lang}.json`);
    return res.json();
}

// other scripts must `await I18N.ready` before rendering anything translated,
// since fetching the translation file is asynchronous and can outlast DOMContentLoaded
const I18N = {
    ready: (async () => {
        i18nCurrentLang = getStoredLang();
        i18nTranslations = await loadTranslations(i18nCurrentLang);
        document.documentElement.lang = i18nCurrentLang;
        applyTranslations();
        renderLangSwitch();
    })(),
    getLang: () => i18nCurrentLang,
    apply: applyTranslations,
    formatDateTime
};

window.t = t;
window.I18N = I18N;
