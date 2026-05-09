// EthicalStack Dashboard — sidebar layout, i18n, term modal, audit history.
// Uses the FastAPI backend (same origin under /dashboard).

const API_BASE = (() => {
    const meta = document.querySelector('meta[name="api-base"]');
    if (meta) return meta.content;
    return window.location.origin.startsWith("file:")
        ? "http://localhost:8000"
        : window.location.origin;
})();

const HISTORY_KEY = "es:audit-history";
const HISTORY_MAX = 20;

// ----- API helper -----
async function api(path, opts = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
        ...opts,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
}

// ----- Routing (sidebar views) -----
const views = ["dashboard", "audit", "explorer", "tools", "history", "contribute", "evaluator", "extension"];

function navigate(view) {
    if (!views.includes(view)) view = "dashboard";
    document.querySelectorAll(".view").forEach((el) => el.classList.toggle("active", el.id === `view-${view}`));
    document.querySelectorAll(".side-link").forEach((el) => el.classList.toggle("active", el.dataset.view === view));
    if (location.hash !== `#${view}`) history.replaceState(null, "", `#${view}`);
    if (view === "history") renderFullHistory();
    if (view === "evaluator") ensureBenchModelsLoaded();
}

document.querySelectorAll(".side-link[data-view]").forEach((el) => {
    el.addEventListener("click", (e) => {
        e.preventDefault();
        navigate(el.dataset.view);
    });
});
document.querySelectorAll("[data-jump]").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.jump));
});
window.addEventListener("hashchange", () => navigate(location.hash.slice(1)));

// ----- Language toggle -----
applyLanguage(CURRENT_LANG);
document.getElementById("langToggle").addEventListener("click", () => {
    applyLanguage(CURRENT_LANG === "en" ? "ar" : "en");
});

// ----- API status + dataset stats -----
async function checkStatus() {
    const wrap = document.getElementById("apiStatusWrap");
    const status = document.getElementById("apiStatus");
    try {
        await api("/health");
        wrap.classList.add("ok"); wrap.classList.remove("bad");
        status.textContent = t("status.online");
    } catch {
        wrap.classList.add("bad"); wrap.classList.remove("ok");
        status.textContent = t("status.offline");
    }

    try {
        const meta = await api("/version");
        if (meta.dataset_meta) {
            const parsed = JSON.parse(meta.dataset_meta);
            const count = parsed.entry_count?.toLocaleString();
            if (count) {
                const big = document.getElementById("statTermsBig");
                if (big) big.textContent = count;
                const explorerCount = document.getElementById("explorerCount");
                if (explorerCount) explorerCount.textContent = count;
            }
        }
    } catch {}
}

// Probe the audit backend so the dashboard stat reflects reality.
async function probeBackend() {
    try {
        const report = await api("/audit", {
            method: "POST",
            body: JSON.stringify({ text: "Probe." }),
        });
        const isGemini = report.backend === "gemini";
        document.getElementById("statBackend").textContent = isGemini ? "Gemini" : "Heuristic";
        document.getElementById("statBackendMeta").textContent = isGemini
            ? t("stats.backend_gemini")
            : t("stats.backend_heuristic");
        if (isGemini) updateBackendPill(report);
    } catch {
        document.getElementById("statBackend").textContent = "—";
        document.getElementById("statBackendMeta").textContent = t("status.offline");
    }
}

// ----- Autocomplete (top search) -----
const searchInput = document.getElementById("globalSearch");
const suggestionsBox = document.getElementById("suggestions");
let activeIdx = -1;
let suggestTimer = null;

searchInput.addEventListener("input", (e) => {
    const q = e.target.value.trim();
    clearTimeout(suggestTimer);
    if (!q) { suggestionsBox.hidden = true; return; }
    suggestTimer = setTimeout(() => fetchSuggestions(q), 120);
});
searchInput.addEventListener("keydown", (e) => {
    const items = suggestionsBox.querySelectorAll(".suggestion");
    if (!items.length) return;
    if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIdx = Math.min(activeIdx + 1, items.length - 1);
        updateActive(items);
    } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIdx = Math.max(activeIdx - 1, 0);
        updateActive(items);
    } else if (e.key === "Enter" && activeIdx >= 0) {
        e.preventDefault();
        items[activeIdx].click();
    } else if (e.key === "Escape") {
        suggestionsBox.hidden = true;
    }
});
document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) suggestionsBox.hidden = true;
});
function updateActive(items) {
    items.forEach((el, i) => el.classList.toggle("active", i === activeIdx));
    if (activeIdx >= 0) items[activeIdx].scrollIntoView({ block: "nearest" });
}
async function fetchSuggestions(q) {
    try {
        const data = await api(`/autocomplete?q=${encodeURIComponent(q)}&limit=8`);
        renderSuggestions(data.suggestions);
    } catch {
        suggestionsBox.hidden = true;
    }
}
function renderSuggestions(suggestions) {
    if (!suggestions.length) { suggestionsBox.hidden = true; return; }
    suggestionsBox.innerHTML = suggestions
        .map((s, i) => `
            <div class="suggestion" data-idx="${i}" data-term="${escapeAttr(s.term)}">
                <div class="term">${escapeHtml(s.term)}</div>
                ${s.definition ? `<div class="def">${escapeHtml(s.definition)}</div>` : ""}
                ${s.aliases.length ? `<div class="alias">aka ${s.aliases.map(escapeHtml).join(", ")}</div>` : ""}
            </div>`)
        .join("");
    activeIdx = -1;
    suggestionsBox.hidden = false;
    suggestionsBox.querySelectorAll(".suggestion").forEach((el) => {
        el.addEventListener("click", () => {
            const term = el.dataset.term;
            searchInput.value = "";
            suggestionsBox.hidden = true;
            openTermModal(term);
        });
    });
}

// ----- Audit -----
const auditText = document.getElementById("auditText");
const auditUrl = document.getElementById("auditUrl");
const auditFileInput = document.getElementById("auditFile");
const auditFileName = document.getElementById("auditFileName");
const auditOutput = document.getElementById("auditOutput");
const auditMeta = document.getElementById("auditMeta");
const downloadBtn = document.getElementById("downloadAuditBtn");
const copyMdBtn = document.getElementById("copyMarkdownBtn");
let lastAuditReport = null;
let currentAuditSource = "text";

