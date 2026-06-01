namespace Sql4CdsApp.SqlEditor {

    const DEFAULT_SQL =
`-- Write SQL here.
-- Ctrl+Enter to run.
SELECT TOP 100
  a.accountid,
  a.name,
  a.parentaccountid,
  a.parentaccountidname,
  c.fullname
FROM
  account a
  left join contact c on c.contactid = a.primarycontactid
WHERE
  a.statecode = 0
ORDER BY
  a.name
`;

    export function onLoad() {

        // ── Ace editor ─────────────────────────────────────────────────
        editor = ace.edit("editor");
        editor.setTheme("ace/theme/sqlserver");
        editor.setOptions({ fontSize: "13px", showPrintMargin: false });

        editor.commands.addCommand({ name: "runQuery",   bindKey: { win: "Ctrl-Enter", mac: "Command-Enter" }, exec: () => run() });
        editor.commands.addCommand({ name: "newTab",     bindKey: { win: "Ctrl-T",     mac: "Command-T"     }, exec: () => newTab() });
        editor.commands.addCommand({ name: "saveQuery",  bindKey: { win: "Ctrl-S",     mac: "Command-S"     }, exec: () => saveQuery() });

        // ── Autocomplete ───────────────────────────────────────────────
        setupAutocomplete();

        // ── Tabulator grid ─────────────────────────────────────────────
        table = new Tabulator("#grid", {
            layout:     "fitDataFill",
            placeholder: "No results yet",
            height:     "100%",
            selectable: true,
            clipboard:  true
        });
        table.on("tableBuilt", () => { tableBuilt = true; renderActiveTab(); });

        // ── DOM refs ───────────────────────────────────────────────────
        statusEl       = document.getElementById("status")!;
        errorBox       = document.getElementById("errorBox")!;
        rowsInfo       = document.getElementById("rowsInfo")!;
        commandMessage = document.getElementById("commandMessage")!;
        loadingOverlay = document.getElementById("loadingOverlay")!;
        loadingTimer   = document.getElementById("loadingTimer")!;
        tabListEl      = document.getElementById("tabList")!;
        exportWrap     = document.getElementById("exportWrap")!;

        // ── Toolbar buttons ────────────────────────────────────────────
        document.getElementById("runBtn")!.addEventListener("click", run);
        document.getElementById("newTabBtn")!.addEventListener("click", newTab);

        document.getElementById("clearBtn")!.addEventListener("click", () => {
            const tab = getActiveTab();
            if (!tab) return;
            tab.columns = tab.data = null;
            tab.commandMsg = tab.errorText = null;
            tab.rowsInfoText = "";
            tab.statusText = "Cleared";
            renderActiveTab();
        });

        document.getElementById("formatBtn")!.addEventListener("click", () => {
            const sql = editor.getValue();
            try {
                editor.setValue(sqlFormatter.format(sql, { language: "tsql" }), -1);
                setStatus("Formatted");
            } catch { setStatus("Format failed"); }
        });

        document.getElementById("saveBtn")!.addEventListener("click", () => saveQuery());
        document.getElementById("openBtn")!.addEventListener("click", () => openQuery());

        document.getElementById("cancelBtn")!.addEventListener("click", () => {
            const tab = getActiveTab();
            if (!tab) return;
            tab.runGen++;
            tab.running = false;
            tab.loadStart = null;
            tab.statusText = "Cancelled";
            hideLoading();
            setStatus("Cancelled");
            setRunning(false);
            updateTabStrip();
        });

        // ── Settings popup ─────────────────────────────────────────────
        applySettingsToUi();
        applyAdminConstraints();
        wireSettingsListeners();
        void loadSettings();

        const settingsBtn   = document.getElementById("settingsBtn")!;
        const settingsPopup = document.getElementById("settingsPopup")!;
        settingsBtn.addEventListener("click", (e: MouseEvent) => {
            e.stopPropagation();
            const open = settingsPopup.classList.toggle("open");
            settingsBtn.setAttribute("aria-expanded", String(open));
        });
        settingsPopup.addEventListener("click", (e: MouseEvent) => e.stopPropagation());
        document.addEventListener("click", () => {
            settingsPopup.classList.remove("open");
            settingsBtn.setAttribute("aria-expanded", "false");
        });
        document.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Escape" && settingsPopup.classList.contains("open")) {
                settingsPopup.classList.remove("open");
                settingsBtn.setAttribute("aria-expanded", "false");
            }
        });

        // ── Export dropdown ────────────────────────────────────────────
        const exportToggleBtn = document.getElementById("exportToggleBtn")!;
        const exportPopup     = document.getElementById("exportPopup")!;

        exportToggleBtn.addEventListener("click", (e: MouseEvent) => {
            e.stopPropagation();
            const open = exportPopup.classList.toggle("open");
            if (open) {
                const rect = exportToggleBtn.getBoundingClientRect();
                exportPopup.style.top   = (rect.bottom + 4) + "px";
                exportPopup.style.right = (window.innerWidth - rect.right) + "px";
            }
            exportToggleBtn.setAttribute("aria-expanded", String(open));
        });
        exportPopup.addEventListener("click", (e: MouseEvent) => e.stopPropagation());
        document.addEventListener("click", () => {
            exportPopup.classList.remove("open");
            exportToggleBtn.setAttribute("aria-expanded", "false");
        });
        document.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Escape" && exportPopup.classList.contains("open")) {
                exportPopup.classList.remove("open");
                exportToggleBtn.setAttribute("aria-expanded", "false");
            }
        });

        document.getElementById("exportXlsxBtn")!.addEventListener("click", () => {
            const tab = getActiveTab();
            if (!tab?.data?.length) return;
            exportPopup.classList.remove("open");
            exportToggleBtn.setAttribute("aria-expanded", "false");
            table.download("xlsx", (tab.title || "results") + ".xlsx", { sheetName: "Results" });
        });

        document.getElementById("exportCsvBtn")!.addEventListener("click", () => {
            const tab = getActiveTab();
            if (!tab?.data?.length) return;
            exportPopup.classList.remove("open");
            exportToggleBtn.setAttribute("aria-expanded", "false");
            table.download("csv", (tab.title || "results") + ".csv");
        });

        document.getElementById("exportClipboardBtn")!.addEventListener("click", () => {
            const tab = getActiveTab();
            if (!tab?.data?.length || !tab.columns) return;
            exportPopup.classList.remove("open");
            exportToggleBtn.setAttribute("aria-expanded", "false");
            const text = buildTabDelimited(tab);
            navigator.clipboard.writeText(text).then(() => {
                const prev = statusEl.textContent;
                setStatus("Copied to clipboard");
                window.setTimeout(() => setStatus(prev || ""), 2000);
            }).catch(() => setStatus("Copy failed"));
        });

        // ── About modal ────────────────────────────────────────────────
        const aboutBtn     = document.getElementById("aboutBtn")!;
        const aboutOverlay = document.getElementById("aboutOverlay")!;
        const aboutCloseBtn = document.getElementById("aboutCloseBtn")!;

        aboutBtn.addEventListener("click", () => aboutOverlay.classList.add("open"));
        aboutCloseBtn.addEventListener("click", () => aboutOverlay.classList.remove("open"));
        aboutOverlay.addEventListener("click", (e: MouseEvent) => {
            if (e.target === aboutOverlay) aboutOverlay.classList.remove("open");
        });
        document.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Escape" && aboutOverlay.classList.contains("open"))
                aboutOverlay.classList.remove("open");
        });

        // ── Dividers ───────────────────────────────────────────────────
        setupDivider();

        // ── Object explorer ────────────────────────────────────────────
        metaTreeEl     = document.getElementById("metaTree")!;
        refreshMetaBtn = document.getElementById("refreshMetaBtn") as HTMLButtonElement;
        refreshMetaBtn.addEventListener("click", () => { void refreshMetadata(); });
        setupMetaSearch();
        setupMetaDivider();
        setupMetaCollapse();
        void initMetadata();

        // ── Window resize ──────────────────────────────────────────────
        window.addEventListener("resize", onWindowResize);

        // ── First tab ──────────────────────────────────────────────────
        const first = createTab(DEFAULT_SQL);
        activeTabId = first.id;
        editor.setSession(first.session);
        updateTabStrip();
        renderActiveTab();
    }
}

document.addEventListener("readystatechange", () => {
    if (document.readyState === "complete") Sql4CdsApp.SqlEditor.onLoad();
});
