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

    // ── Window resize ──────────────────────────────────────────────────
    export function onWindowResize() {
        editor.resize();
        table.redraw(true);
    }
}
