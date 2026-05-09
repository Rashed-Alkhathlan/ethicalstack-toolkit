const DEFAULT_BASE_URL = "http://localhost:8000";
const DEFAULT_LANGUAGE_PAIR = "en-ar";
const DEFAULT_THEME = "light";
const DEFAULT_HIGHLIGHTING_ENABLED = true;

const inputEl = document.getElementById("api-base-url");
const languagePairEl = document.getElementById("language-pair");
const themeEl = document.getElementById("theme");
const highlightingEl = document.getElementById("highlighting-enabled");
const saveButton = document.getElementById("save-button");
const resetButton = document.getElementById("reset-button");
const statusEl = document.getElementById("status");

function setStatus(text, tone = "") {
    statusEl.textContent = text;
    statusEl.style.color = tone === "error" ? "#8c2d25" : "#1f5b43";
}

function normalizeUrl(value) {
    const trimmed = value.trim();
    if (!trimmed) {
        return DEFAULT_BASE_URL;
    }
    const url = new URL(trimmed);
    return url.origin;
}

function applyTheme(theme) {
    document.body.classList.toggle("theme-dark", theme === "dark");
}

async function loadSettings() {
    const { apiBaseUrl, languagePair, theme, highlightingEnabled } = await chrome.storage.sync.get({
        apiBaseUrl: DEFAULT_BASE_URL,
        languagePair: DEFAULT_LANGUAGE_PAIR,
        theme: DEFAULT_THEME,
        highlightingEnabled: DEFAULT_HIGHLIGHTING_ENABLED,
    });
    inputEl.value = apiBaseUrl;
    languagePairEl.value = languagePair;
    themeEl.value = theme;
    highlightingEl.checked = highlightingEnabled;
    applyTheme(theme);
}

async function saveSettings() {
    try {
        const normalized = normalizeUrl(inputEl.value);
        const languagePair = languagePairEl.value || DEFAULT_LANGUAGE_PAIR;
        const theme = themeEl.value || DEFAULT_THEME;
        const highlightingEnabled = highlightingEl.checked;
        await chrome.storage.sync.set({
            apiBaseUrl: normalized,
            languagePair,
            theme,
            highlightingEnabled,
        });
        inputEl.value = normalized;
        applyTheme(theme);
        setStatus("Saved.");
    } catch {
        setStatus("Please enter a valid URL.", "error");
    }
}

async function resetSettings() {
    await chrome.storage.sync.set({
        apiBaseUrl: DEFAULT_BASE_URL,
        languagePair: DEFAULT_LANGUAGE_PAIR,
        theme: DEFAULT_THEME,
        highlightingEnabled: DEFAULT_HIGHLIGHTING_ENABLED,
    });
    inputEl.value = DEFAULT_BASE_URL;
    languagePairEl.value = DEFAULT_LANGUAGE_PAIR;
    themeEl.value = DEFAULT_THEME;
    highlightingEl.checked = DEFAULT_HIGHLIGHTING_ENABLED;
    applyTheme(DEFAULT_THEME);
    setStatus("Reset to default.");
}

saveButton.addEventListener("click", saveSettings);
resetButton.addEventListener("click", resetSettings);
themeEl.addEventListener("change", () => applyTheme(themeEl.value));

loadSettings();
