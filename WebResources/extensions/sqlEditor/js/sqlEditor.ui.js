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
        // ── Record / grid view toggle ──────────────────────────────────────
        function applyViewMode(tab) {
            const grid = document.getElementById("grid");
            const recordView = document.getElementById("recordView");
            const toggleBtn = document.getElementById("viewToggleBtn");
            const iconRecord = document.getElementById("viewIconRecord");
            const iconGrid = document.getElementById("viewIconGrid");
            const label = document.getElementById("viewToggleLabel");
            const inRecordView = tab.recordViewMode && !!(tab.data && tab.data.length > 0);
            if (inRecordView) {
                grid.style.display = "none";
                recordView.style.display = "";
                renderRecordView(tab);
                iconRecord.style.display = "none";
                iconGrid.style.display = "";
                label.textContent = "Grid view";
                toggleBtn.title = "Switch to grid view";
                toggleBtn.setAttribute("aria-label", "Switch to grid view");
            }
            else {
                grid.style.display = "";
                recordView.style.display = "none";
                iconRecord.style.display = "";
                iconGrid.style.display = "none";
                label.textContent = "Record view";
                toggleBtn.title = "Switch to record view";
                toggleBtn.setAttribute("aria-label", "Switch to record view");
            }
        }
        SqlEditor.applyViewMode = applyViewMode;
        function renderRecordView(tab) {
            var _a;
            if (!((_a = tab.data) === null || _a === void 0 ? void 0 : _a.length) || !tab.columns)
                return;
            const total = tab.data.length;
            tab.recordIndex = Math.max(0, Math.min(total - 1, tab.recordIndex));
            const idx = tab.recordIndex;
            const row = tab.data[idx];
            const body = document.getElementById("recordBody");
            body.textContent = "";
            const frag = document.createDocumentFragment();
            for (const col of tab.columns) {
                const field = col.field;
                const rowEl = document.createElement("div");
                rowEl.className = "rec-row";
                const labelEl = document.createElement("div");
                labelEl.className = "rec-label";
                labelEl.textContent = col.title || field;
                labelEl.title = col.title || field;
                const valueEl = document.createElement("div");
                const val = row[field];
                if (val == null) {
                    valueEl.className = "rec-value rec-null";
                    valueEl.textContent = "NULL";
                }
                else {
                    valueEl.className = "rec-value";
                    valueEl.textContent = String(val);
                }
                rowEl.appendChild(labelEl);
                rowEl.appendChild(valueEl);
                frag.appendChild(rowEl);
            }
            body.appendChild(frag);
            document.getElementById("recFirstBtn").disabled = idx === 0;
            document.getElementById("recPrevBtn").disabled = idx === 0;
            document.getElementById("recNextBtn").disabled = idx === total - 1;
            document.getElementById("recLastBtn").disabled = idx === total - 1;
            document.getElementById("recCounter").textContent = (idx + 1) + " / " + total;
        }
        SqlEditor.renderRecordView = renderRecordView;
        function navigateRecord(delta) {
            var _a;
            const tab = SqlEditor.getActiveTab();
            if (!((_a = tab === null || tab === void 0 ? void 0 : tab.data) === null || _a === void 0 ? void 0 : _a.length))
                return;
            const total = tab.data.length;
            if (delta === "first")
                tab.recordIndex = 0;
            else if (delta === "last")
                tab.recordIndex = total - 1;
            else
                tab.recordIndex = Math.max(0, Math.min(total - 1, tab.recordIndex + delta));
            renderRecordView(tab);
        }
        SqlEditor.navigateRecord = navigateRecord;
        // ── Window resize ──────────────────────────────────────────────────
        function onWindowResize() {
            SqlEditor.editor.resize();
            SqlEditor.table.redraw(true);
        }
        SqlEditor.onWindowResize = onWindowResize;
    })(SqlEditor = Sql4CdsApp.SqlEditor || (Sql4CdsApp.SqlEditor = {}));
})(Sql4CdsApp || (Sql4CdsApp = {}));
//# sourceMappingURL=sqlEditor.ui.js.map