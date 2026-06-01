var Sql4CdsApp;
(function (Sql4CdsApp) {
    var SqlEditor;
    (function (SqlEditor) {
        // ── Status bar ─────────────────────────────────────────────────────
        function setStatus(text) { SqlEditor.statusEl.textContent = text; }
        SqlEditor.setStatus = setStatus;
        function setRunning(running) {
            document.getElementById("runBtn").disabled = running;
            document.getElementById("clearBtn").disabled = running;
            document.getElementById("formatBtn").disabled = running;
            document.getElementById("saveBtn").disabled = running;
        }
        SqlEditor.setRunning = setRunning;
        // ── Loading overlay ────────────────────────────────────────────────
        function showLoading() {
            SqlEditor.loadingOverlay.style.display = "flex";
            updateLoadingTimer();
            if (SqlEditor.timerInterval === null)
                SqlEditor.timerInterval = window.setInterval(updateLoadingTimer, 250);
        }
        SqlEditor.showLoading = showLoading;
        function updateLoadingTimer() {
            const tab = SqlEditor.getActiveTab();
            if (tab && tab.running && tab.loadStart)
                SqlEditor.loadingTimer.textContent = Math.floor((Date.now() - tab.loadStart) / 1000) + "s";
        }
        function hideLoading() {
            SqlEditor.loadingOverlay.style.display = "none";
            if (SqlEditor.timerInterval !== null) {
                clearInterval(SqlEditor.timerInterval);
                SqlEditor.timerInterval = null;
            }
        }
        SqlEditor.hideLoading = hideLoading;
        // ── Error box ──────────────────────────────────────────────────────
        function showError(errText) {
            SqlEditor.errorBox.style.display = "block";
            SqlEditor.errorBox.textContent = errText;
            SqlEditor.editor.resize();
        }
        SqlEditor.showError = showError;
        function clearError() {
            SqlEditor.errorBox.style.display = "none";
            SqlEditor.errorBox.textContent = "";
            SqlEditor.editor.resize();
        }
        SqlEditor.clearError = clearError;
        // ── Command message (DML with no result set) ───────────────────────
        function showCommandMessage(msg) {
            if (msg) {
                SqlEditor.commandMessage.textContent = msg;
                SqlEditor.commandMessage.style.display = "flex";
                document.getElementById("grid").style.display = "none";
            }
            else {
                SqlEditor.commandMessage.style.display = "none";
                document.getElementById("grid").style.display = "";
            }
        }
        SqlEditor.showCommandMessage = showCommandMessage;
        // ── Grid model builder ─────────────────────────────────────────────
        function buildGridModel(result) {
            const cols = result.columns || [];
            const rows = result.rows || [];
            const columns = cols.map(c => ({ title: c, field: c, headerSort: true, resizable: true }));
            let data;
            if (rows.length > 0 && Array.isArray(rows[0])) {
                data = rows.map(r => { const o = {}; cols.forEach((c, i) => o[c] = r[i]); return o; });
            }
            else {
                data = rows;
            }
            return { columns, data };
        }
        SqlEditor.buildGridModel = buildGridModel;
        // ── Settings UI ────────────────────────────────────────────────────
        function applySettingsToUi() {
            for (const key of Object.keys(SqlEditor.SETTING_IDS)) {
                const el = document.getElementById(SqlEditor.SETTING_IDS[key]);
                if (el)
                    el.checked = SqlEditor.settings[key];
            }
        }
        SqlEditor.applySettingsToUi = applySettingsToUi;
        function wireSettingsListeners() {
            for (const key of Object.keys(SqlEditor.SETTING_IDS)) {
                const el = document.getElementById(SqlEditor.SETTING_IDS[key]);
                if (!el)
                    continue;
                el.addEventListener("change", () => {
                    SqlEditor.settings[key] = el.checked;
                    if (key === "autoSuggest")
                        SqlEditor.editor.setOptions({ enableLiveAutocompletion: SqlEditor.settings.autoSuggest });
                    void SqlEditor.saveSettings();
                });
            }
        }
        SqlEditor.wireSettingsListeners = wireSettingsListeners;
        function applyAdminConstraints() {
            const el = document.getElementById(SqlEditor.SETTING_IDS.bypassCustomPlugins);
            if (!el)
                return;
            el.disabled = !SqlEditor.isSystemAdmin;
            if (!SqlEditor.isSystemAdmin) {
                SqlEditor.settings.bypassCustomPlugins = false;
                el.checked = false;
            }
            const lbl = el.closest("label");
            if (lbl)
                lbl.style.opacity = SqlEditor.isSystemAdmin ? "" : "0.45";
        }
        SqlEditor.applyAdminConstraints = applyAdminConstraints;
        // ── Window resize ──────────────────────────────────────────────────
        function onWindowResize() {
            SqlEditor.editor.resize();
            SqlEditor.table.redraw(true);
        }
        SqlEditor.onWindowResize = onWindowResize;
    })(SqlEditor = Sql4CdsApp.SqlEditor || (Sql4CdsApp.SqlEditor = {}));
})(Sql4CdsApp || (Sql4CdsApp = {}));
//# sourceMappingURL=sqlEditor.ui.js.map