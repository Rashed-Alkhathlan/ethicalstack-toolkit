const DEFAULT_BASE_URL = "http://localhost:8000";
const DEFAULT_LANGUAGE_PAIR = "en-ar";
const DEFAULT_THEME = "light";
const DEFAULT_UI_LANGUAGE = "en";

const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const baseUrlEl = document.getElementById("base-url");
const timestampEl = document.getElementById("timestamp");
const queryInput = document.getElementById("query-input");
const lookupButton = document.getElementById("lookup-button");
const optionsLink = document.getElementById("open-options");
const langToggle = document.getElementById("lang-toggle");

let currentUiLang = DEFAULT_UI_LANGUAGE;

function setStatus(text, tone = "") {
    statusEl.textContent = text;
    statusEl.className = `status ${tone}`.trim();
}

function clearResults() {
    resultsEl.innerHTML = "";
}

function formatTimestamp(timestamp) {
    if (!timestamp) {
        return "";
    }
    const date = new Date(timestamp);
    return `Last updated: ${date.toLocaleTimeString()}`;
}

function addTag(container, text) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = text;
    container.appendChild(tag);
}

function addEntryRow(container, label, value) {
    if (!value) {
        return;
    }
    const row = document.createElement("div");
    row.className = "entry-meta";
    row.textContent = `${label}: ${value}`;
    container.appendChild(row);
}

function addEntryText(container, value) {
    if (!value) {
        return;
    }
    const row = document.createElement("div");
    row.className = "entry-meta";
    row.textContent = value;
    container.appendChild(row);
}

function addEntrySubtitle(container, value) {
    if (!value) {
        return;
    }
    const row = document.createElement("div");
    row.className = "entry-subtitle";
    row.textContent = value;
    container.appendChild(row);
}

function applyTheme(theme) {
    document.body.classList.toggle("theme-dark", theme === "dark");
}

function getSettingsFromPayload(payload) {
    if (payload && payload.settings) {
        return payload.settings;
    }
    return { languagePair: DEFAULT_LANGUAGE_PAIR, theme: DEFAULT_THEME, uiLanguage: DEFAULT_UI_LANGUAGE };
}

// UI labels are now driven by uiLanguage ("en" | "ar"), NOT by languagePair.
function getLabels(uiLang) {
    if (uiLang === "ar") {
        return {
            exactMatch: "مطابقة تامة",
            noMatches: "لم يتم العثور على نتائج.",
            lookupFailed: "فشل البحث.",
            lookingUp: "جارٍ البحث...",
            enterTerm: "أدخل مصطلحًا للبحث.",
            waiting: "في انتظار التحديد...",
            selectText: "حدد نصًا واستخدم قائمة النقر بزر الفأرة الأيمن.",
            unableToRead: "تعذر قراءة آخر نتيجة.",
            bestMatch: "أفضل نتيجة",
            options: "الإعدادات",
            lookup: "بحث",
            placeholder: "ابحث عن مصطلح",
        };
    }
    return {
        exactMatch: "Exact match",
        noMatches: "No matches found.",
        lookupFailed: "Lookup failed.",
        lookingUp: "Looking up...",
        enterTerm: "Enter a term to lookup.",
        waiting: "Waiting for selection...",
        selectText: "Select text and use the right-click menu.",
        unableToRead: "Unable to read last result.",
        bestMatch: "Best match",
        options: "Options",
        lookup: "Lookup",
        placeholder: "Lookup a term",
    };
}

function applyLocalizedUi(labels) {
    optionsLink.textContent = labels.options;
    lookupButton.textContent = labels.lookup;
    queryInput.setAttribute("placeholder", labels.placeholder);
}

function updateLangToggle() {
    if (langToggle) {
        langToggle.textContent = currentUiLang === "ar" ? "AR" : "EN";
        langToggle.title = currentUiLang === "ar" ? "Switch to English" : "التبديل إلى العربية";
        document.body.dir = currentUiLang === "ar" ? "rtl" : "ltr";
    }
}

function getEntryContent(entry, languagePair) {
    if (!entry) {
        return { title: "Unknown term", primaryDef: "", rows: [] };
    }

    if (languagePair === "ar-en") {
        return {
            title: entry.arabic_term || entry.english_term || "Unknown term",
            primaryDef: entry.arabic_def || entry.english_def || "",
            rows: [
                entry.english_term ? { label: "English", value: entry.english_term } : null,
                entry.english_def ? { label: "English def", value: entry.english_def } : null,
            ].filter(Boolean),
        };
    }

    if (languagePair === "en-fr") {
        return {
            title: entry.english_term || entry.french_term || "Unknown term",
            primaryDef: entry.english_def || entry.french_def || "",
            rows: [
                entry.french_term ? { label: "French", value: entry.french_term } : null,
                entry.french_def ? { label: "French def", value: entry.french_def } : null,
            ].filter(Boolean),
        };
    }

    return {
        title: entry.english_term || entry.arabic_term || "Unknown term",
        primaryDef: entry.english_def || "",
        rows: [
            { type: "divider" },
            entry.arabic_term ? { type: "subtitle", value: entry.arabic_term } : null,
            entry.arabic_def ? { type: "text", value: entry.arabic_def } : null,
        ].filter(Boolean),
    };
}

