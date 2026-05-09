import { EthicalStackClient } from "./lib/ethicalstackClient.js";

const DEFAULT_BASE_URL = "http://localhost:8000";
const DEFAULT_LANGUAGE_PAIR = "en-ar";
const DEFAULT_THEME = "light";
const DEFAULT_HIGHLIGHTING_ENABLED = true;
const DEFAULT_UI_LANGUAGE = "en";
const MAX_QUERY_LENGTH = 120;
const SEARCH_LIMIT = 3;
const SEMANTIC_CONFIDENCE_THRESHOLD = 0.35;
const GLOSSARY_CACHE_KEY = "glossaryCache";
const GLOSSARY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

function normalizeQuery(text) {
    if (!text) {
        return "";
    }
    return text.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
}

async function getSettings() {
    return chrome.storage.sync.get({
        apiBaseUrl: DEFAULT_BASE_URL,
        languagePair: DEFAULT_LANGUAGE_PAIR,
        theme: DEFAULT_THEME,
        highlightingEnabled: DEFAULT_HIGHLIGHTING_ENABLED,
        uiLanguage: DEFAULT_UI_LANGUAGE,
    });
}

async function getGlossary(force = false) {
    const cached = (await chrome.storage.local.get({ [GLOSSARY_CACHE_KEY]: null }))[
        GLOSSARY_CACHE_KEY
    ];
    if (
        !force
        && cached
        && cached.fetchedAt
        && Date.now() - cached.fetchedAt < GLOSSARY_CACHE_TTL_MS
    ) {
        return cached;
    }

    const settings = await getSettings();
    const client = new EthicalStackClient(settings.apiBaseUrl);
    const data = await client.listTerms(10000, 0);
    const entries = (data && data.results) || [];
    // Trim to the fields the content script actually needs — avoid bloating
    // chrome.storage.local with definitions repeated thousands of times.
    const slim = entries.map((e) => ({
        term: e.english_term,
        en: e.english_def || "",
        ar_term: e.arabic_term || "",
        ar_def: e.arabic_def || "",
        fr_term: e.french_term || "",
        fr_def: e.french_def || "",
        aliases: Array.isArray(e.aliases) ? e.aliases : [],
    }));
    const fresh = {
        baseUrl: settings.apiBaseUrl,
        fetchedAt: Date.now(),
        entries: slim,
    };
    await chrome.storage.local.set({ [GLOSSARY_CACHE_KEY]: fresh });
    return fresh;
}

async function saveLastResult(payload) {
    await chrome.storage.session.set({ lastLookup: payload });
}

function buildErrorPayload(err, query, baseUrl) {
    let message = "Request failed.";
    if (err) {
        if (err.body) {
            try {
                const parsed = JSON.parse(err.body);
                if (parsed && parsed.error && parsed.error.message) {
                    message = parsed.error.message;
                } else {
                    message = err.body;
                }
            } catch {
                message = err.body;
            }
        } else if (err.message) {
            message = err.message;
        }
    }
    return {
        status: "error",
        query,
        baseUrl,
        message,
        timestamp: Date.now(),
    };
}

