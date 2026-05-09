const TOAST_ID = "ethicalstack-toast";
const DEFAULT_LANGUAGE_PAIR = "en-ar";
const DEFAULT_THEME = "light";
const DIVIDER_TOKEN = "__DIVIDER__";
const AR_TITLE_TOKEN = "__AR_TITLE__";

const HIGHLIGHT_CLASS = "ethicalstack-hl";
const TOOLTIP_ID = "ethicalstack-tooltip";

// ─── Toast helpers (unchanged) ──────────────────────────────────────────────

function clearToast() {
    const existing = document.getElementById(TOAST_ID);
    if (existing) {
        existing.remove();
    }
}

function buildLine(text) {
    const line = document.createElement("p");
    line.textContent = text;
    return line;
}

function getPrimaryEntry(payload) {
    if (!payload) {
        return null;
    }
    if (payload.status === "exact") {
        return payload.result || payload.entry || null;
    }
    if (payload.status === "fallback") {
        const results = payload.result && payload.result.results ? payload.result.results : payload.results;
        if (Array.isArray(results)) {
            return results[0] || null;
        }
    }
    return null;
}

function getSettingsFromPayload(payload) {
    if (payload && payload.settings) {
        return payload.settings;
    }
    return { languagePair: DEFAULT_LANGUAGE_PAIR, theme: DEFAULT_THEME };
}

function getLabels(uiLang) {
    if (uiLang === "ar") {
        return {
            lookupTitle: "بحث في المعجم",
            lookingUp: "جارٍ البحث...",
            noMatches: "لم يتم العثور على نتائج.",
            lookupFailed: "فشل البحث.",
            noResponse: "لا توجد استجابة من البحث.",
            glossaryLookup: "بحث في المعجم",
        };
    }
    return {
        lookupTitle: "Glossary lookup",
        lookingUp: "Looking up...",
        noMatches: "No matches found.",
        lookupFailed: "Lookup failed.",
        noResponse: "No response from lookup.",
        glossaryLookup: "Glossary lookup",
    };
}

function applyTheme(toast, theme) {
    toast.classList.toggle("dark", theme === "dark");
}

function getEntryContent(entry, languagePair) {
    if (!entry) {
        return { title: "Glossary lookup", lines: [] };
    }

    if (languagePair === "ar-en") {
        return {
            title: entry.arabic_term || entry.english_term || "Glossary lookup",
            lines: [
                entry.arabic_def || "",
                entry.english_term ? `English: ${entry.english_term}` : "",
                entry.english_def ? `English def: ${entry.english_def}` : "",
            ].filter(Boolean),
        };
    }

    if (languagePair === "en-fr") {
        return {
            title: entry.english_term || entry.french_term || "Glossary lookup",
            lines: [
                entry.english_def || entry.french_def || "",
                entry.french_term ? `French: ${entry.french_term}` : "",
                entry.french_def ? `French def: ${entry.french_def}` : "",
            ].filter(Boolean),
        };
    }

    return {
        title: entry.english_term || entry.arabic_term || "Glossary lookup",
        lines: [
            entry.english_def || "",
            DIVIDER_TOKEN,
            AR_TITLE_TOKEN,
            entry.arabic_term || "",
            entry.arabic_def || "",
        ].filter(Boolean),
    };
}

function showToast(payload) {
    clearToast();

    const toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.className = "ethicalstack-toast";

    const settings = getSettingsFromPayload(payload);
    const uiLang = settings.uiLanguage || "en";
    const labels = getLabels(uiLang);
    applyTheme(toast, settings.theme);

    const closeButton = document.createElement("button");
    closeButton.className = "ethicalstack-toast-close";
    closeButton.setAttribute("type", "button");
    closeButton.setAttribute("aria-label", "Close");
    closeButton.textContent = "×";
    closeButton.addEventListener("click", clearToast);
    toast.appendChild(closeButton);

    if (!payload) {
        toast.classList.add("error");
        toast.appendChild(buildLine(labels.noResponse));
        document.body.appendChild(toast);
        return;
    }

    if (payload.status === "pending") {
        const title = document.createElement("h4");
        title.textContent = payload.query || labels.lookupTitle;
        toast.appendChild(title);
        toast.appendChild(buildLine(labels.lookingUp));
        document.body.appendChild(toast);
        return;
    }

    const entry = getPrimaryEntry(payload);
    const content = getEntryContent(entry, settings.languagePair);
    const title = document.createElement("h4");
    title.textContent = content.title || payload.query || labels.lookupTitle;
    toast.appendChild(title);

    if (payload.status === "error") {
        toast.classList.add("error");
        toast.appendChild(buildLine(payload.message || labels.lookupFailed));
    } else if (payload.status === "fallback") {
        const badge = document.createElement("div");
        badge.className = "ethicalstack-badge";
        badge.textContent = "Closest match";
        toast.appendChild(badge);
    }

    const lines = content.lines;
    if (!lines.length && payload.status !== "error") {
        toast.appendChild(buildLine(labels.noMatches));
    } else {
        lines.forEach((line) => {
            if (line === DIVIDER_TOKEN) {
                const divider = document.createElement("div");
                divider.className = "ethicalstack-divider";
                toast.appendChild(divider);
                return;
            }
            if (line === AR_TITLE_TOKEN) {
                const subtitle = document.createElement("h4");
                subtitle.className = "ethicalstack-subtitle";
                subtitle.textContent = entry && entry.arabic_term ? entry.arabic_term : "";
                if (subtitle.textContent) {
                    toast.appendChild(subtitle);
                }
                return;
            }
            toast.appendChild(buildLine(line));
        });
    }

    document.body.appendChild(toast);
}