// Source tab switching.
document.querySelectorAll(".audit-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        currentAuditSource = tab.dataset.source;
        document.querySelectorAll(".audit-tab").forEach((t) => t.classList.toggle("active", t === tab));
        document.querySelectorAll(".audit-source-pane").forEach((p) => {
            p.hidden = p.dataset.pane !== currentAuditSource;
        });
    });
});

auditFileInput?.addEventListener("change", () => {
    const f = auditFileInput.files?.[0];
    if (f) {
        auditFileName.textContent = `${f.name} · ${(f.size / 1024).toFixed(1)} KB`;
        auditFileName.hidden = false;
    } else {
        auditFileName.hidden = true;
    }
});

document.getElementById("runAuditBtn").addEventListener("click", runAudit);
document.getElementById("clearAuditBtn").addEventListener("click", () => {
    auditText.value = "";
    if (auditUrl) auditUrl.value = "";
    if (auditFileInput) auditFileInput.value = "";
    if (auditFileName) auditFileName.hidden = true;
    auditOutput.innerHTML = `<div class="empty">${escapeHtml(t("audit.empty"))}</div>`;
    auditMeta.hidden = true;
    downloadBtn.disabled = true;
    copyMdBtn.disabled = true;
    lastAuditReport = null;
});
document.getElementById("loadSampleBtn").addEventListener("click", () => {
    currentAuditSource = "text";
    document.querySelectorAll(".audit-tab").forEach((t) => t.classList.toggle("active", t.dataset.source === "text"));
    document.querySelectorAll(".audit-source-pane").forEach((p) => { p.hidden = p.dataset.pane !== "text"; });
    auditText.value = SAMPLE_TEXT;
});
downloadBtn.addEventListener("click", () => {
    if (!lastAuditReport) return;
    const blob = new Blob([JSON.stringify(lastAuditReport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ethicalstack-audit.json"; a.click();
    URL.revokeObjectURL(url);
});
copyMdBtn.addEventListener("click", async () => {
    if (!lastAuditReport) return;
    await navigator.clipboard.writeText(reportToMarkdown(lastAuditReport));
    toast(t("audit.copied_md"));
});

// Ctrl/Cmd + Enter shortcut from the textarea.
auditText.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        runAudit();
    }
});
// Global "/" focuses search.
document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchInput.focus();
    }
});

async function runAudit() {
    let report;
    let label = "";
    let runningLabel = t("audit.running");
    try {
        if (currentAuditSource === "url") {
            const url = (auditUrl?.value || "").trim();
            if (!url) { toast(t("audit.url_required")); return; }
            label = url;
            runningLabel = t("audit.fetching");
            auditOutput.innerHTML = `<div class="empty"><span class="spinner"></span>${escapeHtml(runningLabel)}</div>`;
            report = await api("/audit/url", { method: "POST", body: JSON.stringify({ url }) });
        } else if (currentAuditSource === "file") {
            const f = auditFileInput?.files?.[0];
            if (!f) { toast(t("audit.file_required")); return; }
            label = f.name;
            runningLabel = t("audit.fetching");
            auditOutput.innerHTML = `<div class="empty"><span class="spinner"></span>${escapeHtml(runningLabel)}</div>`;
            const form = new FormData();
            form.append("file", f);
            const res = await fetch(`${API_BASE}/audit/file`, { method: "POST", body: form });
            if (!res.ok) {
                let msg = `${res.status} ${res.statusText}`;
                try { const j = await res.json(); msg = j?.error?.message || j?.detail || msg; } catch {}
                throw new Error(msg);
            }
            report = await res.json();
        } else {
            const text = auditText.value.trim();
            if (!text) { toast(t("audit.paste_first")); return; }
            label = text;
            auditOutput.innerHTML = `<div class="empty"><span class="spinner"></span>${escapeHtml(runningLabel)}</div>`;
            report = await api("/audit", { method: "POST", body: JSON.stringify({ text }) });
        }
        lastAuditReport = report;
        downloadBtn.disabled = false;
        copyMdBtn.disabled = false;
        renderAudit(report);
        recordAudit(label, report);
    } catch (err) {
        auditOutput.innerHTML = `<div class="empty">${escapeHtml(t("audit.failed"))} ${escapeHtml(err.message)}</div>`;
    }
}

function updateBackendPill(report) {
    const pill = document.getElementById("backendPill");
    const label = document.getElementById("backendLabel");
    if (!pill || !label) return;
    pill.classList.remove("gemini", "heuristic");
    if (report.backend === "gemini") {
        pill.classList.add("gemini");
        label.textContent = report.model || "Gemini 3.1 Flash Lite";
    } else {
        pill.classList.add("heuristic");
        label.textContent = t("audit.backend_fallback");
    }
}

