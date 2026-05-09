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
        headers: { "Content-Type": "application/json" },
        ...opts,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
}

// ----- Routing (sidebar views) -----
const views = ["dashboard", "audit", "explorer", "tools", "history", "contribute"];

function navigate(view) {
    if (!views.includes(view)) view = "dashboard";
    document.querySelectorAll(".view").forEach((el) => el.classList.toggle("active", el.id === `view-${view}`));
    document.querySelectorAll(".side-link").forEach((el) => el.classList.toggle("active", el.dataset.view === view));
    if (location.hash !== `#${view}`) history.replaceState(null, "", `#${view}`);
    if (view === "history") renderFullHistory();
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
const auditOutput = document.getElementById("auditOutput");
const auditMeta = document.getElementById("auditMeta");
const downloadBtn = document.getElementById("downloadAuditBtn");
const copyMdBtn = document.getElementById("copyMarkdownBtn");
let lastAuditReport = null;

document.getElementById("runAuditBtn").addEventListener("click", runAudit);
document.getElementById("clearAuditBtn").addEventListener("click", () => {
    auditText.value = "";
    auditOutput.innerHTML = `<div class="empty">${escapeHtml(t("audit.empty"))}</div>`;
    auditMeta.hidden = true;
    downloadBtn.disabled = true;
    copyMdBtn.disabled = true;
    lastAuditReport = null;
});
document.getElementById("loadSampleBtn").addEventListener("click", () => {
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
    const text = auditText.value.trim();
    if (!text) { toast(t("audit.paste_first")); return; }
    auditOutput.innerHTML = `<div class="empty"><span class="spinner"></span>${escapeHtml(t("audit.running"))}</div>`;
    try {
        const report = await api("/audit", { method: "POST", body: JSON.stringify({ text }) });
        lastAuditReport = report;
        downloadBtn.disabled = false;
        copyMdBtn.disabled = false;
        renderAudit(report);
        recordAudit(text, report);
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
    extension: {
        icon: "🌐",
        title: { en: "Browser Extension", ar: "إضافة المتصفح" },
        tag: { en: "Manifest v3 · Chrome / Edge", ar: "Manifest v3 · Chrome / Edge" },
        body: { en: `
            <h4>What it does</h4>
            <p>Surfaces the ICAIRE ethical-AI glossary directly inside any web page. As you read, terms from the glossary are
               quietly highlighted in-place — hover any highlight for the definition without leaving your tab.</p>
            <h4>Highlights</h4>
            <ul>
                <li><strong>Auto-highlight on every page</strong> — terms from the glossary are detected on load.</li>
                <li><strong>Hover tooltip</strong> — definition + Arabic / French translations appear inline.</li>
                <li><strong>Right-click → Lookup</strong> on any selection.</li>
                <li><strong>Configurable API base URL</strong> (defaults to <code>http://localhost:8000</code>).</li>
                <li><strong>Themes &amp; language pairs</strong> in the options page (en-ar / ar-en / en-fr).</li>
                <li>Cache stored in <code>chrome.storage.local</code>; one network roundtrip per day.</li>
            </ul>
            <h4>Install</h4>
            <ul>
                <li>Download the <code>.zip</code>, extract.</li>
                <li><code>chrome://extensions</code> → enable <em>Developer mode</em> → <em>Load unpacked</em>.</li>
                <li>Open the options page to point it at your API URL.</li>
            </ul>`, ar: `
            <h4>ما تفعله</h4>
            <p>تُبرز الإضافة مصطلحات معجم ICAIRE الأخلاقي مباشرة داخل أي صفحة ويب. أثناء القراءة، تظهر المصطلحات
               بإبراز خفيف؛ مرّر المؤشر فوق أي مصطلح لرؤية تعريفه دون مغادرة الصفحة.</p>
            <h4>المزايا</h4>
            <ul>
                <li><strong>إبراز تلقائي في كل الصفحات</strong> عبر فحص النص عند التحميل.</li>
                <li><strong>تلميح عند التحويم</strong> يعرض التعريف والترجمات إلى العربية والفرنسية.</li>
                <li><strong>قائمة سياق</strong> للبحث عن أي نص محدد.</li>
                <li><strong>عنوان واجهة قابل للتعديل</strong> (افتراضياً <code>http://localhost:8000</code>).</li>
                <li><strong>سمات وأزواج لغوية</strong> قابلة للضبط من صفحة الخيارات.</li>
                <li>التخزين المحلي في <code>chrome.storage.local</code>؛ طلب شبكة واحد يومياً.</li>
            </ul>` },
        actions: [
            { kind: "primary", href: "/extension/download", label: { en: "Download .zip", ar: "تنزيل الإضافة" } },
            { kind: "ghost", href: "/dashboard/HUB.md", label: { en: "Install guide", ar: "دليل التثبيت" } },
        ],
    },
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
            { kind: "primary", href: "/docs", target: "_blank", label: { en: "Open API docs", ar: "وثائق الواجهة" } },
            { kind: "ghost", href: "/health", target: "_blank", label: { en: "Health", ar: "حالة الخدمة" } },
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
    evals: {
        icon: "📊",
        title: { en: "Evaluation Suite", ar: "مجموعة التقييمات" },
        tag: { en: "Reproducible benchmarks · CI-ready", ar: "اختبارات قابلة للاستنساخ" },
        body: { en: `
            <h4>What it measures</h4>
            <p><strong>This framework tests how accurately AI models explain AI concepts in Arabic compared to a ground truth dataset. It uses an LLM-as-a-judge approach to automatically score the outputs.</p>
            <h4>Run locally</h4>
<pre><code>cd evals

# Run a small test with 5 samples
python run_benchmark.py --samples 5

# Run with different models and save as JSON
python run_benchmark.py --target-model groq/llama3-8b-8192 --judge-model gemini/gemini-3.1-flash-lite --samples 50 --output results/my_test.json

# Run on the entire dataset (might take a long time and use many API calls!)
python run_benchmark.py --samples 0</code></pre>
            <p>Results land in <code>evals/results/&lt;timestamp&gt;.json</code> alongside a Markdown summary you can drop into a PR.</p>
            <h4>CI hook</h4>
            <p>The suite is wired to fail a build if regressions exceed configurable thresholds — drop it into GitHub
               Actions to gate dataset and prompt changes.</p>`, ar: `
            <h4>ما تقيسه</h4>
            <ul>
                <li>دقة البحث المطابق وبحث المرادفات.</li>
                <li>الاسترجاع الدلالي recall@k.</li>
                <li>معايرة التدقيق مقابل تصنيف بشري.</li>
                <li>تغطية لغوية متعددة (إنجليزي · عربي · فرنسي).</li>
                <li>زمن الاستجابة p50/p95.</li>
            </ul>
            <h4>التشغيل محلياً</h4>
<pre><code>cd evals
python run_benchmark.py --suite all --output results/</code></pre>` },
        actions: [
            { kind: "primary", copy: "cd evals && python run_benchmark.py --suite all", label: { en: "Copy run command", ar: "نسخ الأمر" } },
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