function renderEntry(entry, languagePair) {
    const card = document.createElement("div");
    card.className = "entry";

    const content = getEntryContent(entry, languagePair);

    const title = document.createElement("div");
    title.className = "entry-title";
    title.textContent = content.title;
    card.appendChild(title);

    if (content.primaryDef) {
        const def = document.createElement("div");
        def.className = "entry-def";
        def.textContent = content.primaryDef;
        card.appendChild(def);
    }

    content.rows.forEach((row) => {
        if (row.type === "divider") {
            const divider = document.createElement("div");
            divider.className = "entry-divider";
            card.appendChild(divider);
            return;
        }
        if (row.type === "text") {
            addEntryText(card, row.value);
            return;
        }
        if (row.type === "subtitle") {
            addEntrySubtitle(card, row.value);
            return;
        }
        if (row.label) {
            addEntryRow(card, row.label, row.value);
        }
    });

    if (entry.aliases && entry.aliases.length) {
        addEntryRow(card, "Aliases", entry.aliases.join(", "));
    }

    return card;
}

function renderExact(payload) {
    const settings = getSettingsFromPayload(payload);
    const labels = getLabels(currentUiLang);
    setStatus(labels.exactMatch, "success");
    clearResults();
    resultsEl.appendChild(renderEntry(payload.result, settings.languagePair));
}

function renderFallback(payload) {
    const settings = getSettingsFromPayload(payload);
    const labels = getLabels(currentUiLang);
    const results = payload.result && payload.result.results ? payload.result.results : [];
    clearResults();

    if (!results.length) {
        setStatus(labels.noMatches, "error");
        return;
    }

    setStatus("", "");
    results.forEach((entry, index) => {
        const card = renderEntry(entry, settings.languagePair);
        if (index === 0) {
            const badge = document.createElement("div");
            badge.className = "entry-badge";
            badge.textContent = "Closest match";
            card.appendChild(badge);
        }
        if (index === 0) {
            const tagRow = document.createElement("div");
            addTag(tagRow, labels.bestMatch);
            card.appendChild(tagRow);
        }
        resultsEl.appendChild(card);
    });
}

function renderError(payload) {
    const labels = getLabels(currentUiLang);
    setStatus(payload.message || labels.lookupFailed, "error");
    clearResults();
}

function renderPayload(payload) {
    if (!payload) {
        const labels = getLabels(currentUiLang);
        applyLocalizedUi(labels);
        setStatus(labels.selectText);
        clearResults();
        timestampEl.textContent = "";
        return;
    }

    const settings = getSettingsFromPayload(payload);
    const labels = getLabels(currentUiLang);
    applyTheme(settings.theme);
    applyLocalizedUi(labels);

    if (payload.status === "exact") {
        renderExact(payload);
    } else if (payload.status === "fallback") {
        renderFallback(payload);
    } else if (payload.status === "error") {
        renderError(payload);
    } else {
        setStatus(labels.waiting);
        clearResults();
    }

    timestampEl.textContent = formatTimestamp(payload.timestamp);
}

async function loadBaseUrl() {
    const { apiBaseUrl, theme, languagePair, uiLanguage } = await chrome.storage.sync.get({
        apiBaseUrl: DEFAULT_BASE_URL,
        theme: DEFAULT_THEME,
        languagePair: DEFAULT_LANGUAGE_PAIR,
        uiLanguage: DEFAULT_UI_LANGUAGE,
    });
    currentUiLang = uiLanguage || DEFAULT_UI_LANGUAGE;
    baseUrlEl.textContent = `API: ${apiBaseUrl}`;
    applyTheme(theme);
    updateLangToggle();
    applyLocalizedUi(getLabels(currentUiLang));
}

async function loadLastResult() {
    const response = await chrome.runtime.sendMessage({ type: "getLast" });
    if (response && response.ok) {
        renderPayload(response.data);
    } else {
        setStatus(getLabels(currentUiLang).unableToRead, "error");
    }
}

async function runLookup() {
    const query = queryInput.value.trim();
    const labels = getLabels(currentUiLang);
    if (!query) {
        setStatus(labels.enterTerm, "error");
        return;
    }
    setStatus(labels.lookingUp, "");
    clearResults();
    const response = await chrome.runtime.sendMessage({
        type: "lookup",
        query,
    });
    if (response && response.ok) {
        renderPayload(response.data);
    } else {
        setStatus(response && response.error ? response.error : "Lookup failed.", "error");
    }
}

lookupButton.addEventListener("click", runLookup);
queryInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        runLookup();
    }
});

optionsLink.addEventListener("click", (event) => {
    event.preventDefault();
    chrome.runtime.openOptionsPage();
});

// Language toggle — persists choice to chrome.storage.sync.
if (langToggle) {
    langToggle.addEventListener("click", async () => {
        currentUiLang = currentUiLang === "en" ? "ar" : "en";
        await chrome.storage.sync.set({ uiLanguage: currentUiLang });
        updateLangToggle();
        const labels = getLabels(currentUiLang);
        applyLocalizedUi(labels);
        // Re-render last result with new labels.
        loadLastResult();
    });
}

loadBaseUrl();
loadLastResult();