function renderAudit(report) {
    const sevClass = `severity-${report.overall_severity}`;
    updateBackendPill(report);
    auditMeta.hidden = false;
    auditMeta.innerHTML = `
        <span><strong>${report.match_count}</strong> ${escapeHtml(t("audit.matches"))}</span>
        <span><strong>${report.word_count}</strong> ${escapeHtml(t("audit.words"))}</span>
        <span>${escapeHtml(t("audit.coverage"))} <strong>${(report.coverage_score * 100).toFixed(0)}%</strong></span>
        <span>${escapeHtml(t("audit.density"))} <strong>${report.term_density.toFixed(3)}</strong></span>
        <span>${escapeHtml(t("audit.backend"))} <strong>${escapeHtml(report.backend || "keyword")}</strong></span>
    `;

    const cats = report.categories.map((c) => {
        const sevTier = c.severity === "ok" ? "ok" : c.severity === "warn" ? "warn" : "gap";
        const sevLabel = c.severity === "ok" ? "covered" : c.severity === "warn" ? "partial" : "gap";
        const pct = Math.round((c.score || 0) * 100);
        const evidenceList = (c.evidence || []).map((e) => `<div>"${escapeHtml(e)}"</div>`).join("");
        const gapList = (c.category_gaps || []).map((g) => `<li>${escapeHtml(g)}</li>`).join("");
        return `
        <div class="cat">
            <div class="cat-head">
                <h4>${escapeHtml(c.label)}</h4>
                <span class="badge ${sevTier}">${sevLabel}</span>
            </div>
            <div class="desc">${escapeHtml(c.description)}</div>
            <div class="score-bar"><div class="score-bar-fill ${sevTier}" style="width:${pct}%"></div></div>
            <div class="score-row"><span>score</span><span>${pct}/100</span></div>
            ${evidenceList ? `<div class="evidence"><div class="evidence-list">${evidenceList}</div></div>` : ""}
            ${gapList ? `<ul class="gaps">${gapList}</ul>` : ""}
            ${c.matched_terms?.length ? `<div class="terms">${c.matched_terms.map((tr) => `<span data-term="${escapeAttr(tr)}">${escapeHtml(tr)}</span>`).join("")}</div>` : ""}
            ${c.recommendation ? `<div class="rec">${escapeHtml(c.recommendation)}</div>` : ""}
        </div>`;
    }).join("");

    const sevTier = report.overall_severity || "medium";
    auditOutput.innerHTML = `
        <div class="audit-summary ${sevClass}">
            <span class="severity-pill ${sevTier}">${escapeHtml(sevTier)} risk</span>
            ${escapeHtml(report.summary)}
        </div>
        ${report.gaps?.length ? `<div style="font-size:13px;margin-bottom:12px;color:var(--text-muted);"><strong style="color:var(--text);">${escapeHtml(t("audit.unaddressed"))}</strong> ${report.gaps.map(escapeHtml).join(" · ")}</div>` : ""}
        <div class="audit-grid-cats">${cats}</div>
    `;

    // Make matched-term chips clickable.
    auditOutput.querySelectorAll(".terms span[data-term]").forEach((el) => {
        el.addEventListener("click", () => openTermModal(el.dataset.term));
    });
}

function reportToMarkdown(r) {
    const lines = [];
    lines.push(`# AI Application Audit`);
    lines.push("");
    lines.push(`**Backend:** ${r.backend}${r.model ? ` (${r.model})` : ""}  `);
    lines.push(`**Overall severity:** ${r.overall_severity}  `);
    lines.push(`**Coverage:** ${(r.coverage_score * 100).toFixed(0)}%  `);
    lines.push(`**Words:** ${r.word_count} · **Glossary matches:** ${r.match_count}`);
    lines.push("");
    lines.push(`> ${r.summary}`);
    lines.push("");
    for (const c of r.categories) {
        lines.push(`## ${c.label} — ${(c.score * 100).toFixed(0)}/100 (${c.severity})`);
        lines.push(c.description);
        if (c.evidence?.length) {
            lines.push("");
            lines.push("**Evidence:**");
            for (const e of c.evidence) lines.push(`- "${e}"`);
        }
        if (c.category_gaps?.length) {
            lines.push("");
            lines.push("**Gaps:**");
            for (const g of c.category_gaps) lines.push(`- ${g}`);
        }
        if (c.recommendation) {
            lines.push("");
            lines.push(`**Recommendation:** ${c.recommendation}`);
        }
        lines.push("");
    }
    return lines.join("\n");
}

// ----- Audit history (localStorage) -----
function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
}
function saveHistory(h) { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX))); }
function recordAudit(text, report) {
    const h = loadHistory();
    h.unshift({
        ts: Date.now(),
        text,
        summary: report.summary,
        severity: report.overall_severity,
        coverage: report.coverage_score,
        backend: report.backend,
    });
    saveHistory(h);
    renderRecentHistory();
}
function renderRecentHistory() {
    const list = document.getElementById("historyList");
    if (!list) return;
    const h = loadHistory().slice(0, 5);
    if (!h.length) { list.innerHTML = `<div class="empty-mini">${escapeHtml(t("dash.recent_empty"))}</div>`; return; }
    list.innerHTML = h.map((item, i) => historyCardHtml(item, i)).join("");
    list.querySelectorAll(".history-item").forEach((el) => {
        el.addEventListener("click", () => {
            const idx = parseInt(el.dataset.idx, 10);
            const item = loadHistory()[idx];
            if (!item) return;
            auditText.value = item.text;
            navigate("audit");
            runAudit();
        });
    });
}
function renderFullHistory() {
    const list = document.getElementById("historyFull");
    if (!list) return;
    const h = loadHistory();
    if (!h.length) { list.innerHTML = `<div class="empty-mini">${escapeHtml(t("history.empty"))}</div>`; return; }
    list.innerHTML = h.map((item, i) => historyCardHtml(item, i)).join("");
    list.querySelectorAll(".history-item").forEach((el) => {
        el.addEventListener("click", () => {
            const idx = parseInt(el.dataset.idx, 10);
            const item = loadHistory()[idx];
            if (!item) return;
            auditText.value = item.text;
            navigate("audit");
            runAudit();
        });
    });
}
function historyCardHtml(item, idx) {
    const date = new Date(item.ts);
    const dateStr = date.toLocaleString(CURRENT_LANG === "ar" ? "ar" : "en");
    return `
        <div class="history-item" data-idx="${idx}">
            <div class="history-time">${escapeHtml(dateStr)}</div>
            <div class="history-summary">${escapeHtml(item.summary || "(no summary)")}</div>
            <div class="history-meta">
                <span class="severity-pill ${item.severity}">${escapeHtml(item.severity || "—")}</span>
                <span class="pill ${item.backend === "gemini" ? "gemini" : "heuristic"}">
                    <span class="dot"></span>${escapeHtml(item.backend || "—")}
                </span>
                <span class="pill">${(item.coverage * 100 || 0).toFixed(0)}%</span>
            </div>
        </div>`;
}
document.getElementById("clearHistoryBtn")?.addEventListener("click", () => {
    localStorage.removeItem(HISTORY_KEY);
    renderRecentHistory();
    renderFullHistory();
});

// ----- Glossary explorer -----
const explorerQuery = document.getElementById("explorerQuery");
const explorerLanguage = document.getElementById("explorerLanguage");
const explorerSemantic = document.getElementById("explorerSemantic");
const termList = document.getElementById("termList");
const pageInfo = document.getElementById("pageInfo");
const PAGE_SIZE = 12;
let page = 0;
let lastTotal = 0;
let lastEntries = [];