// ─── Glossary auto-highlighting + hover tooltip ─────────────────────────────

// Shared tooltip element — created once, repositioned per highlight.
let tooltipEl = null;
let hideTooltipTimer = null;

function getOrCreateTooltip() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement("div");
    tooltipEl.id = TOOLTIP_ID;
    tooltipEl.className = "ethicalstack-tooltip";
    tooltipEl.addEventListener("mouseenter", () => clearTimeout(hideTooltipTimer));
    tooltipEl.addEventListener("mouseleave", () => scheduleHideTooltip());
    document.body.appendChild(tooltipEl);
    // Force the browser to paint the initial state (opacity: 0) so the CSS
    // transition actually fires when we add the 'visible' class.
    tooltipEl.offsetHeight; // eslint-disable-line no-unused-expressions
    return tooltipEl;
}

function scheduleHideTooltip() {
    clearTimeout(hideTooltipTimer);
    hideTooltipTimer = setTimeout(() => {
        if (tooltipEl) tooltipEl.classList.remove("visible");
    }, 220);
}

function showTooltipForEntry(entryData, anchorEl) {
    const tip = getOrCreateTooltip();
    clearTimeout(hideTooltipTimer);

    // Remove visible first so we can re-trigger the transition between terms.
    tip.classList.remove("visible");

    // Build content.
    let html = `<div class="ethicalstack-tooltip-term">${esc(entryData.term)}</div>`;
    if (entryData.en) {
        html += `<div class="ethicalstack-tooltip-def">${esc(entryData.en)}</div>`;
    }
    if (entryData.ar_term) {
        html += `<div class="ethicalstack-tooltip-row"><span class="ethicalstack-tooltip-lang">AR</span> ${esc(entryData.ar_term)}</div>`;
    }
    if (entryData.ar_def) {
        html += `<div class="ethicalstack-tooltip-def ar">${esc(entryData.ar_def)}</div>`;
    }
    if (entryData.fr_term) {
        html += `<div class="ethicalstack-tooltip-row"><span class="ethicalstack-tooltip-lang">FR</span> ${esc(entryData.fr_term)}</div>`;
    }
    if (entryData.fr_def) {
        html += `<div class="ethicalstack-tooltip-def">${esc(entryData.fr_def)}</div>`;
    }
    tip.innerHTML = html;

    // Position.
    const rect = anchorEl.getBoundingClientRect();
    tip.style.top = `${window.scrollY + rect.bottom + 6}px`;
    tip.style.left = `${window.scrollX + rect.left}px`;

    // Force reflow then show — guarantees the transition fires every time.
    tip.offsetHeight; // eslint-disable-line no-unused-expressions
    tip.classList.add("visible");

    // Clamp if it goes off-screen to the right.
    requestAnimationFrame(() => {
        const tipRect = tip.getBoundingClientRect();
        if (tipRect.right > window.innerWidth - 12) {
            tip.style.left = `${window.innerWidth - tipRect.width - 12}px`;
        }
        // If it goes below the viewport, show above.
        if (tipRect.bottom > window.innerHeight - 12) {
            tip.style.top = `${window.scrollY + rect.top - tipRect.height - 6}px`;
        }
    });
}