async function lookupTerm(query, reason = "manual") {
    const cleaned = normalizeQuery(query);
    const settings = await getSettings();
    const baseUrl = settings.apiBaseUrl;
    if (!cleaned) {
        const payload = {
            status: "error",
            reason,
            query: "",
            baseUrl,
            settings,
            message: "No text selected.",
            timestamp: Date.now(),
        };
        await saveLastResult(payload);
        return payload;
    }

    const client = new EthicalStackClient(baseUrl);

    try {
        const entry = await client.lookupTerm(cleaned);
        const payload = {
            status: "exact",
            reason,
            query: cleaned,
            baseUrl,
            settings,
            result: entry,
            fallbackUsed: false,
            timestamp: Date.now(),
        };
        await saveLastResult(payload);
        return payload;
    } catch (err) {
        if (err && err.status === 404) {
            try {
                const search = await client.search(cleaned, SEARCH_LIMIT);
                const searchResults = search && search.results ? search.results : [];
                if (searchResults.length > 0) {
                    const payload = {
                        status: "fallback",
                        reason,
                        query: cleaned,
                        baseUrl,
                        settings,
                        result: search,
                        fallbackUsed: true,
                        fallbackSource: "search",
                        timestamp: Date.now(),
                    };
                    await saveLastResult(payload);
                    return payload;
                }

                const semantic = await client.semanticSearch(cleaned, SEARCH_LIMIT);
                const semanticResults = semantic && semantic.results ? semantic.results : [];
                const filtered = semanticResults.filter((item) => {
                    const score = typeof item.score === "number" ? item.score : 1;
                    return score <= SEMANTIC_CONFIDENCE_THRESHOLD;
                });
                const normalized = filtered.map((item) => item.entry).filter(Boolean);
                const payload = {
                    status: "fallback",
                    reason,
                    query: cleaned,
                    baseUrl,
                    settings,
                    result: {
                        query: cleaned,
                        total: normalized.length,
                        offset: 0,
                        limit: SEARCH_LIMIT,
                        results: normalized,
                    },
                    fallbackUsed: true,
                    fallbackSource: "semantic",
                    timestamp: Date.now(),
                };
                await saveLastResult(payload);
                return payload;
            } catch (searchErr) {
                const payload = { ...buildErrorPayload(searchErr, cleaned, baseUrl), settings };
                await saveLastResult(payload);
                return payload;
            }
        }
        const payload = { ...buildErrorPayload(err, cleaned, baseUrl), settings };
        await saveLastResult(payload);
        return payload;
    }
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: "ethicalstack_lookup",
            title: 'Lookup "%s" in EthicalStack',
            contexts: ["selection"],
        });
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== "ethicalstack_lookup") {
        return;
    }
    const cleaned = normalizeQuery(info.selectionText || "");
    if (tab && tab.id) {
        getSettings()
            .then((settings) => {
                chrome.tabs.sendMessage(tab.id, {
                    type: "showToast",
                    payload: {
                        status: "pending",
                        query: cleaned,
                        settings,
                        timestamp: Date.now(),
                    },
                }).catch(() => {
                    // Ignore if no content script is available on this page.
                });
            })
            .catch(() => {
                // Ignore settings lookup failures.
            });
    }
    lookupTerm(info.selectionText || "", "context-menu").then((payload) => {
        if (!tab || !tab.id) {
            return;
        }
        chrome.tabs.sendMessage(tab.id, { type: "showToast", payload }).catch(() => {
            // Ignore if no content script is available on this page.
        });
    });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) {
        return false;
    }

    if (message.type === "lookup") {
        lookupTerm(message.query || "", "popup")
            .then((data) => sendResponse({ ok: true, data }))
            .catch((error) => sendResponse({ ok: false, error: error.message }));
        return true;
    }

    if (message.type === "getLast") {
        chrome.storage.session
            .get({ lastLookup: null })
            .then((data) => sendResponse({ ok: true, data: data.lastLookup }))
            .catch((error) => sendResponse({ ok: false, error: error.message }));
        return true;
    }

    if (message.type === "getBaseUrl") {
        getSettings()
            .then((settings) => sendResponse({ ok: true, data: settings.apiBaseUrl }))
            .catch((error) => sendResponse({ ok: false, error: error.message }));
        return true;
    }

    if (message.type === "getGlossary") {
        getGlossary(message.force === true)
            .then((data) => sendResponse({ ok: true, data }))
            .catch((error) => sendResponse({ ok: false, error: error.message }));
        return true;
    }

    if (message.type === "getSettings") {
        getSettings()
            .then((data) => sendResponse({ ok: true, data }))
            .catch((error) => sendResponse({ ok: false, error: error.message }));
        return true;
    }

    return false;
});

// Invalidate the cache when the API base URL changes — the glossary may be
// served by a different deployment with different terms.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.apiBaseUrl) return;
    chrome.storage.local.remove(GLOSSARY_CACHE_KEY).catch(() => {});
});