let explorerTimer = null;
[explorerQuery, explorerLanguage, explorerSemantic].forEach((el) =>
    el.addEventListener("input", () => {
        clearTimeout(explorerTimer);
        explorerTimer = setTimeout(() => { page = 0; loadTerms(); }, 200);
    })
);
document.getElementById("prevPage").addEventListener("click", () => { if (page > 0) { page--; loadTerms(); } });
document.getElementById("nextPage").addEventListener("click", () => {
    if ((page + 1) * PAGE_SIZE < lastTotal) { page++; loadTerms(); }
});

async function loadTerms() {
    const q = explorerQuery.value.trim();
    const lang = explorerLanguage.value;
    const offset = page * PAGE_SIZE;
    let endpoint;
    if (q && explorerSemantic.checked) endpoint = `/semantic-search?q=${encodeURIComponent(q)}&limit=${PAGE_SIZE}&offset=${offset}`;
    else if (q) endpoint = `/search?q=${encodeURIComponent(q)}&limit=${PAGE_SIZE}&offset=${offset}`;
    else endpoint = `/terms?limit=${PAGE_SIZE}&offset=${offset}`;
    if (lang) endpoint += `&language=${lang}`;

    termList.innerHTML = `<div class="empty-mini"><span class="spinner"></span>${escapeHtml(t("explorer.loading"))}</div>`;
    try {
        const data = await api(endpoint);
        const entries = (data.results || []).map((r) => r.entry || r);
        lastEntries = entries;
        lastTotal = data.total || entries.length;
        renderTerms(entries);
        pageInfo.textContent = `${offset + 1}-${Math.min(offset + entries.length, lastTotal)} / ${lastTotal}`;
    } catch (err) {
        termList.innerHTML = `<div class="empty-mini">${escapeHtml(t("explorer.failed"))} ${escapeHtml(err.message)}</div>`;
    }
}
function renderTerms(entries) {
    if (!entries.length) { termList.innerHTML = `<div class="empty-mini">${escapeHtml(t("explorer.no_results"))}</div>`; return; }
    termList.innerHTML = entries.map((e, i) => `
        <div class="term" data-idx="${i}">
            <div class="en">${escapeHtml(e.english_term)}</div>
            ${e.english_def ? `<div class="def">${escapeHtml(e.english_def)}</div>` : ""}
            <div class="langs">
                ${e.english_term ? `<span class="lang">EN</span>` : ""}
                ${e.arabic_term ? `<span class="lang">AR</span>` : ""}
                ${e.french_term ? `<span class="lang">FR</span>` : ""}
            </div>
            ${e.aliases?.length ? `<div class="alias-list">${escapeHtml(t("modal.aliases"))} ${e.aliases.map(escapeHtml).join(", ")}</div>` : ""}
        </div>`).join("");
    termList.querySelectorAll(".term").forEach((el) => {
        el.addEventListener("click", () => {
            const idx = parseInt(el.dataset.idx, 10);
            openTermModalEntry(lastEntries[idx]);
        });
    });
}

// ----- Term modal -----
const termModal = document.getElementById("termModal");
const modalBody = document.getElementById("modalBody");
document.getElementById("modalClose").addEventListener("click", closeTermModal);
termModal.addEventListener("click", (e) => { if (e.target === termModal) closeTermModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !termModal.hidden) closeTermModal(); });

async function openTermModal(term) {
    try {
        const entry = await api(`/terms/${encodeURIComponent(term)}`);
        openTermModalEntry(entry);
    } catch (err) {
        toast(`${t("explorer.failed")} ${err.message}`);
    }
}
function openTermModalEntry(entry) {
    if (!entry) return;
    const sections = [];
    if (entry.english_term) {
        sections.push(`
            <div class="modal-section">
                <div class="modal-lang-label"><span class="flag">EN</span>${escapeHtml(t("modal.lang_en"))}</div>
                <div class="modal-term">${escapeHtml(entry.english_term)}</div>
                <div class="modal-def">${entry.english_def ? escapeHtml(entry.english_def) : `<em>${escapeHtml(t("modal.no_def"))}</em>`}</div>
            </div>`);
    }
    if (entry.arabic_term || entry.arabic_def) {
        sections.push(`
            <div class="modal-section">
                <div class="modal-lang-label"><span class="flag">AR</span>${escapeHtml(t("modal.lang_ar"))}</div>
                <div class="modal-term ar">${escapeHtml(entry.arabic_term || "—")}</div>
                <div class="modal-def ar">${entry.arabic_def ? escapeHtml(entry.arabic_def) : `<em>${escapeHtml(t("modal.no_def"))}</em>`}</div>
            </div>`);
    }
    if (entry.french_term || entry.french_def) {
        sections.push(`
            <div class="modal-section">
                <div class="modal-lang-label"><span class="flag">FR</span>${escapeHtml(t("modal.lang_fr"))}</div>
                <div class="modal-term">${escapeHtml(entry.french_term || "—")}</div>
                <div class="modal-def">${entry.french_def ? escapeHtml(entry.french_def) : `<em>${escapeHtml(t("modal.no_def"))}</em>`}</div>
            </div>`);
    }
    if (entry.sources?.length) {
        sections.push(`
            <div class="modal-section">
                <div class="modal-lang-label">${escapeHtml(t("modal.sources"))}</div>
                <div class="modal-sources">${entry.sources.map((s) => `<span class="modal-source">${escapeHtml(s)}</span>`).join("")}</div>
            </div>`);
    }
    modalBody.innerHTML = `
        <h2 id="modalTitle">${escapeHtml(entry.english_term)}</h2>
        ${entry.aliases?.length ? `<div class="modal-aliases"><strong>${escapeHtml(t("modal.aliases"))}</strong> ${entry.aliases.map((a) => `<code>${escapeHtml(a)}</code>`).join(" ")}</div>` : ""}
        ${sections.join("")}
    `;
    termModal.hidden = false;
    document.body.style.overflow = "hidden";
}
function closeTermModal() {
    termModal.hidden = true;
    document.body.style.overflow = "";
    const modal = document.querySelector("#termModal .modal");
    modal.classList.remove("tool-modal");
}