function esc(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// Common-word denylist: filters out polluted aliases like "or" / "the" that
// leaked from the source dataset and would otherwise highlight everywhere.
// Acts on the lowercased token; only matters for ASCII single-word candidates.
const HIGHLIGHT_STOPWORDS = new Set([
    "a", "an", "the", "and", "or", "but", "if", "of", "in", "on", "at", "to",
    "for", "by", "with", "as", "is", "are", "was", "were", "be", "been", "being",
    "it", "its", "this", "that", "these", "those", "we", "you", "he", "she",
    "they", "them", "his", "her", "our", "your", "their", "i", "me", "my",
    "do", "does", "did", "have", "has", "had", "can", "could", "will", "would",
    "should", "may", "might", "must", "no", "not", "yes", "so", "than", "then",
    "from", "into", "out", "up", "down", "over", "under", "about",
]);
const HIGHLIGHT_MIN_LENGTH = 3;

function isHighlightableTerm(term) {
    if (!term) return false;
    const trimmed = String(term).trim();
    if (trimmed.length < HIGHLIGHT_MIN_LENGTH) return false;
    // Single ASCII word that's a stopword → drop it.
    if (/^[A-Za-z]+$/.test(trimmed) && HIGHLIGHT_STOPWORDS.has(trimmed.toLowerCase())) {
        return false;
    }
    return true;
}

// Build a case-insensitive regex that matches whole-word occurrences of any
// glossary term (including aliases).  Sorted longest-first so a compound term
// like "Differential Privacy" matches before "Privacy".
function buildTermRegex(entries) {
    const allTerms = [];
    for (const e of entries) {
        if (isHighlightableTerm(e.term)) allTerms.push(e.term);
        if (Array.isArray(e.aliases)) {
            for (const a of e.aliases) {
                if (isHighlightableTerm(a)) allTerms.push(a);
            }
        }
    }
    // Deduplicate and sort longest-first.
    const unique = [...new Set(allTerms)].sort((a, b) => b.length - a.length);
    if (!unique.length) return null;
    const escaped = unique.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
}

// Map lowercased term (and aliases) → entry data for O(1) lookup when hovering.
// Mirrors buildTermRegex's filtering so hover state stays consistent.
function buildTermMap(entries) {
    const map = new Map();
    for (const e of entries) {
        if (isHighlightableTerm(e.term)) map.set(e.term.toLowerCase(), e);
        if (Array.isArray(e.aliases)) {
            for (const a of e.aliases) {
                if (isHighlightableTerm(a) && !map.has(a.toLowerCase())) {
                    map.set(a.toLowerCase(), e);
                }
            }
        }
    }
    return map;
}

// Elements that should never be walked.
const SKIP_TAGS = new Set([
    "SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "CODE", "PRE",
    "SVG", "CANVAS", "VIDEO", "AUDIO", "IFRAME", "NOSCRIPT",
]);

function highlightTermsInPage(entries) {
    const regex = buildTermRegex(entries);
    if (!regex) return;
    const termMap = buildTermMap(entries);

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            if (parent.classList.contains(HIGHLIGHT_CLASS)) return NodeFilter.FILTER_REJECT;
            if (parent.closest(`.${HIGHLIGHT_CLASS}`)) return NodeFilter.FILTER_REJECT;
            if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
            if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
            // Skip extension-injected elements.
            if (parent.closest("#" + TOAST_ID) || parent.closest("#" + TOOLTIP_ID)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        },
    });

    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    for (const textNode of textNodes) {
        const text = textNode.nodeValue;
        if (!text.trim()) continue;

        // Reset regex state.
        regex.lastIndex = 0;
        const matches = [];
        let m;
        while ((m = regex.exec(text)) !== null) {
            matches.push({ index: m.index, length: m[0].length, matched: m[0] });
        }
        if (!matches.length) continue;

        const frag = document.createDocumentFragment();
        let cursor = 0;

        for (const { index, length, matched } of matches) {
            // Text before match.
            if (index > cursor) {
                frag.appendChild(document.createTextNode(text.slice(cursor, index)));
            }
            // The highlighted <mark>.
            const mark = document.createElement("mark");
            mark.className = HIGHLIGHT_CLASS;
            mark.textContent = text.slice(index, index + length);
            mark.dataset.term = matched.toLowerCase();

            // Hover handlers.
            mark.addEventListener("mouseenter", () => {
                const entryData = termMap.get(mark.dataset.term);
                if (entryData) showTooltipForEntry(entryData, mark);
            });
            mark.addEventListener("mouseleave", () => scheduleHideTooltip());

            frag.appendChild(mark);
            cursor = index + length;
        }
        // Remaining text.
        if (cursor < text.length) {
            frag.appendChild(document.createTextNode(text.slice(cursor)));
        }

        textNode.parentNode.replaceChild(frag, textNode);
    }
}

// Entry point: fetch settings + glossary, then highlight.
async function initHighlighting() {
    try {
        const settingsResp = await chrome.runtime.sendMessage({ type: "getSettings" });
        if (!settingsResp || !settingsResp.ok) return;
        const settings = settingsResp.data;
        if (settings.highlightingEnabled === false) return;

        const glossaryResp = await chrome.runtime.sendMessage({ type: "getGlossary" });
        if (!glossaryResp || !glossaryResp.ok || !glossaryResp.data) return;
        const entries = glossaryResp.data.entries;
        if (!Array.isArray(entries) || !entries.length) return;

        highlightTermsInPage(entries);
    } catch {
        // Silently fail — user likely on a restricted page (chrome://, etc.)
    }
}

// Re-run highlighting when the user changes settings.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.highlightingEnabled) {
        if (changes.highlightingEnabled.newValue === false) {
            // Remove all existing highlights.
            document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
                const parent = el.parentNode;
                el.replaceWith(document.createTextNode(el.textContent));
                // Normalize adjacent text nodes.
                if (parent) parent.normalize();
            });
            if (tooltipEl) tooltipEl.remove();
            tooltipEl = null;
        } else {
            initHighlighting();
        }
    }
});

// ─── Message listener (toast) ───────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== "showToast") {
        return;
    }
    showToast(message.payload);
});

// ─── Boot ───────────────────────────────────────────────────────────────────

// Wait for document to be interactive/complete before highlighting.
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHighlighting);
} else {
    initHighlighting();
}
