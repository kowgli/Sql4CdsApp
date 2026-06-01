namespace Sql4CdsApp.SqlEditor {

    // ── Dataverse custom action: execute SQL ───────────────────────────
    function buildFormattingInfo(): object {
        try {
            const us  = Xrm.Utility.getGlobalContext().userSettings;
            const dfi = us.dateFormattingInfo;
            return {
                languageId:      us.languageId,
                shortDatePattern: dfi.ShortDatePattern,
                shortTimePattern: dfi.ShortTimePattern,
                longDatePattern:  dfi.LongDatePattern,
                longTimePattern:  dfi.LongTimePattern,
                dateSeparator:    dfi.DateSeparator,
                timeSeparator:    dfi.TimeSeparator,
                amDesignator:     dfi.AmDesignator,
                pmDesignator:     dfi.PmDesignator
            };
        } catch {
            return {};
        }
    }

    async function executeQuery(sqlText: string) {
        const requestModel = {
            sql: sqlText,
            bypassCustomPlugins:     settings.bypassCustomPlugins,
            useLocalTimeZone:        settings.useLocalTimeZone,
            blockDeleteWithoutWhere: settings.blockDeleteWithoutWhere,
            blockUpdateWithoutWhere: settings.blockUpdateWithoutWhere,
            formattingInfo:          buildFormattingInfo()
        };

        const request = {
            Request: JSON.stringify(requestModel),
            getMetadata() {
                return {
                    boundParameter: null,
                    parameterTypes: { Request: { typeName: "Edm.String", structuralProperty: 1 } },
                    operationType:  0,
                    operationName:  "cd365_ExecSql"
                };
            }
        };

        const resp = await Xrm.WebApi.online.execute(request);
        const actionResponse = await resp.json();
        return JSON.parse(actionResponse.Response);
    }

    // ── Run flow ───────────────────────────────────────────────────────
    // Results are stored on the tab, so a query started on one tab keeps
    // running in the background when the user switches to another.
    export async function run() {
        const tab = getActiveTab();
        if (!tab) return;

        const selection = editor.session.getTextRange(editor.getSelectionRange());
        const sqlText   = selection.trim() ? selection : editor.getValue();

        tab.errorText  = null;
        tab.commandMsg = null;
        tab.statusText = "Running…";
        tab.running    = true;
        tab.loadStart  = Date.now();
        const myGen    = ++tab.runGen;

        if (tab.id === activeTabId) {
            clearError();
            setStatus("Running…");
            setRunning(true);
            showLoading();
        }
        updateTabStrip();

        try {
            const t0      = performance.now();
            const result  = await executeQuery(sqlText);
            const elapsed = (performance.now() - t0).toFixed(0);

            if (tab.runGen !== myGen) return;
            tab.running   = false;
            tab.loadStart = null;

            if (!result.isSuccess) {
                tab.errorText  = result.errorText || "Unknown error";
                tab.statusText = "Error";
            } else if (result.emptyResult) {
                tab.columns      = null;
                tab.data         = null;
                tab.commandMsg   = "Command executed successfully";
                tab.rowsInfoText = result.recordsAffected > 0
                    ? `${result.recordsAffected} row(s) affected` : "";
                tab.statusText   = `Done in ${elapsed} ms`;
            } else {
                const model      = buildGridModel(result);
                tab.columns      = model.columns;
                tab.data         = model.data;
                tab.commandMsg   = null;
                tab.rowsInfoText = `${model.data.length} rows`;
                tab.statusText   = `Done in ${elapsed} ms`;
            }
        } catch (e: any) {
            if (tab.runGen !== myGen) return;
            tab.running    = false;
            tab.loadStart  = null;
            tab.errorText  = e && e.stack ? e.stack : String(e);
            tab.statusText = "Error";
        } finally {
            if (tab.runGen === myGen) {
                if (tab.id === activeTabId) renderActiveTab();
                updateTabStrip();
            }
        }
    }

    // ── Dataverse custom action: load settings ─────────────────────────
    export async function loadSettings(): Promise<void> {
        try {
            const request = {
                getMetadata() {
                    return {
                        boundParameter: null,
                        parameterTypes: {},
                        operationType:  0,
                        operationName:  "cd365_LoadSettings"
                    };
                }
            };
            const resp   = await Xrm.WebApi.online.execute(request);
            const result = await resp.json();

            isSystemAdmin = result.IsSystemAdmin === true;

            if (result.Settings) {
                try {
                    const loaded = JSON.parse(result.Settings);
                    for (const key of Object.keys(SETTING_IDS) as Array<keyof QuerySettings>) {
                        if (key in loaded && typeof loaded[key] === "boolean")
                            settings[key] = loaded[key];
                    }
                } catch { /* malformed JSON — keep defaults */ }
            }
        } catch { /* network/plugin error — keep defaults, treat as non-admin */ }

        applySettingsToUi();
        applyAdminConstraints();
    }

    // ── Dataverse custom action: save settings ─────────────────────────
    export async function saveSettings(): Promise<void> {
        try {
            const request = {
                Settings: JSON.stringify(settings),
                getMetadata() {
                    return {
                        boundParameter: null,
                        parameterTypes: { Settings: { typeName: "Edm.String", structuralProperty: 1 } },
                        operationType:  0,
                        operationName:  "cd365_SaveSettings"
                    };
                }
            };
            await Xrm.WebApi.online.execute(request);
        } catch { /* best-effort — don't surface save errors */ }
    }
}