// ----- Audit dimensions list (dashboard sidebar card) -----
const DIMENSIONS_PREVIEW = [
    { key: "bias_fairness", label: { en: "Bias & Fairness", ar: "التحيُّز والعدالة" }, desc: { en: "Disparate impact, demographic parity, protected groups.", ar: "الأثر التفاضلي وتكافؤ المجموعات والفئات المحمية." } },
    { key: "privacy_data_protection", label: { en: "Privacy & Data Protection", ar: "الخصوصية وحماية البيانات" }, desc: { en: "PII handling, consent, GDPR / PDPL compliance.", ar: "معالجة البيانات الشخصية والموافقة والامتثال." } },
    { key: "transparency_explainability", label: { en: "Transparency & Explainability", ar: "الشفافية وقابلية التفسير" }, desc: { en: "Model cards, datasheets, disclosure to users.", ar: "بطاقات النماذج والإفصاح للمستخدمين." } },
    { key: "accountability_governance", label: { en: "Accountability & Governance", ar: "المساءلة والحوكمة" }, desc: { en: "Responsibility, audit trails, compliance.", ar: "المسؤولية وسجلات التدقيق والامتثال." } },
    { key: "human_oversight", label: { en: "Human Oversight & Autonomy", ar: "الإشراف البشري والاستقلالية" }, desc: { en: "Override, contestability, meaningful agency.", ar: "التجاوز والطعن والقدرة على التأثير." } },
    { key: "safety_robustness", label: { en: "Safety & Robustness", ar: "السلامة والمتانة" }, desc: { en: "Adversarial robustness, alignment, failure modes.", ar: "المتانة العدائية والمواءمة وأنماط الفشل." } },
    { key: "cultural_linguistic_inclusivity", label: { en: "Cultural & Linguistic Inclusivity", ar: "الشمول الثقافي واللغوي" }, desc: { en: "Multilingual reach, low-resource languages, Arabic context.", ar: "تعدد اللغات واللغات منخفضة الموارد والسياق العربي." } },
    { key: "misuse_dual_use", label: { en: "Misuse & Dual-Use Risk", ar: "إساءة الاستخدام والاستخدام المزدوج" }, desc: { en: "Deepfakes, deception, weaponization, fraud.", ar: "التزييف العميق والخداع والاحتيال." } },
    { key: "stakeholder_impact", label: { en: "Stakeholder Impact & Inclusion", ar: "أثر أصحاب المصلحة والشمول" }, desc: { en: "Affected groups, vulnerable users, redress.", ar: "الفئات المتأثرة والمستخدمون المستضعفون والإنصاف." } },
    { key: "sustainability_lifecycle", label: { en: "Sustainability & Lifecycle", ar: "الاستدامة ودورة الحياة" }, desc: { en: "Carbon footprint, retraining, monitoring, sunset.", ar: "البصمة الكربونية وإعادة التدريب والمراقبة." } },
];
function renderDimensions() {
    const list = document.getElementById("dimList");
    if (!list) return;
    const lang = CURRENT_LANG === "ar" ? "ar" : "en";
    list.innerHTML = DIMENSIONS_PREVIEW.map((d, i) => `
        <li>
            <span class="dim-num">${String(i + 1).padStart(2, "0")}</span>
            <div class="dim-info">
                <div class="dim-label">${escapeHtml(d.label[lang])}</div>
                <div class="dim-desc">${escapeHtml(d.desc[lang])}</div>
            </div>
        </li>`).join("");
}

// ----- Copy buttons -----
function bindCopyButtons(root = document) {
    root.querySelectorAll("[data-copy]").forEach((btn) => {
        if (btn.dataset.copyBound) return;
        btn.dataset.copyBound = "1";
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(btn.dataset.copy).then(() => toast(t("toast.copied")));
        });
    });
}
bindCopyButtons();

