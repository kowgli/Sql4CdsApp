var Sql4CdsApp;
(function (Sql4CdsApp) {
    var SqlEditor;
    (function (SqlEditor) {
        const DEFAULT_SQL = `-- Write SQL here.
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
        function onLoad() {
            // ── Ace editor ─────────────────────────────────────────────────
            SqlEditor.editor = ace.edit("editor");
            SqlEditor.editor.setTheme("ace/theme/sqlserver");
            SqlEditor.editor.setOptions({ fontSize: "13px", showPrintMargin: false });
            SqlEditor.editor.commands.addCommand({ name: "runQuery", bindKey: { win: "Ctrl-Enter", mac: "Command-Enter" }, exec: () => SqlEditor.run() });
            SqlEditor.editor.commands.addCommand({ name: "newTab", bindKey: { win: "Ctrl-T", mac: "Command-T" }, exec: () => SqlEditor.newTab() });
            SqlEditor.editor.commands.addCommand({ name: "saveQuery", bindKey: { win: "Ctrl-S", mac: "Command-S" }, exec: () => SqlEditor.saveQuery() });
            // ── Autocomplete ───────────────────────────────────────────────
            SqlEditor.setupAutocomplete();
            // ── Tabulator grid ─────────────────────────────────────────────
            SqlEditor.table = new Tabulator("#grid", {
                layout: "fitDataFill",
                placeholder: "No results yet",
                height: "100%",
                selectable: true,
                clipboard: true
            });
            SqlEditor.table.on("tableBuilt", () => { SqlEditor.tableBuilt = true; SqlEditor.renderActiveTab(); });
            // ── DOM refs ───────────────────────────────────────────────────
            SqlEditor.statusEl = document.getElementById("status");
            SqlEditor.errorBox = document.getElementById("errorBox");
            SqlEditor.rowsInfo = document.getElementById("rowsInfo");
            SqlEditor.commandMessage = document.getElementById("commandMessage");
            SqlEditor.loadingOverlay = document.getElementById("loadingOverlay");
            SqlEditor.loadingTimer = document.getElementById("loadingTimer");
            SqlEditor.tabListEl = document.getElementById("tabList");
            SqlEditor.exportWrap = document.getElementById("exportWrap");
            // ── Toolbar buttons ────────────────────────────────────────────
            document.getElementById("runBtn").addEventListener("click", SqlEditor.run);
            document.getElementById("newTabBtn").addEventListener("click", SqlEditor.newTab);
            document.getElementById("clearBtn").addEventListener("click", () => {
                const tab = SqlEditor.getActiveTab();
                if (!tab)
                    return;
                tab.columns = tab.data = null;
                tab.commandMsg = tab.errorText = null;
                tab.rowsInfoText = "";
                tab.statusText = "Cleared";
                SqlEditor.renderActiveTab();
            });
            document.getElementById("formatBtn").addEventListener("click", () => {
                const sql = SqlEditor.editor.getValue();
                try {
                    SqlEditor.editor.setValue(sqlFormatter.format(sql, { language: "tsql" }), -1);
                    SqlEditor.setStatus("Formatted");
                }
                catch {
                    SqlEditor.setStatus("Format failed");
                }
            });
            document.getElementById("saveBtn").addEventListener("click", () => SqlEditor.saveQuery());
            document.getElementById("openBtn").addEventListener("click", () => SqlEditor.openQuery());
            document.getElementById("cancelBtn").addEventListener("click", () => {
                const tab = SqlEditor.getActiveTab();
                if (!tab)
                    return;
                tab.runGen++;
                tab.running = false;
                tab.loadStart = null;
                tab.statusText = "Cancelled";
                SqlEditor.hideLoading();
                SqlEditor.setStatus("Cancelled");
                SqlEditor.setRunning(false);
                SqlEditor.updateTabStrip();
            });
            // ── Settings popup ─────────────────────────────────────────────
            SqlEditor.applySettingsToUi();
            SqlEditor.applyAdminConstraints();
            SqlEditor.wireSettingsListeners();
            void SqlEditor.loadSettings();
            const settingsBtn = document.getElementById("settingsBtn");
            const settingsPopup = document.getElementById("settingsPopup");
            settingsBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const open = settingsPopup.classList.toggle("open");
                settingsBtn.setAttribute("aria-expanded", String(open));
            });
            settingsPopup.addEventListener("click", (e) => e.stopPropagation());
            document.addEventListener("click", () => {
                settingsPopup.classList.remove("open");
                settingsBtn.setAttribute("aria-expanded", "false");
            });
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape" && settingsPopup.classList.contains("open")) {
                    settingsPopup.classList.remove("open");
                    settingsBtn.setAttribute("aria-expanded", "false");
                }
            });
            // ── Export dropdown ────────────────────────────────────────────
            const exportToggleBtn = document.getElementById("exportToggleBtn");
            const exportPopup = document.getElementById("exportPopup");
            exportToggleBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const open = exportPopup.classList.toggle("open");
                if (open) {
                    const rect = exportToggleBtn.getBoundingClientRect();
                    exportPopup.style.top = (rect.bottom + 4) + "px";
                    exportPopup.style.right = (window.innerWidth - rect.right) + "px";
                }
                exportToggleBtn.setAttribute("aria-expanded", String(open));
            });
            exportPopup.addEventListener("click", (e) => e.stopPropagation());
            document.addEventListener("click", () => {
                exportPopup.classList.remove("open");
                exportToggleBtn.setAttribute("aria-expanded", "false");
            });
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape" && exportPopup.classList.contains("open")) {
                    exportPopup.classList.remove("open");
                    exportToggleBtn.setAttribute("aria-expanded", "false");
                }
            });
            document.getElementById("exportXlsxBtn").addEventListener("click", () => {
                var _a;
                const tab = SqlEditor.getActiveTab();
                if (!((_a = tab === null || tab === void 0 ? void 0 : tab.data) === null || _a === void 0 ? void 0 : _a.length))
                    return;
                exportPopup.classList.remove("open");
                exportToggleBtn.setAttribute("aria-expanded", "false");
                SqlEditor.table.download("xlsx", (tab.title || "results") + ".xlsx", { sheetName: "Results" });
            });
            document.getElementById("exportCsvBtn").addEventListener("click", () => {
                var _a;
                const tab = SqlEditor.getActiveTab();
                if (!((_a = tab === null || tab === void 0 ? void 0 : tab.data) === null || _a === void 0 ? void 0 : _a.length))
                    return;
                exportPopup.classList.remove("open");
                exportToggleBtn.setAttribute("aria-expanded", "false");
                SqlEditor.table.download("csv", (tab.title || "results") + ".csv");
            });
            document.getElementById("exportClipboardBtn").addEventListener("click", () => {
                var _a;
                const tab = SqlEditor.getActiveTab();
                if (!((_a = tab === null || tab === void 0 ? void 0 : tab.data) === null || _a === void 0 ? void 0 : _a.length) || !tab.columns)
                    return;
                exportPopup.classList.remove("open");
                exportToggleBtn.setAttribute("aria-expanded", "false");
                const text = SqlEditor.buildTabDelimited(tab);
                navigator.clipboard.writeText(text).then(() => {
                    const prev = SqlEditor.statusEl.textContent;
                    SqlEditor.setStatus("Copied to clipboard");
                    window.setTimeout(() => SqlEditor.setStatus(prev || ""), 2000);
                }).catch(() => SqlEditor.setStatus("Copy failed"));
            });
            // ── About modal ────────────────────────────────────────────────
            const aboutBtn = document.getElementById("aboutBtn");
            const aboutOverlay = document.getElementById("aboutOverlay");
            const aboutCloseBtn = document.getElementById("aboutCloseBtn");
            aboutBtn.addEventListener("click", () => aboutOverlay.classList.add("open"));
            aboutCloseBtn.addEventListener("click", () => aboutOverlay.classList.remove("open"));
            aboutOverlay.addEventListener("click", (e) => {
                if (e.target === aboutOverlay)
                    aboutOverlay.classList.remove("open");
            });
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape" && aboutOverlay.classList.contains("open"))
                    aboutOverlay.classList.remove("open");
            });
            // ── Dividers ───────────────────────────────────────────────────
            SqlEditor.setupDivider();
            // ── Object explorer ────────────────────────────────────────────
            SqlEditor.metaTreeEl = document.getElementById("metaTree");
            SqlEditor.refreshMetaBtn = document.getElementById("refreshMetaBtn");
            SqlEditor.refreshMetaBtn.addEventListener("click", () => { void SqlEditor.refreshMetadata(); });
            SqlEditor.setupMetaSearch();
            SqlEditor.setupMetaDivider();
            SqlEditor.setupMetaCollapse();
            void SqlEditor.initMetadata();
            // ── Window resize ──────────────────────────────────────────────
            window.addEventListener("resize", SqlEditor.onWindowResize);
            // ── First tab ──────────────────────────────────────────────────
            const first = SqlEditor.createTab(DEFAULT_SQL);
            SqlEditor.activeTabId = first.id;
            SqlEditor.editor.setSession(first.session);
            SqlEditor.updateTabStrip();
            SqlEditor.renderActiveTab();
        }
        SqlEditor.onLoad = onLoad;
    })(SqlEditor = Sql4CdsApp.SqlEditor || (Sql4CdsApp.SqlEditor = {}));
})(Sql4CdsApp || (Sql4CdsApp = {}));
document.addEventListener("readystatechange", () => {
    if (document.readyState === "complete")
        Sql4CdsApp.SqlEditor.onLoad();
});
//# sourceMappingURL=sqlEditor.main.js.map