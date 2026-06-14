namespace Sql4CdsApp.SqlEditor {

    // ── Status bar ─────────────────────────────────────────────────────
    export function setStatus(text: string) { statusEl.textContent = text; }

    export function setRunning(running: boolean) {
        (document.getElementById("runBtn")    as HTMLButtonElement).disabled = running;
        (document.getElementById("clearBtn")  as HTMLButtonElement).disabled = running;
        (document.getElementById("formatBtn") as HTMLButtonElement).disabled = running;
        (document.getElementById("saveBtn")   as HTMLButtonElement).disabled = running;
    }

    // ── Loading overlay ────────────────────────────────────────────────
    export function showLoading() {
        loadingOverlay.style.display = "flex";
        updateLoadingTimer();
        if (timerInterval === null)
            timerInterval = window.setInterval(updateLoadingTimer, 250);
    }

    function updateLoadingTimer() {
        const tab = getActiveTab();
        if (tab && tab.running && tab.loadStart)
            loadingTimer.textContent = Math.floor((Date.now() - tab.loadStart) / 1000) + "s";
    }

    export function hideLoading() {
        loadingOverlay.style.display = "none";
        if (timerInterval !== null) { clearInterval(timerInterval); timerInterval = null; }
    }

    // ── Error box ──────────────────────────────────────────────────────
    export function showError(errText: string) {
        errorBox.style.display = "block";
        errorBox.textContent = errText;
        editor.resize();
    }

    export function clearError() {
        errorBox.style.display = "none";
        errorBox.textContent = "";
        editor.resize();
    }

    // ── Command message (DML with no result set) ───────────────────────
    export function showCommandMessage(msg: string | null) {
        if (msg) {
            commandMessage.textContent = msg;
            commandMessage.style.display = "flex";
            document.getElementById("grid")!.style.display = "none";
        } else {
            commandMessage.style.display = "none";
            document.getElementById("grid")!.style.display = "";
        }
    }

    // ── Grid model builder ─────────────────────────────────────────────
    export function buildGridModel(result): { columns: any[]; data: any[] } {
        const cols = result.columns || [];
        const rows = result.rows || [];

        const columns = cols.map(c => ({ title: c, field: c, headerSort: true, resizable: true }));

        let data;
        if (rows.length > 0 && Array.isArray(rows[0])) {
            data = rows.map(r => { const o = {}; cols.forEach((c, i) => o[c] = r[i]); return o; });
        } else {
            data = rows;
        }

        return { columns, data };
    }

    // ── Settings UI ────────────────────────────────────────────────────
    export function applySettingsToUi() {
        for (const key of Object.keys(SETTING_IDS) as Array<keyof QuerySettings>) {
            const el = document.getElementById(SETTING_IDS[key]) as HTMLInputElement | null;
            if (el) el.checked = settings[key];
        }
    }

    export function wireSettingsListeners() {
        for (const key of Object.keys(SETTING_IDS) as Array<keyof QuerySettings>) {
            const el = document.getElementById(SETTING_IDS[key]) as HTMLInputElement | null;
            if (!el) continue;
            el.addEventListener("change", () => {
                settings[key] = el.checked;
                if (key === "autoSuggest")
                    (editor as any).setOptions({ enableLiveAutocompletion: settings.autoSuggest });
                void saveSettings();
            });
        }
    }

    export function applyAdminConstraints() {
        const el = document.getElementById(SETTING_IDS.bypassCustomPlugins) as HTMLInputElement | null;
        if (!el) return;
        el.disabled = !isSystemAdmin;
        if (!isSystemAdmin) { settings.bypassCustomPlugins = false; el.checked = false; }
        const lbl = el.closest("label") as HTMLElement | null;
        if (lbl) lbl.style.opacity = isSystemAdmin ? "" : "0.45";
    }

    // ── Record / grid view toggle ──────────────────────────────────────
    export function applyViewMode(tab: QueryTab) {
        const grid        = document.getElementById("grid")!;
        const recordView  = document.getElementById("recordView")!;
        const toggleBtn   = document.getElementById("viewToggleBtn") as HTMLButtonElement;
        const iconRecord  = document.getElementById("viewIconRecord") as any;
        const iconGrid    = document.getElementById("viewIconGrid") as any;
        const label       = document.getElementById("viewToggleLabel")!;
        const inRecordView = tab.recordViewMode && !!(tab.data && tab.data.length > 0);

        if (inRecordView) {
            grid.style.display        = "none";
            recordView.style.display  = "";
            renderRecordView(tab);
            iconRecord.style.display  = "none";
            iconGrid.style.display    = "";
            label.textContent         = "Grid view";
            toggleBtn.title           = "Switch to grid view";
            toggleBtn.setAttribute("aria-label", "Switch to grid view");
        } else {
            grid.style.display        = "";
            recordView.style.display  = "none";
            iconRecord.style.display  = "";
            iconGrid.style.display    = "none";
            label.textContent         = "Record view";
            toggleBtn.title           = "Switch to record view";
            toggleBtn.setAttribute("aria-label", "Switch to record view");
        }
    }

    export function renderRecordView(tab: QueryTab) {
        if (!tab.data?.length || !tab.columns) return;

        const total = tab.data.length;
        tab.recordIndex = Math.max(0, Math.min(total - 1, tab.recordIndex));
        const idx = tab.recordIndex;
        const row = tab.data[idx];

        const body = document.getElementById("recordBody")!;
        body.textContent = "";
        const frag = document.createDocumentFragment();
        for (const col of tab.columns) {
            const field   = col.field as string;
            const rowEl   = document.createElement("div");
            rowEl.className = "rec-row";

            const labelEl = document.createElement("div");
            labelEl.className   = "rec-label";
            labelEl.textContent = col.title || field;
            labelEl.title       = col.title || field;

            const valueEl = document.createElement("div");
            const val = row[field];
            if (val == null) {
                valueEl.className   = "rec-value rec-null";
                valueEl.textContent = "NULL";
            } else {
                valueEl.className   = "rec-value";
                valueEl.textContent = String(val);
            }

            rowEl.appendChild(labelEl);
            rowEl.appendChild(valueEl);
            frag.appendChild(rowEl);
        }
        body.appendChild(frag);

        (document.getElementById("recFirstBtn") as HTMLButtonElement).disabled = idx === 0;
        (document.getElementById("recPrevBtn")  as HTMLButtonElement).disabled = idx === 0;
        (document.getElementById("recNextBtn")  as HTMLButtonElement).disabled = idx === total - 1;
        (document.getElementById("recLastBtn")  as HTMLButtonElement).disabled = idx === total - 1;
        document.getElementById("recCounter")!.textContent = (idx + 1) + " / " + total;
    }

    export function navigateRecord(delta: number | "first" | "last") {
        const tab = getActiveTab();
        if (!tab?.data?.length) return;
        const total = tab.data.length;
        if (delta === "first")      tab.recordIndex = 0;
        else if (delta === "last")  tab.recordIndex = total - 1;
        else tab.recordIndex = Math.max(0, Math.min(total - 1, tab.recordIndex + delta));
        renderRecordView(tab);
    }

    // ── Window resize ──────────────────────────────────────────────────
    export function onWindowResize() {
        editor.resize();
        table.redraw(true);
    }
}