// ----- Tool detail modal -----
const TOOL_DETAILS = {
    api: {
        icon: "⚡",
        title: { en: "FastAPI Backend", ar: "خدمة FastAPI" },
        tag: { en: "REST · OpenAPI · Async", ar: "REST · OpenAPI · غير متزامنة" },
        body: { en: `
            <h4>Endpoints</h4>
            <ul>
                <li><code>GET /terms/{term}</code> — exact lookup with all translations.</li>
                <li><code>GET /search?q=…</code> — prefix &amp; substring filter, paginated.</li>
                <li><code>GET /semantic-search?q=…</code> — Chroma + MiniLM cosine search.</li>
                <li><code>GET /autocomplete?q=…</code> — prefix-first, alias-aware suggestions.</li>
                <li><code>POST /annotate</code> — return all glossary spans in a piece of text.</li>
                <li><code>POST /audit</code> — full ethical-AI usage audit (Gemini 3.1 Flash Lite).</li>
                <li><code>GET /metrics</code> · <code>GET /version</code> · <code>GET /health</code>.</li>
            </ul>
            <h4>Stack</h4>
            <ul>
                <li>FastAPI 0.115 + Pydantic 2 + Uvicorn.</li>
                <li>Chroma vector index, sentence-transformers MiniLM embeddings.</li>
                <li>In-memory TTL cache (5 min) on read endpoints.</li>
                <li>Audit backed by official <code>google-genai</code> SDK with deterministic keyword fallback.</li>
            </ul>
            <h4>Run</h4>
<pre><code>cd api
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# OpenAPI: http://localhost:8000/docs</code></pre>`, ar: `
            <h4>نقاط النهاية</h4>
            <ul>
                <li><code>GET /terms/{term}</code> — بحث مطابق مع كل الترجمات.</li>
                <li><code>GET /search</code> — فلترة بالبادئة والاحتواء.</li>
                <li><code>GET /semantic-search</code> — بحث دلالي عبر Chroma وMiniLM.</li>
                <li><code>POST /audit</code> — تدقيق كامل للاستخدام الأخلاقي.</li>
            </ul>` },
        actions: [
            { kind: "primary", href: "https://hoarsely-penetralian-esperanza.ngrok-free.dev/docs", target: "_blank", label: { en: "Open API docs", ar: "وثائق الواجهة" } },
            { kind: "ghost", href: "https://hoarsely-penetralian-esperanza.ngrok-free.dev/health", target: "_blank", label: { en: "Health", ar: "حالة الخدمة" } },
        ],
    },
    mcp: {
        icon: "🧠",
        title: { en: "MCP Server", ar: "خادم MCP" },
        tag: { en: "Model Context Protocol · stdio", ar: "Model Context Protocol · stdio" },
        body: { en: `
            <h4>What it does</h4>
            <p>Exposes the glossary and audit as <em>Model Context Protocol</em> tools, so Claude Desktop, Cursor, or any
               MCP-aware client can call them without HTTP plumbing.</p>
            <h4>Tools provided</h4>
            <ul>
                <li><code>lookup_term</code> — exact glossary lookup with all translations.</li>
                <li><code>search_terms</code> — substring search across English / Arabic / French.</li>
                <li><code>semantic_search</code> — embedding-similarity search.</li>
                <li><code>annotate_text</code> — return glossary spans in a passage.</li>
                <li><code>audit_text</code> — full ethical-AI usage audit.</li>
                <li><code>glossary_stats</code> — coverage and dataset metadata.</li>
            </ul>
            <h4>Configure (Claude Desktop)</h4>
<pre><code>{
  "mcpServers": {
    "ethicalstack": {
      "command": "python",
      "args": ["server.py"],
      "cwd": "./mcp_server"
    }
  }
}</code></pre>
            <p>Drop the snippet into your <code>claude_desktop_config.json</code> and restart Claude Desktop.</p>`, ar: `
            <h4>ما يفعله</h4>
            <p>يكشف المعجم والتدقيق كأدوات MCP لتستخدمها Claude Desktop وCursor مباشرة.</p>` },
        actions: [
            { kind: "primary", copy: '{"mcpServers":{"ethicalstack":{"command":"python","args":["server.py"],"cwd":"./mcp_server"}}}', label: { en: "Copy MCP config", ar: "نسخ الإعدادات" } },
        ],
    },
    cli: {
        icon: "💻",
        title: { en: "Command-Line Tool", ar: "أداة سطر الأوامر" },
        tag: { en: "Python · zero-dep", ar: "Python · بدون تبعيات" },
        body: { en: `
            <h4>Commands</h4>
            <ul>
                <li><code>lookup &lt;term&gt;</code> — exact glossary lookup with translations.</li>
                <li><code>search &lt;query&gt;</code> — substring search across all three languages.</li>
                <li><code>semantic-search &lt;query&gt;</code> — embedding similarity, ranked.</li>
                <li><code>annotate &lt;file&gt;</code> — list every glossary term in a text file.</li>
                <li><code>audit &lt;file&gt;</code> — run the full ethical-AI usage audit.</li>
            </ul>
            <h4>Usage</h4>
<pre><code>python ethicalstack_cli.py lookup "Differential Privacy"
python ethicalstack_cli.py semantic-search "bias in data"
python ethicalstack_cli.py audit paper.txt --output report.json</code></pre>
            <p>Set <code>ETHICALSTACK_BASE_URL</code> or pass <code>--base-url</code> to point at a non-local API.</p>`, ar: `
            <h4>الأوامر</h4>
            <ul>
                <li><code>lookup</code> — بحث مطابق.</li>
                <li><code>search</code> — بحث جزئي.</li>
                <li><code>audit</code> — تدقيق كامل لملف نصي.</li>
            </ul>` },
        actions: [
            { kind: "primary", copy: "python cli/ethicalstack_cli.py --base-url http://localhost:8000 lookup 'Abduction'", label: { en: "Copy command", ar: "نسخ الأمر" } },
        ],
    },
    python: {
        icon: "🐍",
        title: { en: "Python SDK", ar: "حزمة Python" },
        tag: { en: "Sync + async · Pydantic types", ar: "متزامن وغير متزامن" },
        body: { en: `
            <h4>Why use it</h4>
            <p>Skip raw <code>requests</code> calls. The SDK gives you typed clients with built-in retry, async support,
               and the audit / annotate / search shapes pre-modelled.</p>
            <h4>Quickstart</h4>
<pre><code>from ethicalstack_client import Client
c = Client("http://localhost:8000")

c.lookup("Differential Privacy")
c.semantic_search("bias in data", limit=5)
report = c.audit(open("paper.txt").read())
print(report.overall_severity, report.coverage_score)</code></pre>
            <h4>Async</h4>
<pre><code>from ethicalstack_client import AsyncClient
import asyncio

async def main():
    async with AsyncClient("http://localhost:8000") as c:
        return await c.audit(text)
report = asyncio.run(main())</code></pre>`, ar: `
            <h4>الاستخدام</h4>
            <p>عميل Python بسيط بأنواع Pydantic مدمجة ودعم متزامن وغير متزامن.</p>` },
        actions: [
            { kind: "primary", copy: "pip install ethicalstack-client", label: { en: "Copy install command", ar: "نسخ أمر التثبيت" } },
        ],
    },
    js: {
        icon: "🟨",
        title: { en: "JavaScript / Node SDK", ar: "حزمة JavaScript" },
        tag: { en: "ESM · Browser & Node · TypeScript", ar: "ESM · للمتصفح وNode" },
        body: { en: `
            <h4>Quickstart</h4>
<pre><code>import { Client } from "ethicalstack-client";
const c = new Client("http://localhost:8000");

await c.lookup("Differential Privacy");
const report = await c.audit(text);
console.log(report.overall_severity);</code></pre>
            <h4>What's bundled</h4>
            <ul>
                <li>Same surface as the Python SDK — <code>lookup</code>, <code>search</code>, <code>semanticSearch</code>, <code>annotate</code>, <code>audit</code>.</li>
                <li>TypeScript declarations so editor autocomplete works out of the box.</li>
                <li>Works in modern browsers, Bun, Deno, and Node 18+.</li>
            </ul>`, ar: `<p>نفس الواجهة بأسلوب JavaScript للمتصفحات وNode.</p>` },
        actions: [
            { kind: "primary", copy: "npm install ethicalstack-client", label: { en: "Copy install command", ar: "نسخ أمر التثبيت" } },
        ],
    },
    vectordb: {
        icon: "🧬",
        title: { en: "Vector Database (Chroma)", ar: "قاعدة بيانات متجهية (Chroma)" },
        tag: { en: "Chroma · MiniLM · cosine", ar: "Chroma · MiniLM · جيب التمام" },
        body: { en: `
            <h4>What it does</h4>
            <p>Every glossary entry is embedded with <code>sentence-transformers/all-MiniLM-L6-v2</code> and persisted in a
               local <a href="https://www.trychroma.com/" target="_blank" rel="noopener">Chroma</a> collection on disk. The API,
               CLI, MCP server, and dashboard all share the same index for semantic lookup, retrieval-augmented audit, and
               concept similarity.</p>
            <h4>Highlights</h4>
            <ul>
                <li><strong>Persistent on disk</strong> at <code>data/chroma/</code> — built once, reused on every restart.</li>
                <li><strong>Cosine similarity</strong> over normalized 384-dim embeddings.</li>
                <li><strong>Idempotent ingestion</strong> — <code>ensure_index</code> is a no-op once populated.</li>
                <li>Backs <code>/semantic-search</code>, the MCP <code>semantic_search</code> tool, and the explorer's “Semantic search” toggle.</li>
            </ul>
            <h4>Use it</h4>
<pre><code>curl "http://localhost:8000/semantic-search?q=bias+in+training+data&amp;limit=5"

python -c "from api.app.vector_index import GlossaryVectorIndex
idx = GlossaryVectorIndex()
print(idx.search('explainability of decisions', limit=3))"</code></pre>`, ar: `
            <h4>ما تفعله</h4>
            <p>تُضمَّن كل مصطلحات المعجم بنموذج <code>MiniLM-L6-v2</code> وتُحفظ في فهرس <a href="https://www.trychroma.com/" target="_blank" rel="noopener">Chroma</a>
               محلي. تستخدمه الواجهة وسطر الأوامر وخادم MCP ولوحة التحكم للبحث الدلالي واسترجاع المفاهيم.</p>
            <h4>المزايا</h4>
            <ul>
                <li>تخزين دائم في <code>data/chroma/</code>.</li>
                <li>تشابه جيب التمام على متجهات بطول ٣٨٤.</li>
                <li>إعداد لمرّة واحدة، إعادة الاستخدام تلقائية.</li>
            </ul>` },
        actions: [
            { kind: "primary", copy: "curl 'http://localhost:8000/semantic-search?q=bias+in+training+data&limit=5'", label: { en: "Copy curl", ar: "نسخ الأمر" } },
        ],
    },
};

