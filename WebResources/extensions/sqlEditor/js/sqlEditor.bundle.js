/// <reference path="../../../node_modules/@types/ace/index.d.ts" />
/// <reference path="../../../node_modules/@types/tabulator/index.d.ts" />
var Sql4CdsApp;
(function (Sql4CdsApp) {
    var SqlEditor;
    (function (SqlEditor) {
        SqlEditor.tableBuilt = false;
        SqlEditor.timerInterval = null;
        SqlEditor.attributeCache = {};
        SqlEditor.entityList = [];
        SqlEditor.entityByName = {};
        // ── Settings ───────────────────────────────────────────────────────
        SqlEditor.SETTING_IDS = {
            bypassCustomPlugins: "optBypassPlugins",
            useLocalTimeZone: "optLocalTime",
            blockDeleteWithoutWhere: "optBlockDelete",
            blockUpdateWithoutWhere: "optBlockUpdate",
            autoSuggest: "optAutoSuggest"
        };
        SqlEditor.settings = {
            bypassCustomPlugins: false,
            useLocalTimeZone: true,
            blockDeleteWithoutWhere: true,
            blockUpdateWithoutWhere: true,
            autoSuggest: true
        };
        SqlEditor.isSystemAdmin = false;
    })(SqlEditor = Sql4CdsApp.SqlEditor || (Sql4CdsApp.SqlEditor = {}));
})(Sql4CdsApp || (Sql4CdsApp = {}));
//# sourceMappingURL=sqlEditor.state.js.map
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
var Sql4CdsApp;
(function (Sql4CdsApp) {
    var SqlEditor;
    (function (SqlEditor) {
        // ── Tab sequence counter ───────────────────────────────────────────
        let tabSeq = 0;
        // ── Multi-tab state ────────────────────────────────────────────────
        SqlEditor.tabs = [];
        SqlEditor.activeTabId = -1;
        // Small "×" built once as a DOM element and cloned per tab.
        const CLOSE_ICON_EL = (() => {
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("width", "10");
            svg.setAttribute("height", "10");
            svg.setAttribute("viewBox", "0 0 16 16");
            svg.setAttribute("fill", "currentColor");
            svg.setAttribute("aria-hidden", "true");
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", "M4.5 3.5L8 7l3.5-3.5 1 1L9 8l3.5 3.5-1 1L8 9l-3.5 3.5-1-1L7 8 3.5 4.5z");
            svg.appendChild(path);
            return svg;
        })();
        // ── Session factory ────────────────────────────────────────────────
        function makeSession(sql) {
            const session = ace.createEditSession(sql);
            session.setMode("ace/mode/sql");
            session.setUseWrapMode(true);
            session.setTabSize(2);
            session.setUseSoftTabs(true);
            return session;
        }
        // ── Tab CRUD ───────────────────────────────────────────────────────
        function getActiveTab() {
            return SqlEditor.tabs.filter(t => t.id === SqlEditor.activeTabId)[0];
        }
        SqlEditor.getActiveTab = getActiveTab;
        function createTab(initialSql) {
            const id = ++tabSeq;
            const tab = {
                id,
                title: "Query " + id,
                session: makeSession(initialSql),
                columns: null,
                data: null,
                commandMsg: null,
                rowsInfoText: "",
                errorText: null,
                statusText: "Ready",
                running: false,
                runGen: 0,
                loadStart: null
            };
            SqlEditor.tabs.push(tab);
            return tab;
        }
        SqlEditor.createTab = createTab;
        function newTab() {
            const tab = createTab("-- New query\n");
            SqlEditor.activeTabId = tab.id;
            SqlEditor.editor.setSession(tab.session);
            updateTabStrip();
            renderActiveTab();
            SqlEditor.editor.focus();
        }
        SqlEditor.newTab = newTab;
        function switchToTab(id) {
            if (id === SqlEditor.activeTabId)
                return;
            const tab = SqlEditor.tabs.filter(t => t.id === id)[0];
            if (!tab)
                return;
            SqlEditor.activeTabId = id;
            SqlEditor.editor.setSession(tab.session);
            updateTabStrip();
            renderActiveTab();
            SqlEditor.editor.focus();
        }
        SqlEditor.switchToTab = switchToTab;
        function closeTab(id) {
            let idx = -1;
            for (let i = 0; i < SqlEditor.tabs.length; i++) {
                if (SqlEditor.tabs[i].id === id) {
                    idx = i;
                    break;
                }
            }
            if (idx === -1)
                return;
            const tab = SqlEditor.tabs[idx];
            tab.runGen++;
            // Closing the only tab: reset in place rather than spawning a new one.
            if (SqlEditor.tabs.length === 1) {
                tab.session = makeSession("-- New query\n");
                tab.columns = tab.data = null;
                tab.commandMsg = tab.errorText = null;
                tab.rowsInfoText = "";
                tab.statusText = "Ready";
                tab.running = false;
                tab.loadStart = null;
                SqlEditor.editor.setSession(tab.session);
                updateTabStrip();
                renderActiveTab();
                SqlEditor.editor.focus();
                return;
            }
            const wasActive = (id === SqlEditor.activeTabId);
            SqlEditor.tabs.splice(idx, 1);
            if (wasActive) {
                const next = SqlEditor.tabs[Math.min(idx, SqlEditor.tabs.length - 1)];
                SqlEditor.activeTabId = next.id;
                SqlEditor.editor.setSession(next.session);
            }
            updateTabStrip();
            if (wasActive)
                renderActiveTab();
        }
        // ── Tab strip rendering ────────────────────────────────────────────
        function updateTabStrip() {
            SqlEditor.tabListEl.innerHTML = "";
            const frag = document.createDocumentFragment();
            for (const tab of SqlEditor.tabs)
                frag.appendChild(buildTabEl(tab));
            SqlEditor.tabListEl.appendChild(frag);
            const activeEl = SqlEditor.tabListEl.querySelector(".tab.active");
            if (activeEl && typeof activeEl.scrollIntoView === "function")
                activeEl.scrollIntoView({ inline: "nearest", block: "nearest" });
        }
        SqlEditor.updateTabStrip = updateTabStrip;
        function buildTabEl(tab) {
            const el = document.createElement("div");
            el.className = "tab" + (tab.id === SqlEditor.activeTabId ? " active" : "");
            el.dataset.id = String(tab.id);
            el.title = tab.title;
            if (tab.running) {
                const sp = document.createElement("span");
                sp.className = "tab-spinner";
                el.appendChild(sp);
            }
            const titleEl = document.createElement("span");
            titleEl.className = "tab-title";
            titleEl.textContent = tab.title;
            el.appendChild(titleEl);
            const close = document.createElement("button");
            close.className = "tab-close";
            close.title = "Close";
            close.setAttribute("aria-label", "Close " + tab.title);
            close.appendChild(CLOSE_ICON_EL.cloneNode(true));
            el.appendChild(close);
            el.addEventListener("mousedown", (e) => {
                if (e.button === 1) {
                    e.preventDefault();
                    closeTab(tab.id);
                }
                else if (e.button === 0)
                    switchToTab(tab.id);
            });
            close.addEventListener("mousedown", (e) => e.stopPropagation());
            close.addEventListener("click", (e) => { e.stopPropagation(); closeTab(tab.id); });
            return el;
        }
        // ── Render active tab (syncs all shared UI to the active tab state) ─
        function renderActiveTab() {
            const tab = getActiveTab();
            if (!tab)
                return;
            if (SqlEditor.editor.session !== tab.session)
                SqlEditor.editor.setSession(tab.session);
            if (tab.errorText)
                SqlEditor.showError(tab.errorText);
            else
                SqlEditor.clearError();
            if (tab.commandMsg)
                SqlEditor.showCommandMessage(tab.commandMsg);
            else
                SqlEditor.showCommandMessage(null);
            // Grid calls are only safe after Tabulator has finished building.
            if (SqlEditor.tableBuilt) {
                SqlEditor.table.setColumns(tab.columns || []);
                SqlEditor.table.setData(tab.data || []);
            }
            SqlEditor.rowsInfo.textContent = tab.rowsInfoText || "";
            SqlEditor.exportWrap.style.display = (tab.data && tab.data.length > 0) ? "" : "none";
            SqlEditor.setStatus(tab.statusText || "Ready");
            SqlEditor.setRunning(tab.running);
            if (tab.running)
                SqlEditor.showLoading();
            else
                SqlEditor.hideLoading();
            SqlEditor.editor.resize();
            if (SqlEditor.tableBuilt)
                SqlEditor.table.redraw(true);
        }
        SqlEditor.renderActiveTab = renderActiveTab;
    })(SqlEditor = Sql4CdsApp.SqlEditor || (Sql4CdsApp.SqlEditor = {}));
})(Sql4CdsApp || (Sql4CdsApp = {}));
//# sourceMappingURL=sqlEditor.tabs.js.map
var Sql4CdsApp;
(function (Sql4CdsApp) {
    var SqlEditor;
    (function (SqlEditor) {
        // ── Editor / results vertical splitter ─────────────────────────────
        function setupDivider() {
            const divider = document.getElementById("divider");
            const editorPanel = document.getElementById("editorPanel");
            const gridEl = document.getElementById("grid");
            const skeletonEl = document.getElementById("resizeSkeleton");
            const mainEl = document.getElementById("main");
            let isDragging = false;
            let startY = 0, startEditorH = 0, latestY = 0;
            let editorHeightPx = null;
            let gridDisplayBeforeDrag = "";
            let mainHCached = 0, divHCached = 0;
            let rafId = null;
            function applyDrag() {
                rafId = null;
                const minH = 80;
                const newH = Math.max(minH, Math.min(mainHCached - divHCached - minH, startEditorH + (latestY - startY)));
                editorHeightPx = newH;
                editorPanel.style.flex = `0 0 ${newH}px`;
                SqlEditor.editor.resize();
            }
            function stopDrag() {
                if (!isDragging)
                    return;
                isDragging = false;
                if (rafId !== null) {
                    cancelAnimationFrame(rafId);
                    rafId = null;
                }
                divider.classList.remove("dragging");
                document.body.style.userSelect = "";
                document.body.style.cursor = "";
                skeletonEl.style.display = "none";
                gridEl.style.display = gridDisplayBeforeDrag;
                SqlEditor.editor.resize();
                SqlEditor.table.redraw(true);
            }
            divider.addEventListener("pointerdown", (e) => {
                isDragging = true;
                startY = latestY = e.clientY;
                startEditorH = editorPanel.getBoundingClientRect().height;
                mainHCached = mainEl.getBoundingClientRect().height;
                divHCached = divider.offsetHeight;
                divider.setPointerCapture(e.pointerId);
                divider.classList.add("dragging");
                document.body.style.userSelect = "none";
                document.body.style.cursor = "ns-resize";
                gridDisplayBeforeDrag = gridEl.style.display;
                gridEl.style.display = "none";
                skeletonEl.style.display = "flex";
                e.preventDefault();
            });
            divider.addEventListener("pointermove", (e) => {
                if (!isDragging)
                    return;
                latestY = e.clientY;
                if (rafId === null)
                    rafId = requestAnimationFrame(applyDrag);
            });
            divider.addEventListener("pointerup", stopDrag);
            divider.addEventListener("pointercancel", stopDrag);
            divider.addEventListener("lostpointercapture", stopDrag);
            window.addEventListener("blur", stopDrag);
            window.addEventListener("resize", () => {
                if (editorHeightPx === null)
                    return;
                const maxH = mainEl.getBoundingClientRect().height - divider.offsetHeight - 80;
                if (editorHeightPx > maxH) {
                    editorHeightPx = Math.max(80, maxH);
                    editorPanel.style.flex = `0 0 ${editorHeightPx}px`;
                }
            });
        }
        SqlEditor.setupDivider = setupDivider;
        // ── Object explorer horizontal width splitter ───────────────────────
        function setupMetaDivider() {
            const divider = document.getElementById("metaDivider");
            const panel = document.getElementById("metaSide");
            const container = document.getElementById("app");
            let isDragging = false;
            let startX = 0, startW = 0, latestX = 0, wsWCached = 0;
            let widthPx = null;
            let rafId = null;
            function applyDrag() {
                rafId = null;
                const minW = 160;
                const maxW = Math.max(minW, wsWCached - 240);
                widthPx = Math.max(minW, Math.min(maxW, startW + (latestX - startX)));
                panel.style.flex = `0 0 ${widthPx}px`;
                SqlEditor.editor.resize();
            }
            function stopDrag() {
                if (!isDragging)
                    return;
                isDragging = false;
                if (rafId !== null) {
                    cancelAnimationFrame(rafId);
                    rafId = null;
                }
                divider.classList.remove("dragging");
                document.body.style.userSelect = "";
                document.body.style.cursor = "";
                SqlEditor.editor.resize();
                SqlEditor.table.redraw(true);
            }
            divider.addEventListener("pointerdown", (e) => {
                isDragging = true;
                startX = latestX = e.clientX;
                startW = panel.getBoundingClientRect().width;
                wsWCached = container.getBoundingClientRect().width;
                divider.setPointerCapture(e.pointerId);
                divider.classList.add("dragging");
                document.body.style.userSelect = "none";
                document.body.style.cursor = "ew-resize";
                e.preventDefault();
            });
            divider.addEventListener("pointermove", (e) => {
                if (!isDragging)
                    return;
                latestX = e.clientX;
                if (rafId === null)
                    rafId = requestAnimationFrame(applyDrag);
            });
            divider.addEventListener("pointerup", stopDrag);
            divider.addEventListener("pointercancel", stopDrag);
            divider.addEventListener("lostpointercapture", stopDrag);
            window.addEventListener("blur", stopDrag);
            window.addEventListener("resize", () => {
                if (widthPx === null || panel.classList.contains("collapsed"))
                    return;
                const maxW = container.getBoundingClientRect().width - 240;
                if (widthPx > maxW) {
                    widthPx = Math.max(160, maxW);
                    panel.style.flex = `0 0 ${widthPx}px`;
                }
            });
        }
        SqlEditor.setupMetaDivider = setupMetaDivider;
        // ── Object explorer collapse / expand ──────────────────────────────
        // Animates the container's flex-basis down to the rail width while the
        // panel layer crossfades into the rail — no width jump on either end.
        // The transition is class-gated so it never fires during divider drags.
        function setupMetaCollapse() {
            const side = document.getElementById("metaSide");
            const panel = document.getElementById("metadataPanel");
            const divider = document.getElementById("metaDivider");
            const collapseBtn = document.getElementById("collapseMetaBtn");
            const expandBtn = document.getElementById("expandMetaBtn");
            const railLabel = document.querySelector("#metaRail .meta-rail-label");
            const DURATION = 240;
            const RAIL_W = 34; // must match #metaRail width in CSS
            let collapsed = false;
            let expandedWidth = 220;
            function animateEditorDuring(duration) {
                const end = performance.now() + duration;
                (function step() {
                    SqlEditor.editor.resize();
                    if (performance.now() < end)
                        requestAnimationFrame(step);
                    else
                        SqlEditor.table.redraw(true);
                })();
            }
            function collapse() {
                if (collapsed)
                    return;
                collapsed = true;
                expandedWidth = Math.max(160, Math.round(side.getBoundingClientRect().width));
                panel.style.width = expandedWidth + "px";
                side.style.flexBasis = expandedWidth + "px";
                void side.offsetWidth;
                side.classList.add("meta-animating", "collapsed");
                side.style.flexBasis = RAIL_W + "px";
                divider.style.display = "none";
                animateEditorDuring(DURATION);
                window.setTimeout(() => { side.classList.remove("meta-animating"); SqlEditor.editor.resize(); SqlEditor.table.redraw(true); }, DURATION + 20);
            }
            function expand() {
                if (!collapsed)
                    return;
                collapsed = false;
                side.style.flexBasis = RAIL_W + "px";
                void side.offsetWidth;
                side.classList.add("meta-animating");
                side.classList.remove("collapsed");
                side.style.flexBasis = expandedWidth + "px";
                divider.style.display = "";
                animateEditorDuring(DURATION);
                window.setTimeout(() => { side.classList.remove("meta-animating"); panel.style.width = ""; SqlEditor.editor.resize(); SqlEditor.table.redraw(true); }, DURATION + 20);
            }
            collapseBtn.addEventListener("click", collapse);
            expandBtn.addEventListener("click", expand);
            if (railLabel)
                railLabel.addEventListener("click", expand);
        }
        SqlEditor.setupMetaCollapse = setupMetaCollapse;
    })(SqlEditor = Sql4CdsApp.SqlEditor || (Sql4CdsApp.SqlEditor = {}));
})(Sql4CdsApp || (Sql4CdsApp = {}));
//# sourceMappingURL=sqlEditor.dividers.js.map
var Sql4CdsApp;
(function (Sql4CdsApp) {
    var SqlEditor;
    (function (SqlEditor) {
        // ── Dataverse custom action: execute SQL ───────────────────────────
        async function executeQuery(sqlText) {
            const requestModel = {
                sql: sqlText,
                bypassCustomPlugins: SqlEditor.settings.bypassCustomPlugins,
                useLocalTimeZone: SqlEditor.settings.useLocalTimeZone,
                blockDeleteWithoutWhere: SqlEditor.settings.blockDeleteWithoutWhere,
                blockUpdateWithoutWhere: SqlEditor.settings.blockUpdateWithoutWhere
            };
            const request = {
                Request: JSON.stringify(requestModel),
                getMetadata() {
                    return {
                        boundParameter: null,
                        parameterTypes: { Request: { typeName: "Edm.String", structuralProperty: 1 } },
                        operationType: 0,
                        operationName: "cd365_ExecSql"
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
        async function run() {
            const tab = SqlEditor.getActiveTab();
            if (!tab)
                return;
            const selection = SqlEditor.editor.session.getTextRange(SqlEditor.editor.getSelectionRange());
            const sqlText = selection.trim() ? selection : SqlEditor.editor.getValue();
            tab.errorText = null;
            tab.commandMsg = null;
            tab.statusText = "Running…";
            tab.running = true;
            tab.loadStart = Date.now();
            const myGen = ++tab.runGen;
            if (tab.id === SqlEditor.activeTabId) {
                SqlEditor.clearError();
                SqlEditor.setStatus("Running…");
                SqlEditor.setRunning(true);
                SqlEditor.showLoading();
            }
            SqlEditor.updateTabStrip();
            try {
                const t0 = performance.now();
                const result = await executeQuery(sqlText);
                const elapsed = (performance.now() - t0).toFixed(0);
                if (tab.runGen !== myGen)
                    return;
                tab.running = false;
                tab.loadStart = null;
                if (!result.isSuccess) {
                    tab.errorText = result.errorText || "Unknown error";
                    tab.statusText = "Error";
                }
                else if (result.emptyResult) {
                    tab.columns = null;
                    tab.data = null;
                    tab.commandMsg = "Command executed successfully";
                    tab.rowsInfoText = result.recordsAffected > 0
                        ? `${result.recordsAffected} row(s) affected` : "";
                    tab.statusText = `Done in ${elapsed} ms`;
                }
                else {
                    const model = SqlEditor.buildGridModel(result);
                    tab.columns = model.columns;
                    tab.data = model.data;
                    tab.commandMsg = null;
                    tab.rowsInfoText = `${model.data.length} rows`;
                    tab.statusText = `Done in ${elapsed} ms`;
                }
            }
            catch (e) {
                if (tab.runGen !== myGen)
                    return;
                tab.running = false;
                tab.loadStart = null;
                tab.errorText = e && e.stack ? e.stack : String(e);
                tab.statusText = "Error";
            }
            finally {
                if (tab.runGen === myGen) {
                    if (tab.id === SqlEditor.activeTabId)
                        SqlEditor.renderActiveTab();
                    SqlEditor.updateTabStrip();
                }
            }
        }
        SqlEditor.run = run;
        // ── Dataverse custom action: load settings ─────────────────────────
        async function loadSettings() {
            try {
                const request = {
                    getMetadata() {
                        return {
                            boundParameter: null,
                            parameterTypes: {},
                            operationType: 0,
                            operationName: "cd365_LoadSettings"
                        };
                    }
                };
                const resp = await Xrm.WebApi.online.execute(request);
                const result = await resp.json();
                SqlEditor.isSystemAdmin = result.IsSystemAdmin === true;
                if (result.Settings) {
                    try {
                        const loaded = JSON.parse(result.Settings);
                        for (const key of Object.keys(SqlEditor.SETTING_IDS)) {
                            if (key in loaded && typeof loaded[key] === "boolean")
                                SqlEditor.settings[key] = loaded[key];
                        }
                    }
                    catch { /* malformed JSON — keep defaults */ }
                }
            }
            catch { /* network/plugin error — keep defaults, treat as non-admin */ }
            SqlEditor.applySettingsToUi();
            SqlEditor.applyAdminConstraints();
        }
        SqlEditor.loadSettings = loadSettings;
        // ── Dataverse custom action: save settings ─────────────────────────
        async function saveSettings() {
            try {
                const request = {
                    Settings: JSON.stringify(SqlEditor.settings),
                    getMetadata() {
                        return {
                            boundParameter: null,
                            parameterTypes: { Settings: { typeName: "Edm.String", structuralProperty: 1 } },
                            operationType: 0,
                            operationName: "cd365_SaveSettings"
                        };
                    }
                };
                await Xrm.WebApi.online.execute(request);
            }
            catch { /* best-effort — don't surface save errors */ }
        }
        SqlEditor.saveSettings = saveSettings;
    })(SqlEditor = Sql4CdsApp.SqlEditor || (Sql4CdsApp.SqlEditor = {}));
})(Sql4CdsApp || (Sql4CdsApp = {}));
//# sourceMappingURL=sqlEditor.api.js.map
var Sql4CdsApp;
(function (Sql4CdsApp) {
    var SqlEditor;
    (function (SqlEditor) {
        const ICON_TABLE_SVG = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
            '<path d="M1.5 2h13v12h-13V2zm1 1v2.5h11V3h-11zm0 3.5V9h4V6.5h-4zm5 0V9h6V6.5h-6zm-5 3.5v3h4v-3h-4zm5 0v3h6v-3h-6z"/></svg>';
        const ICON_FIELD_SVG = '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
            '<circle cx="8" cy="8" r="3.25"/></svg>';
        function parseSvg(svgString) {
            return new DOMParser().parseFromString(svgString, "image/svg+xml").documentElement;
        }
        // ── Dataverse metadata REST helper ─────────────────────────────────
        async function fetchMetadata(path) {
            const clientUrl = Xrm.Utility.getGlobalContext().getClientUrl();
            const resp = await fetch(clientUrl + "/api/data/v9.2/" + path, {
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "OData-MaxVersion": "4.0",
                    "OData-Version": "4.0"
                }
            });
            if (!resp.ok)
                throw new Error("Metadata request failed: " + resp.status + " " + resp.statusText);
            return resp.json();
        }
        SqlEditor.fetchMetadata = fetchMetadata;
        function bySchemaName(a, b) {
            return String(a.SchemaName).toLowerCase().localeCompare(String(b.SchemaName).toLowerCase());
        }
        // ── Attribute cache + fetcher (shared with autocomplete) ───────────
        async function getAttributes(logicalName) {
            let attrs = SqlEditor.attributeCache[logicalName];
            if (!attrs) {
                const data = await fetchMetadata("EntityDefinitions(LogicalName='" + logicalName +
                    "')/Attributes?$select=LogicalName,SchemaName,AttributeType");
                attrs = (data.value || []).filter(a => a.SchemaName).sort(bySchemaName);
                SqlEditor.attributeCache[logicalName] = attrs;
            }
            return attrs;
        }
        SqlEditor.getAttributes = getAttributes;
        // ── Tree status messages ───────────────────────────────────────────
        function setMetaTreeMessage(kind, text) {
            SqlEditor.metaTreeEl.textContent = "";
            const wrap = document.createElement("div");
            wrap.className = kind === "error" ? "meta-error" : "meta-loading";
            if (kind === "loading") {
                const spinner = document.createElement("span");
                spinner.className = "meta-spinner";
                wrap.appendChild(spinner);
            }
            const label = document.createElement("span");
            label.textContent = text;
            wrap.appendChild(label);
            SqlEditor.metaTreeEl.appendChild(wrap);
        }
        // ── Load / refresh entity list ─────────────────────────────────────
        async function initMetadata() {
            setMetaTreeMessage("loading", "Loading tables…");
            SqlEditor.refreshMetaBtn.disabled = true;
            SqlEditor.refreshMetaBtn.classList.add("spinning");
            try {
                const data = await fetchMetadata("EntityDefinitions?$select=LogicalName,SchemaName");
                const entities = (data.value || []).filter(e => e.SchemaName).sort(bySchemaName);
                SqlEditor.entityList = entities;
                SqlEditor.entityByName = {};
                for (const e of entities)
                    SqlEditor.entityByName[(e.SchemaName || "").toLowerCase()] = e;
                renderTables(entities);
            }
            catch {
                setMetaTreeMessage("error", "Failed to load tables. Click ⟳ to retry.");
            }
            finally {
                SqlEditor.refreshMetaBtn.disabled = false;
                SqlEditor.refreshMetaBtn.classList.remove("spinning");
            }
        }
        SqlEditor.initMetadata = initMetadata;
        async function refreshMetadata() {
            for (const k in SqlEditor.attributeCache)
                delete SqlEditor.attributeCache[k];
            SqlEditor.entityList = [];
            SqlEditor.entityByName = {};
            await initMetadata();
        }
        SqlEditor.refreshMetadata = refreshMetadata;
        // ── Tree rendering ─────────────────────────────────────────────────
        function renderTables(entities) {
            SqlEditor.metaTreeEl.textContent = "";
            if (entities.length === 0) {
                setMetaTreeMessage("empty", "No tables found");
                return;
            }
            const frag = document.createDocumentFragment();
            for (const ent of entities)
                frag.appendChild(buildTableNode(ent));
            SqlEditor.metaTreeEl.appendChild(frag);
            reapplyFilter();
        }
        function buildTableNode(ent) {
            const name = (ent.SchemaName || "").toLowerCase();
            const node = document.createElement("div");
            node.className = "tree-node";
            const row = document.createElement("div");
            row.className = "tree-row tree-table-row";
            row.title = ent.LogicalName;
            const twisty = document.createElement("span");
            twisty.className = "tree-twisty";
            const icon = document.createElement("span");
            icon.className = "tree-icon tree-icon-table";
            icon.appendChild(parseSvg(ICON_TABLE_SVG));
            const label = document.createElement("span");
            label.className = "tree-label";
            label.textContent = name;
            row.appendChild(twisty);
            row.appendChild(icon);
            row.appendChild(label);
            const children = document.createElement("div");
            children.className = "tree-children";
            children.style.display = "none";
            row.addEventListener("click", (e) => {
                if (e.detail > 1)
                    return;
                const isExpanded = node.classList.toggle("expanded");
                children.style.display = isExpanded ? "" : "none";
                if (isExpanded && !node.dataset.loaded) {
                    node.dataset.loaded = "1";
                    loadFields(ent, children).catch(() => {
                        delete node.dataset.loaded;
                        children.textContent = "";
                        const errRow = document.createElement("div");
                        errRow.className = "tree-error tree-field-row";
                        errRow.textContent = "Failed to load columns";
                        children.appendChild(errRow);
                    });
                }
            });
            row.addEventListener("dblclick", () => insertIntoEditor(name));
            node.appendChild(row);
            node.appendChild(children);
            return node;
        }
        async function loadFields(ent, children) {
            children.textContent = "";
            const loadingRow = document.createElement("div");
            loadingRow.className = "tree-loading tree-field-row";
            const spinner = document.createElement("span");
            spinner.className = "tree-spinner";
            const loadingText = document.createElement("span");
            loadingText.textContent = "Loading…";
            loadingRow.appendChild(spinner);
            loadingRow.appendChild(loadingText);
            children.appendChild(loadingRow);
            const attrs = await getAttributes(ent.LogicalName);
            children.textContent = "";
            if (attrs.length === 0) {
                const emptyRow = document.createElement("div");
                emptyRow.className = "tree-empty tree-field-row";
                emptyRow.textContent = "No columns";
                children.appendChild(emptyRow);
                return;
            }
            const frag = document.createDocumentFragment();
            for (const attr of attrs)
                frag.appendChild(buildFieldNode(attr));
            children.appendChild(frag);
            reapplyFilter();
        }
        function buildFieldNode(attr) {
            const name = (attr.SchemaName || "").toLowerCase();
            const row = document.createElement("div");
            row.className = "tree-row tree-field-row";
            row.title = attr.LogicalName + (attr.AttributeType ? "  (" + attr.AttributeType + ")" : "");
            const icon = document.createElement("span");
            icon.className = "tree-icon tree-icon-field";
            icon.appendChild(parseSvg(ICON_FIELD_SVG));
            const label = document.createElement("span");
            label.className = "tree-label";
            label.textContent = name;
            row.appendChild(icon);
            row.appendChild(label);
            row.addEventListener("dblclick", () => insertIntoEditor(name));
            return row;
        }
        function insertIntoEditor(text) {
            SqlEditor.editor.session.insert(SqlEditor.editor.getCursorPosition(), text);
            SqlEditor.editor.focus();
        }
        SqlEditor.insertIntoEditor = insertIntoEditor;
        // ── Search / filter ────────────────────────────────────────────────
        function setupMetaSearch() {
            SqlEditor.metaSearchInput = document.getElementById("metaSearch");
            const wrap = SqlEditor.metaSearchInput.parentElement;
            const clearBtn = document.getElementById("metaSearchClear");
            let raf = null;
            function schedule() {
                wrap.classList.toggle("has-text", SqlEditor.metaSearchInput.value.length > 0);
                if (raf !== null)
                    cancelAnimationFrame(raf);
                raf = requestAnimationFrame(() => { raf = null; applyFilter(SqlEditor.metaSearchInput.value); });
            }
            SqlEditor.metaSearchInput.addEventListener("input", schedule);
            SqlEditor.metaSearchInput.addEventListener("keydown", (e) => {
                if (e.key === "Escape") {
                    SqlEditor.metaSearchInput.value = "";
                    schedule();
                }
            });
            clearBtn.addEventListener("click", () => {
                SqlEditor.metaSearchInput.value = "";
                schedule();
                SqlEditor.metaSearchInput.focus();
            });
        }
        SqlEditor.setupMetaSearch = setupMetaSearch;
        // Filters the rendered tree. Tables always match by name; fields are
        // filtered for tables whose columns are already loaded.
        function applyFilter(query) {
            const q = query.trim().toLowerCase();
            const nodes = SqlEditor.metaTreeEl.querySelectorAll(".tree-node");
            nodes.forEach(node => {
                var _a, _b;
                const tableRow = node.querySelector(".tree-table-row");
                if (!tableRow)
                    return;
                const tlabelEl = tableRow.querySelector(".tree-label");
                const tlabel = (_b = (_a = tlabelEl === null || tlabelEl === void 0 ? void 0 : tlabelEl.textContent) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== null && _b !== void 0 ? _b : "";
                const tableMatch = q === "" || tlabel.indexOf(q) !== -1;
                const children = node.querySelector(".tree-children");
                const fieldRows = node.querySelectorAll(".tree-field-row");
                let anyFieldMatch = false;
                fieldRows.forEach(fr => {
                    const fl = fr.querySelector(".tree-label");
                    let show;
                    if (q === "" || tableMatch) {
                        show = true;
                    }
                    else if (fl === null || fl === void 0 ? void 0 : fl.textContent) {
                        const matched = fl.textContent.toLowerCase().indexOf(q) !== -1;
                        show = matched;
                        if (matched)
                            anyFieldMatch = true;
                    }
                    else {
                        show = false;
                    }
                    fr.classList.toggle("tree-hidden", !show);
                });
                node.classList.toggle("tree-hidden", !(tableMatch || anyFieldMatch));
                if (q !== "" && anyFieldMatch && children) {
                    node.classList.add("expanded");
                    children.style.display = "";
                }
            });
            if (typeof SqlEditor.metaTreeEl.animate === "function")
                SqlEditor.metaTreeEl.animate([{ opacity: 0.55 }, { opacity: 1 }], { duration: 130, easing: "ease-out" });
        }
        function reapplyFilter() {
            if (SqlEditor.metaSearchInput === null || SqlEditor.metaSearchInput === void 0 ? void 0 : SqlEditor.metaSearchInput.value)
                applyFilter(SqlEditor.metaSearchInput.value);
        }
    })(SqlEditor = Sql4CdsApp.SqlEditor || (Sql4CdsApp.SqlEditor = {}));
})(Sql4CdsApp || (Sql4CdsApp = {}));
//# sourceMappingURL=sqlEditor.metadata.js.map
var Sql4CdsApp;
(function (Sql4CdsApp) {
    var SqlEditor;
    (function (SqlEditor) {
        const SQL_KEYWORDS = [
            "SELECT", "FROM", "WHERE", "JOIN", "INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "FULL JOIN", "CROSS JOIN",
            "ON", "GROUP BY", "ORDER BY", "HAVING", "TOP", "DISTINCT", "AS", "AND", "OR", "NOT", "NULL",
            "IS NULL", "IS NOT NULL", "IN", "LIKE", "BETWEEN", "EXISTS", "UNION", "UNION ALL",
            "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "CASE", "WHEN", "THEN", "ELSE", "END",
            "ASC", "DESC", "OFFSET", "FETCH", "WITH", "CROSS APPLY", "OUTER APPLY"
        ];
        const SQL_FUNCTIONS = [
            "COUNT", "SUM", "AVG", "MIN", "MAX", "ISNULL", "COALESCE", "CAST", "CONVERT", "GETDATE",
            "DATEADD", "DATEDIFF", "DATEPART", "YEAR", "MONTH", "DAY", "LEN", "SUBSTRING", "CHARINDEX",
            "REPLACE", "UPPER", "LOWER", "LTRIM", "RTRIM", "CONCAT", "STRING_AGG", "ROW_NUMBER", "RANK"
        ];
        // The identifier immediately before a trailing dot at the cursor, if any.
        function dotContext(session, pos) {
            const line = session.getLine(pos.row).slice(0, pos.column);
            const m = /([A-Za-z_][A-Za-z0-9_]*)\.\s*[A-Za-z0-9_]*$/.exec(line);
            return m ? m[1].toLowerCase() : null;
        }
        // Parse FROM/JOIN clauses into a token -> LogicalName map.
        function buildAliasMap(text) {
            const map = {};
            const KW = /^(on|where|inner|left|right|full|cross|outer|join|group|order|having|union|as)$/i;
            const re = /\b(?:from|join)\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+(?:as\s+)?([A-Za-z_][A-Za-z0-9_]*))?/gi;
            let m;
            while ((m = re.exec(text)) !== null) {
                const ent = SqlEditor.entityByName[m[1].toLowerCase()];
                if (!ent)
                    continue;
                map[m[1].toLowerCase()] = ent.LogicalName;
                if (m[2] && !KW.test(m[2]))
                    map[m[2].toLowerCase()] = ent.LogicalName;
            }
            return map;
        }
        function colCompletion(a, score) {
            const v = (a.SchemaName || "").toLowerCase();
            return { caption: v, value: v, meta: a.AttributeType || "column", score };
        }
        function uniq(arr) {
            const seen = {}, out = [];
            for (const x of arr)
                if (!seen[x]) {
                    seen[x] = 1;
                    out.push(x);
                }
            return out;
        }
        function textBeforeCursor(session, pos) {
            const lines = session.getLines(0, pos.row);
            if (lines.length)
                lines[lines.length - 1] = lines[lines.length - 1].slice(0, pos.column);
            return lines.join("\n");
        }
        // Which clause is the cursor in, based on the last clause keyword seen before it?
        function clauseContext(before) {
            const re = /\b(select|from|join|where|group\s+by|order\s+by|having|on|set|into|update|values)\b/gi;
            let last = null, m;
            while ((m = re.exec(before)) !== null)
                last = m[1].toLowerCase().replace(/\s+/g, " ");
            if (!last)
                return "other";
            if (last === "from" || last === "join" || last === "into" || last === "update")
                return "table";
            if (last === "select" || last === "where" || last === "on" || last === "set" ||
                last === "having" || last === "group by" || last === "order by")
                return "column";
            return "other";
        }
        const keywordCompleter = {
            getCompletions(_editor, session, pos, _prefix, callback) {
                if (dotContext(session, pos)) {
                    callback(null, []);
                    return;
                }
                const kw = SQL_KEYWORDS.map(k => ({ caption: k, value: k, meta: "keyword", score: 1000 }));
                const fn = SQL_FUNCTIONS.map(f => ({ caption: f, value: f, meta: "function", score: 900 }));
                callback(null, kw.concat(fn));
            }
        };
        const tableCompleter = {
            getCompletions(_editor, session, pos, _prefix, callback) {
                if (dotContext(session, pos)) {
                    callback(null, []);
                    return;
                }
                const ctx = clauseContext(textBeforeCursor(session, pos));
                const score = ctx === "table" ? 1300 : ctx === "column" ? 400 : 500;
                const results = SqlEditor.entityList.map(e => {
                    const v = (e.SchemaName || "").toLowerCase();
                    return { caption: v, value: v, meta: "table", score };
                });
                callback(null, results);
            }
        };
        const columnCompleter = {
            getCompletions(_editor, session, pos, _prefix, callback) {
                const text = session.getValue();
                const aliasMap = buildAliasMap(text);
                const dot = dotContext(session, pos);
                if (dot) {
                    const ent = SqlEditor.entityByName[dot];
                    const logical = aliasMap[dot] || (ent && ent.LogicalName);
                    if (!logical) {
                        callback(null, []);
                        return;
                    }
                    SqlEditor.getAttributes(logical)
                        .then(attrs => callback(null, attrs.map(a => colCompletion(a, 1300))))
                        .catch(() => callback(null, []));
                    return;
                }
                const logicals = uniq(Object.keys(aliasMap).map(k => aliasMap[k]));
                if (logicals.length === 0) {
                    callback(null, []);
                    return;
                }
                const ctx = clauseContext(textBeforeCursor(session, pos));
                const score = ctx === "column" ? 1200 : ctx === "table" ? 600 : 800;
                Promise.all(logicals.map(l => SqlEditor.getAttributes(l)))
                    .then(lists => {
                    const out = [], seen = {};
                    lists.forEach(attrs => attrs.forEach(a => {
                        const v = (a.SchemaName || "").toLowerCase();
                        if (!seen[v]) {
                            seen[v] = 1;
                            out.push(colCompletion(a, score));
                        }
                    }));
                    callback(null, out);
                })
                    .catch(() => callback(null, []));
            }
        };
        function setupAutocomplete() {
            ace.require("ace/ext/language_tools");
            SqlEditor.editor.completers = [keywordCompleter, tableCompleter, columnCompleter];
            SqlEditor.editor.setOptions({
                enableBasicAutocompletion: true,
                enableLiveAutocompletion: SqlEditor.settings.autoSuggest,
                enableSnippets: false
            });
            // Dot trigger: an empty prefix won't auto-open the popup, so kick it ourselves.
            SqlEditor.editor.commands.on("afterExec", (e) => {
                var _a;
                if (!SqlEditor.settings.autoSuggest)
                    return;
                if (((_a = e.command) === null || _a === void 0 ? void 0 : _a.name) === "insertstring" && e.args === ".")
                    e.editor.execCommand("startAutocomplete");
            });
        }
        SqlEditor.setupAutocomplete = setupAutocomplete;
    })(SqlEditor = Sql4CdsApp.SqlEditor || (Sql4CdsApp.SqlEditor = {}));
})(Sql4CdsApp || (Sql4CdsApp = {}));
//# sourceMappingURL=sqlEditor.autocomplete.js.map
var Sql4CdsApp;
(function (Sql4CdsApp) {
    var SqlEditor;
    (function (SqlEditor) {
        // ── Tab-delimited clipboard format ─────────────────────────────────
        // RFC-4180-compatible quoting: values containing tabs, newlines or quotes
        // are wrapped in double quotes; internal quotes are doubled.
        function buildTabDelimited(tab) {
            if (!tab.columns || !tab.data)
                return "";
            const fields = tab.columns.map(c => c.field);
            const escape = (v) => {
                const s = v == null ? "" : String(v);
                if (s.includes("\t") || s.includes("\n") || s.includes('"'))
                    return '"' + s.replace(/"/g, '""') + '"';
                return s;
            };
            const header = fields.map(escape).join("\t");
            const rows = tab.data.map(row => fields.map(f => escape(row[f])).join("\t"));
            return [header, ...rows].join("\r\n");
        }
        SqlEditor.buildTabDelimited = buildTabDelimited;
        // ── Save query to file ─────────────────────────────────────────────
        async function saveQuery() {
            const tab = SqlEditor.getActiveTab();
            if (!tab)
                return;
            const sql = SqlEditor.editor.getValue();
            if (typeof window.showSaveFilePicker === "function") {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: tab.title + ".sql",
                        types: [{ description: "SQL files", accept: { "text/plain": [".sql"] } }]
                    });
                    const writable = await handle.createWritable();
                    await writable.write(sql);
                    await writable.close();
                    tab.title = handle.name.replace(/\.sql$/i, "");
                    SqlEditor.updateTabStrip();
                    return;
                }
                catch (e) {
                    if (e.name === "AbortError")
                        return;
                    // File System Access API blocked (e.g. cross-origin iframe) — fall through
                }
            }
            // Fallback: trigger a download via a temporary anchor element.
            const blob = new Blob([sql], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = tab.title + ".sql";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        SqlEditor.saveQuery = saveQuery;
        // ── Open query from file ───────────────────────────────────────────
        function openQuery() {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".sql,.txt";
            input.style.display = "none";
            document.body.appendChild(input);
            input.onchange = async () => {
                var _a;
                const file = (_a = input.files) === null || _a === void 0 ? void 0 : _a[0];
                document.body.removeChild(input);
                if (!file)
                    return;
                const text = await file.text();
                const tabName = file.name.replace(/\.(sql|txt)$/i, "");
                const tab = SqlEditor.createTab(text);
                tab.title = tabName;
                SqlEditor.switchToTab(tab.id);
            };
            input.click();
        }
        SqlEditor.openQuery = openQuery;
    })(SqlEditor = Sql4CdsApp.SqlEditor || (Sql4CdsApp.SqlEditor = {}));
})(Sql4CdsApp || (Sql4CdsApp = {}));
//# sourceMappingURL=sqlEditor.fileio.js.map
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
