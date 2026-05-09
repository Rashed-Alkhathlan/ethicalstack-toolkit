// EthicalStack — i18n strings.
// Adding a language? Add the key to both maps and (if RTL) update I18N.dir.

const I18N = {
    dir: { en: "ltr", ar: "rtl" },
    label: { en: "EN", ar: "ع" },
    strings: {
        en: {
            "brand.sub": "Ethical AI Usage Auditor",
            "nav.dashboard": "Dashboard",
            "nav.audit": "Ethical Auditor",
            "nav.glossary": "Glossary",
            "nav.tools": "Tools",
            "nav.history": "History",
            "nav.contribute": "Contribute",
            "nav.api": "API Docs",
            "nav.repo": "Repository",

            "search.placeholder": "Search a term — e.g. 'Bias', 'Differential Privacy'",
            "status.checking": "checking…",
            "status.online": "API online",
            "status.offline": "API offline",

            "hero.eyebrow": "Glossary-grounded · Powered by Gemini 3.1 Flash Lite Preview",
            "hero.title_html": "Audit whether AI is being used <span class=\"grad\">ethically and responsibly</span>, in your real-world context.",
            "hero.subtitle": "Score papers, model cards, specs, syllabi, and proposals against ten ethical-AI usage dimensions — anchored in the ICAIRE multilingual glossary, with text-grounded evidence and concrete recommendations.",
            "hero.cta_primary": "Run an ethical audit",
            "hero.cta_secondary": "Browse glossary",

            "stats.terms": "Glossary terms",
            "stats.terms_meta": "EN · AR · FR",
            "stats.dimensions": "Ethical dimensions",
            "stats.dimensions_meta": "Responsible-AI usage focus",
            "stats.tools": "Tools & SDKs",
            "stats.tools_meta": "API · CLI · MCP · Ext",
            "stats.backend": "Audit backend",
            "stats.backend_meta_check": "checking…",
            "stats.backend_gemini": "Gemini 3.1 Flash Lite live",
            "stats.backend_heuristic": "Heuristic fallback",

            "dash.dimensions_title": "Ethical-usage dimensions",
            "dash.dimensions_sub": "Glossary-grounded scoring",
            "dash.recent_title": "Recent audits",
            "dash.recent_clear": "Clear",
            "dash.recent_empty": "No audits yet — paste some text into the auditor to get started.",

            "audit.title": "Ethical AI Usage Auditor",
            "audit.backend_fallback": "heuristic fallback",
            "audit.subtitle": "Paste an abstract, model card, technical spec, grant proposal, or syllabus. The auditor scores ten ethical-AI usage dimensions — anchored in the ICAIRE multilingual glossary — surfaces the evidence it found, and flags concrete responsible-AI gaps a reviewer should escalate.",
            "audit.input_placeholder": "Paste research paper, abstract, technical doc, or model card here…",
            "audit.run": "Run Audit",
            "audit.sample": "Load sample",
            "audit.clear": "Clear",
            "audit.download_json": "Download JSON",
            "audit.copy_md": "Copy as Markdown",
            "audit.kbd_run": "to run",
            "audit.empty": "Audit results will appear here.",
            "audit.running": "Auditing…",
            "audit.failed": "Audit failed:",
            "audit.paste_first": "Paste some text to audit first.",
            "audit.unaddressed": "Unaddressed dimensions:",
            "audit.matches": "glossary matches",
            "audit.words": "words",
            "audit.coverage": "coverage",
            "audit.density": "density",
            "audit.backend": "backend",
            "audit.copied_md": "Markdown copied to clipboard",

            "explorer.title": "Glossary Explorer",
            "explorer.subtitle": "normalized AI & data terms with English, Arabic, and French definitions and aliases. Click any term for details.",
            "explorer.filter": "Filter terms…",
            "explorer.lang_all": "All languages",
            "explorer.lang_en": "Has English",
            "explorer.lang_ar": "Has Arabic",
            "explorer.lang_fr": "Has French",
            "explorer.semantic": "Semantic search",
            "explorer.prev": "Prev",
            "explorer.next": "Next",
            "explorer.loading": "Loading…",
            "explorer.no_results": "No results.",
            "explorer.failed": "Failed:",

            "modal.aliases": "Aliases:",
            "modal.no_def": "(no definition available)",
            "modal.sources": "Sources",
            "modal.lang_en": "English",
            "modal.lang_ar": "Arabic",
            "modal.lang_fr": "French",

            "tools.title": "Tools & Downloads",
            "tools.subtitle": "Same backend, multiple surfaces. Pick the one that fits your workflow.",
            "tools.ext_title": "Browser Extension",
            "tools.ext_desc": "Highlight any term on any page → instant context, definition, and related terms.",
            "tools.ext_li_2": "Configurable API base URL",
            "tools.ext_li_3": "Selection & context-menu lookup",
            "tools.ext_dl": "Download .zip",
            "tools.api_title": "FastAPI Backend",
            "tools.api_desc": "REST endpoints for lookup, prefix & semantic search, annotation, and full ethical-AI usage audit.",
            "tools.api_li_1": "Chroma vector index (cosine, MiniLM)",
            "tools.api_li_3": "In-memory cache + metrics",
            "tools.api_dl": "Open API docs",
            "tools.mcp_title": "MCP Server",
            "tools.mcp_desc": "Plug the glossary into Claude Desktop, Cursor, or VS Code as a tool-calling MCP server.",
            "tools.mcp_li_1": "Tools: lookup, search, semantic, annotate",
            "tools.mcp_li_2": "stdio transport, zero deploy",
            "tools.mcp_copy": "Copy MCP config",
            "tools.cli_title": "CLI",
            "tools.cli_desc": "Terminal-first lookups, semantic search, and text annotation against the API.",
            "tools.cli_copy": "Copy command",
            "tools.py_title": "Python SDK",
            "tools.py_desc": "Zero-dependency drop-in client for the EthicalStack API.",
            "tools.js_title": "JS / Node SDK",
            "tools.js_desc": "Same API, idiomatic JavaScript. Browser- and Node-friendly.",
            "tools.evals_title": "Evaluation Suite",
            "tools.evals_desc": "Reproducible benchmarks for term lookup, semantic recall, audit calibration, and multilingual coverage.",
            "tools.more": "Read more →",

            "history.title": "Audit history",
            "history.subtitle": "Locally stored on this device — your last 20 audits.",
            "history.empty": "No audits yet.",
            "history.replay": "Replay",
            "history.delete": "Delete",

            "contrib.title": "Glossary Data & Contributing",
            "contrib.subtitle": "The dataset is open and reproducible. Bring corrections, aliases, or new terms.",
            "contrib.dataset": "Dataset",
            "contrib.source": "Source:",
            "contrib.pipeline": "Pipeline:",
            "contrib.outputs": "Outputs:",
            "contrib.versioning": "Versioning:",
            "contrib.view_meta": "View dataset_meta",
            "contrib.sample_json": "Sample JSON",
            "contrib.how": "How to contribute",
            "contrib.step1": "Edit the dataset xlsx or add aliases to data/aliases.json.",
            "contrib.step2": "Re-run python scripts/ingest_glossary.py to regenerate JSON / CSV.",
            "contrib.step3": "Run the eval suite: python evals/run_benchmark.py.",
            "contrib.step4": "Open a PR — the dataset hash updates automatically.",

            "toast.copied": "Copied to clipboard",
        },
        ar: {
            "brand.sub": "مُدقِّق الاستخدام الأخلاقي للذكاء الاصطناعي",
            "nav.dashboard": "لوحة القيادة",
            "nav.audit": "المُدقِّق الأخلاقي",
            "nav.glossary": "المعجم",
            "nav.tools": "الأدوات",
            "nav.history": "السجل",
            "nav.contribute": "المساهمة",
            "nav.api": "وثائق الواجهة",
            "nav.repo": "المستودع",

            "search.placeholder": "ابحث عن مصطلح — مثل: 'تحيّز'، 'الخصوصية التفاضلية'",
            "status.checking": "جارٍ التحقق…",
            "status.online": "الخدمة متصلة",
            "status.offline": "الخدمة غير متصلة",

            "hero.eyebrow": "مرتكِز على المعجم · مدعوم بـ Gemini 3.1 Flash Lite Preview",
            "hero.title_html": "دقِّق ما إذا كان الذكاء الاصطناعي <span class=\"grad\">يُستخدَم بشكل أخلاقي ومسؤول</span> في سياقك الفعلي.",
            "hero.subtitle": "قيِّم الأبحاث وبطاقات النماذج والمواصفات والمناهج والمقترحات وفق عشرة أبعاد للاستخدام الأخلاقي للذكاء الاصطناعي — مرتكِزة على معجم ICAIRE متعدد اللغات، مع أدلّة مستخرجة من النص وتوصيات عملية.",
            "hero.cta_primary": "ابدأ التدقيق الأخلاقي",
            "hero.cta_secondary": "تصفُّح المعجم",

            "stats.terms": "مصطلحات المعجم",
            "stats.terms_meta": "إنجليزي · عربي · فرنسي",
            "stats.dimensions": "الأبعاد الأخلاقية",
            "stats.dimensions_meta": "تركيز على الاستخدام المسؤول",
            "stats.tools": "الأدوات وحِزَم التطوير",
            "stats.tools_meta": "API · CLI · MCP · Ext",
            "stats.backend": "محرك التدقيق",
            "stats.backend_meta_check": "جارٍ التحقق…",
            "stats.backend_gemini": "Gemini 3.1 Flash Lite مفعَّل",
            "stats.backend_heuristic": "وضع احتياطي بالكلمات المفتاحية",

            "dash.dimensions_title": "أبعاد الاستخدام الأخلاقي",
            "dash.dimensions_sub": "تقييم مرتكِز على المعجم",
            "dash.recent_title": "آخر عمليات التدقيق",
            "dash.recent_clear": "مسح",
            "dash.recent_empty": "لا توجد عمليات تدقيق بعد — ألصق نصاً في المُدقِّق لتبدأ.",

            "audit.title": "مُدقِّق الاستخدام الأخلاقي للذكاء الاصطناعي",
            "audit.backend_fallback": "وضع احتياطي",
            "audit.subtitle": "ألصق ملخصاً، أو بطاقة نموذج، أو مواصفة تقنية، أو مقترح منحة، أو منهجاً دراسياً. يُقيِّم المُدقِّق عشرة أبعاد للاستخدام الأخلاقي للذكاء الاصطناعي — مرتكِزة على معجم ICAIRE متعدد اللغات — ويُبرز الأدلّة، ويُحدِّد فجوات المسؤولية الواجب رفعها للمراجع.",
            "audit.input_placeholder": "ألصق هنا الورقة البحثية، أو الملخص، أو الوثيقة التقنية، أو بطاقة النموذج…",
            "audit.run": "ابدأ التدقيق",
            "audit.sample": "نص تجريبي",
            "audit.clear": "مسح",
            "audit.download_json": "تنزيل JSON",
            "audit.copy_md": "نسخ بصيغة Markdown",
            "audit.kbd_run": "للتشغيل",
            "audit.empty": "ستظهر نتائج التدقيق هنا.",
            "audit.running": "جارٍ التدقيق…",
            "audit.failed": "فشل التدقيق:",
            "audit.paste_first": "ألصق نصاً للتدقيق أولاً.",
            "audit.unaddressed": "أبعاد لم تُعالَج:",
            "audit.matches": "تطابق معجمي",
            "audit.words": "كلمة",
            "audit.coverage": "التغطية",
            "audit.density": "الكثافة",
            "audit.backend": "المحرك",
            "audit.copied_md": "تم نسخ Markdown",

            "explorer.title": "مُتصفِّح المعجم",
            "explorer.subtitle": "مصطلح في الذكاء الاصطناعي والبيانات بتعريفات إنجليزية وعربية وفرنسية ومرادفات. اضغط أي مصطلح لعرض التفاصيل.",
            "explorer.filter": "تصفية المصطلحات…",
            "explorer.lang_all": "كل اللغات",
            "explorer.lang_en": "يحتوي على إنجليزية",
            "explorer.lang_ar": "يحتوي على عربية",
            "explorer.lang_fr": "يحتوي على فرنسية",
            "explorer.semantic": "بحث دلالي",
            "explorer.prev": "السابق",
            "explorer.next": "التالي",
            "explorer.loading": "جارٍ التحميل…",
            "explorer.no_results": "لا نتائج.",
            "explorer.failed": "فشل:",

            "modal.aliases": "مرادفات:",
            "modal.no_def": "(لا يوجد تعريف)",
            "modal.sources": "المصادر",
            "modal.lang_en": "الإنجليزية",
            "modal.lang_ar": "العربية",
            "modal.lang_fr": "الفرنسية",

            "tools.title": "الأدوات والتنزيلات",
            "tools.subtitle": "نفس الخدمة الخلفية، واجهات متعددة. اختر ما يناسب سير عملك.",
            "tools.ext_title": "إضافة المتصفح",
            "tools.ext_desc": "ظلِّل أي مصطلح في أي صفحة → سياق فوري، وتعريف، ومصطلحات ذات صلة.",
            "tools.ext_li_2": "عنوان الواجهة قابل للتعديل",
            "tools.ext_li_3": "بحث بالتظليل أو من قائمة السياق",
            "tools.ext_dl": "تنزيل الملف",
            "tools.api_title": "خدمة FastAPI",
            "tools.api_desc": "نقاط REST للبحث، والبحث الدلالي، والترقيم، والتدقيق الكامل.",
            "tools.api_li_1": "فهرس متجهات Chroma",
            "tools.api_li_3": "ذاكرة مؤقتة وقياسات",
            "tools.api_dl": "فتح وثائق الواجهة",
            "tools.mcp_title": "خادم MCP",
            "tools.mcp_desc": "استخدم المعجم داخل Claude Desktop أو Cursor أو VS Code.",
            "tools.mcp_li_1": "أدوات: بحث، دلالي، ترقيم",
            "tools.mcp_li_2": "نقل عبر stdio بلا نشر",
            "tools.mcp_copy": "نسخ إعدادات MCP",
            "tools.cli_title": "أداة سطر الأوامر",
            "tools.cli_desc": "بحث ودلالي وترقيم من الطرفية مباشرة.",
            "tools.cli_copy": "نسخ الأمر",
            "tools.py_title": "حزمة Python",
            "tools.py_desc": "عميل بسيط بدون تبعيات لخدمة EthicalStack.",
            "tools.js_title": "حزمة JS / Node",
            "tools.js_desc": "نفس الواجهة، بأسلوب JavaScript. تعمل في المتصفح وفي Node.",
            "tools.evals_title": "مجموعة التقييمات",
            "tools.evals_desc": "اختبارات قابلة للاستنساخ لقياس البحث والاسترجاع الدلالي ومعايرة التدقيق وتغطية اللغات.",
            "tools.more": "اقرأ المزيد ←",

            "history.title": "سجل التدقيق",
            "history.subtitle": "محفوظ محلياً على جهازك — آخر ٢٠ عملية.",
            "history.empty": "لا عمليات تدقيق بعد.",
            "history.replay": "إعادة التشغيل",
            "history.delete": "حذف",

            "contrib.title": "بيانات المعجم والمساهمة",
            "contrib.subtitle": "البيانات مفتوحة وقابلة للاستنساخ. شاركنا التصحيحات، أو المرادفات، أو المصطلحات الجديدة.",
            "contrib.dataset": "البيانات",
            "contrib.source": "المصدر:",
            "contrib.pipeline": "الخط:",
            "contrib.outputs": "المخرجات:",
            "contrib.versioning": "الإصدار:",
            "contrib.view_meta": "عرض البيانات الوصفية",
            "contrib.sample_json": "عيِّنة JSON",
            "contrib.how": "كيف تساهم",
            "contrib.step1": "عدِّل ملف xlsx أو أضف مرادفات إلى data/aliases.json.",
            "contrib.step2": "أعد تشغيل python scripts/ingest_glossary.py.",
            "contrib.step3": "شغِّل مجموعة التقييمات: python evals/run_benchmark.py.",
            "contrib.step4": "افتح طلب دمج — تحديث البصمة آلياً.",

            "toast.copied": "تم النسخ",
        },
    },
};

let CURRENT_LANG = localStorage.getItem("es:lang") || "en";

function t(key) {
    return I18N.strings[CURRENT_LANG]?.[key] ?? I18N.strings.en[key] ?? key;
}

function applyLanguage(lang) {
    if (!I18N.strings[lang]) return;
    CURRENT_LANG = lang;
    localStorage.setItem("es:lang", lang);
    const html = document.documentElement;
    html.setAttribute("lang", lang);
    html.setAttribute("dir", I18N.dir[lang] || "ltr");

    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.dataset.i18n;
        const val = t(key);
        if (key.endsWith("_html")) el.innerHTML = val;
        else el.textContent = val;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
    });

    // Special: hero title supports inline HTML so use the _html variant.
    const heroTitle = document.querySelector('[data-i18n="hero.title"]');
    if (heroTitle) heroTitle.innerHTML = t("hero.title_html");

    const langLabel = document.getElementById("langLabel");
    if (langLabel) langLabel.textContent = I18N.label[lang];

    document.dispatchEvent(new CustomEvent("languagechange", { detail: { lang } }));
}