function openToolModal(toolKey) {
    const detail = TOOL_DETAILS[toolKey];
    if (!detail) return;
    const lang = CURRENT_LANG === "ar" ? "ar" : "en";
    const body = detail.body[lang] || detail.body.en;
    const actions = (detail.actions || []).map((a) => {
        const label = a.label[lang] || a.label.en;
        if (a.copy) {
            return `<button class="btn ${a.kind}" data-copy="${escapeAttr(a.copy)}">${escapeHtml(label)}</button>`;
        }
        const target = a.target ? ` target="${a.target}" rel="noopener"` : "";
        return `<a class="btn ${a.kind}" href="${escapeAttr(a.href)}"${target}>${escapeHtml(label)}</a>`;
    }).join("");

    const modal = document.querySelector("#termModal .modal");
    modal.classList.add("tool-modal");
    modalBody.innerHTML = `
        <div class="tool-modal-head">
            <div class="tool-modal-icon">${detail.icon}</div>
            <div>
                <div class="tool-modal-tag">${escapeHtml(detail.tag[lang] || detail.tag.en)}</div>
                <h2>${escapeHtml(detail.title[lang] || detail.title.en)}</h2>
            </div>
        </div>
        ${body}
        ${actions ? `<div class="tool-modal-actions">${actions}</div>` : ""}
    `;
    bindCopyButtons(modalBody);
    termModal.hidden = false;
    document.body.style.overflow = "hidden";
}

document.querySelectorAll(".tool[data-tool]").forEach((el) => {
    el.addEventListener("click", () => openToolModal(el.dataset.tool));
});

// ----- Live evaluator / benchmark -----
const benchTarget = document.getElementById("benchTarget");
const benchJudge = document.getElementById("benchJudge");
const benchSamples = document.getElementById("benchSamples");
const benchRunBtn = document.getElementById("benchRunBtn");
const benchStopBtn = document.getElementById("benchStopBtn");
const benchStatus = document.getElementById("benchStatus");
const benchProgressWrap = document.getElementById("benchProgressWrap");
const benchProgressFill = document.getElementById("benchProgressFill");
const benchProgressMeta = document.getElementById("benchProgressMeta");
const benchSummary = document.getElementById("benchSummary");
const benchTableWrap = document.getElementById("benchTableWrap");
const benchTableBody = document.getElementById("benchTableBody");

let benchModelsLoaded = false;
let benchAbortController = null;

async function ensureBenchModelsLoaded() {
    if (benchModelsLoaded || !benchTarget) return;
    try {
        const data = await api("/benchmark/models");
        const models = data.models || [];
        benchTarget.innerHTML = "";
        benchJudge.innerHTML = "";
        models.forEach((m) => {
            const labelSuffix = m.available ? "" : ` ${t("evaluator.unavailable")}`;
            const option = (sel) => {
                const o = document.createElement("option");
                o.value = m.id;
                o.textContent = `${m.label}${labelSuffix}`;
                if (!m.available) o.classList.add("bench-option-unavailable");
                if (m.default && sel === benchTarget) o.selected = true;
                if (m.id === "gemini/gemini-2.5-flash" && sel === benchJudge) o.selected = true;
                return o;
            };
            benchTarget.appendChild(option(benchTarget));
            benchJudge.appendChild(option(benchJudge));
        });
        benchModelsLoaded = true;
    } catch (err) {
        benchStatus.hidden = false;
        benchStatus.className = "bench-status bench-status-error";
        benchStatus.textContent = `${t("evaluator.no_models")} ${err.message}`;
    }
}

benchRunBtn?.addEventListener("click", runBenchmark);
benchStopBtn?.addEventListener("click", stopBenchmark);

function stopBenchmark() {
    if (benchAbortController) {
        benchAbortController.abort();
        benchAbortController = null;
    }
    benchRunBtn.disabled = false;
    benchStopBtn.disabled = true;
    benchStatus.hidden = false;
    benchStatus.className = "bench-status bench-status-warn";
    benchStatus.textContent = t("evaluator.stopped");
}

async function runBenchmark() {
    if (!benchTarget?.value) return;
    benchTableBody.innerHTML = "";
    benchSummary.hidden = true;
    benchSummary.innerHTML = "";
    benchTableWrap.hidden = false;
    benchProgressWrap.hidden = false;
    benchProgressFill.style.width = "0%";
    benchProgressMeta.textContent = "";
    benchStatus.hidden = false;
    benchStatus.className = "bench-status";
    benchStatus.textContent = t("evaluator.starting");
    benchRunBtn.disabled = true;
    benchStopBtn.disabled = false;

    const params = new URLSearchParams({
        target_model: benchTarget.value,
        judge_model: benchJudge.value,
        samples: String(Math.max(1, parseInt(benchSamples.value, 10) || 5)),
    });

    benchAbortController = new AbortController();
    try {
        const res = await fetch(`${API_BASE}/benchmark/stream?${params}`, {
            signal: benchAbortController.signal,
            headers: { "Accept": "text/event-stream", "ngrok-skip-browser-warning": "1" },
        });
        if (!res.ok) {
            let msg = `${res.status} ${res.statusText}`;
            try { const j = await res.json(); msg = j?.error?.message || j?.detail || msg; } catch {}
            throw new Error(msg);
        }
        await consumeSse(res, handleBenchEvent);
    } catch (err) {
        if (err.name !== "AbortError") {
            benchStatus.className = "bench-status bench-status-error";
            benchStatus.textContent = `${t("evaluator.failed")} ${err.message}`;
        }
    } finally {
        benchAbortController = null;
        benchRunBtn.disabled = false;
        benchStopBtn.disabled = true;
    }
}

async function consumeSse(response, onEvent) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const dataLines = chunk
                .split("\n")
                .filter((l) => l.startsWith("data:"))
                .map((l) => l.slice(5).trim());
            if (!dataLines.length) continue;
            try {
                const payload = JSON.parse(dataLines.join("\n"));
                onEvent(payload);
            } catch {
                // skip malformed
            }
        }
    }
}

function handleBenchEvent(ev) {
    switch (ev.type) {
        case "started":
            benchStatus.className = "bench-status";
            benchStatus.textContent = `${t("evaluator.running_term")} 0 / ${ev.total}`;
            benchProgressMeta.textContent = `0 / ${ev.total}`;
            return;
        case "item_start":
            benchStatus.textContent = `${t("evaluator.running_term")} ${ev.term}`;
            return;
        case "item_done": {
            const sevClass = ev.score >= 4 ? "ok" : ev.score >= 3 ? "warn" : ev.score > 0 ? "gap" : "muted";
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${ev.index + 1}</td>
                <td class="bench-term">${escapeHtml(ev.term)}</td>
                <td class="bench-cell-rtl">${escapeHtml(ev.explanation || "—")}</td>
                <td class="bench-cell-rtl">${escapeHtml(ev.ground_truth || "—")}</td>
                <td><span class="bench-score-pill bench-score-${sevClass}">${ev.score > 0 ? ev.score : "—"}</span></td>
            `;
            benchTableBody.prepend(row);
            const pct = ((ev.index + 1) / ev.total) * 100;
            benchProgressFill.style.width = `${pct}%`;
            benchProgressMeta.textContent = `${ev.index + 1} / ${ev.total}`;
            return;
        }
        case "item_error": {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${ev.index + 1}</td>
                <td class="bench-term">${escapeHtml(ev.term)}</td>
                <td colspan="2" class="bench-cell-error">${escapeHtml(ev.message || "error")}</td>
                <td><span class="bench-score-pill bench-score-muted">—</span></td>
            `;
            benchTableBody.prepend(row);
            return;
        }
        case "done": {
            benchStatus.className = "bench-status bench-status-ok";
            benchStatus.textContent = t("evaluator.done");
            benchProgressFill.style.width = "100%";
            renderBenchSummary(ev);
            return;
        }
        case "error":
            benchStatus.className = "bench-status bench-status-error";
            benchStatus.textContent = `${t("evaluator.failed")} ${ev.message}`;
            return;
    }
}

function renderBenchSummary(ev) {
    benchSummary.hidden = false;
    const histRows = Object.entries(ev.histogram || {})
        .sort((a, b) => Number(b[0]) - Number(a[0]))
        .map(([score, count]) => {
            const pct = ev.scored ? (count / ev.scored) * 100 : 0;
            return `
                <div class="bench-hist-row">
                    <span class="bench-hist-label">${score}</span>
                    <div class="bench-hist-bar"><div class="bench-hist-fill bench-score-${score >= 4 ? "ok" : score >= 3 ? "warn" : "gap"}" style="width:${pct}%"></div></div>
                    <span class="bench-hist-count">${count}</span>
                </div>`;
        }).join("");
    benchSummary.innerHTML = `
        <div class="bench-summary-stats">
            <div><span class="bench-stat-label">${escapeHtml(t("evaluator.avg"))}</span><span class="bench-stat-val">${(ev.average_score || 0).toFixed(2)} / 5</span></div>
            <div><span class="bench-stat-label">${escapeHtml(t("evaluator.scored"))}</span><span class="bench-stat-val">${ev.scored} / ${ev.total}</span></div>
            <div><span class="bench-stat-label">${escapeHtml(t("evaluator.duration"))}</span><span class="bench-stat-val">${ev.duration_seconds}s</span></div>
        </div>
        <div class="bench-hist">
            <div class="bench-hist-title">${escapeHtml(t("evaluator.histogram"))}</div>
            ${histRows}
        </div>`;
}

// ----- Utilities -----
function escapeHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escapeAttr(s) { return escapeHtml(s).replace(/'/g, "&#39;"); }
function toast(msg) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
}

const SAMPLE_TEXT = `Project: Public-sector AI assistant for processing residency-permit applications across multilingual cities.

We will deploy a large language model to draft initial decisions on residency-permit applications, with a human officer reviewing each draft before it becomes final. Training data: 6 years of historical decisions; we have not yet evaluated whether those decisions reflect demographic bias against specific nationalities or low-income applicants. The system processes applicant PII (passport, address, employment history); we mention "GDPR-style protections" but no DPIA has been completed and no consent flow is described. Outputs are presented in English only, even though most applicants submit Arabic and French documents — translation quality on Arabic dialects has not been measured. Applicants are not told an AI drafted the decision, and there is no published appeal process specific to AI-assisted outcomes. We have not red-teamed for prompt injection via uploaded documents and have no plan for monitoring drift, retraining, or sunsetting the model. A model card is "planned for Q3."`;

// ----- Init -----
document.addEventListener("languagechange", () => {
    renderDimensions();
    renderRecentHistory();
});
renderDimensions();
renderRecentHistory();
checkStatus();
loadTerms();
probeBackend();
navigate(location.hash.slice(1) || "dashboard");
