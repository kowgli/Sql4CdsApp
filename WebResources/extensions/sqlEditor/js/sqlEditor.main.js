/// <reference path="../../../node_modules/@types/ace/index.d.ts" />
/// <reference path="../../../node_modules/@types/tabulator/index.d.ts" />
var Sql4CdsApp;
(function (Sql4CdsApp) {
    var SqlEditor;
    (function (SqlEditor) {
        let editor;
        let table, statusEl, errorBox, rowsInfo, commandMessage, loadingOverlay, loadingTimer;
        let timerInterval = null;
        let tabs = [];
        let activeTabId = -1;
        let tabSeq = 0;
        let tabListEl;
        let tableBuilt = false; // Tabulator builds asynchronously; guard grid calls until then
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
        // Object explorer (metadata) state
        let metaTreeEl, refreshMetaBtn, metaSearchInput;
        const attributeCache = {};
        let entityList = []; // all tables, kept for autocomplete
        let entityByName = {}; // lowercased SchemaName -> entity
        let autoSuggestOn = true; // live autocomplete + dot trigger (toolbar toggle)
        function onLoad() {
            // ── Ace setup (single editor; sessions are swapped per tab) ─────
            editor = ace.edit("editor");
            editor.setTheme("ace/theme/sqlserver");
            editor.setOptions({
                fontSize: "13px",
                showPrintMargin: false
            });
            editor.commands.addCommand({
                name: "runQuery",
                bindKey: { win: "Ctrl-Enter", mac: "Command-Enter" },
                exec: () => run()
            });
            editor.commands.addCommand({
                name: "newTab",
                bindKey: { win: "Ctrl-T", mac: "Command-T" },
                exec: () => newTab()
            });
            // ── Autocomplete (keywords / tables / columns) ─────────────────
            setupAutocomplete();
            // ── Tabulator setup ────────────────────────────────────────────
            table = new Tabulator("#grid", {
                layout: "fitDataFill",
                placeholder: "No results yet",
                height: "100%",
                selectable: true,
                clipboard: true
            });
            // Tabulator builds asynchronously — only touch the grid once it has.
            table.on("tableBuilt", () => {
                tableBuilt = true;
                renderActiveTab();
            });
            // ── UI helpers ─────────────────────────────────────────────────
            statusEl = document.getElementById("status");
            errorBox = document.getElementById("errorBox");
            rowsInfo = document.getElementById("rowsInfo");
            commandMessage = document.getElementById("commandMessage");
            loadingOverlay = document.getElementById("loadingOverlay");
            loadingTimer = document.getElementById("loadingTimer");
            tabListEl = document.getElementById("tabList");
            // ── Toolbar / tab events (wired before first render so they always attach) ──
            document.getElementById("runBtn").addEventListener("click", run);
            document.getElementById("newTabBtn").addEventListener("click", newTab);
            const autoChk = document.getElementById("optAutoSuggest");
            autoSuggestOn = autoChk.checked; // default checked
            autoChk.addEventListener("change", () => {
                autoSuggestOn = autoChk.checked;
                editor.setOptions({ enableLiveAutocompletion: autoSuggestOn });
                // The afterExec dot handler is gated by autoSuggestOn, so it follows the toggle.
            });
            document.getElementById("clearBtn").addEventListener("click", () => {
                const tab = getActiveTab();
                if (!tab)
                    return;
                tab.columns = null;
                tab.data = null;
                tab.commandMsg = null;
                tab.errorText = null;
                tab.rowsInfoText = "";
                tab.statusText = "Cleared";
                renderActiveTab();
            });
            document.getElementById("formatBtn").addEventListener("click", () => {
                const sql = editor.getValue();
                try {
                    const formatted = sqlFormatter.format(sql, { language: "tsql" });
                    editor.setValue(formatted, -1);
                    setStatus("Formatted");
                }
                catch {
                    setStatus("Format failed");
                }
            });
            document.getElementById("cancelBtn").addEventListener("click", () => {
                const tab = getActiveTab();
                if (!tab)
                    return;
                tab.runGen++; // invalidate the in-flight run
                tab.running = false;
                tab.loadStart = null;
                tab.statusText = "Cancelled";
                hideLoading();
                setStatus("Cancelled");
                setRunning(false);
                updateTabStrip();
            });
            // ── Divider drag ───────────────────────────────────────────────
            setupDivider();
            // ── Object explorer (metadata tree) ────────────────────────────
            metaTreeEl = document.getElementById("metaTree");
            refreshMetaBtn = document.getElementById("refreshMetaBtn");
            refreshMetaBtn.addEventListener("click", () => { void refreshMetadata(); });
            setupMetaSearch();
            setupMetaDivider();
            setupMetaCollapse();
            void initMetadata(); // async, non-blocking — the rest of the page stays usable
            // ── Window resize: reclamp and redraw ──────────────────────────
            window.addEventListener("resize", onWindowResize);
            // ── Initial tab (after everything is wired) ─────────────────────
            const first = createTab(DEFAULT_SQL);
            activeTabId = first.id;
            editor.setSession(first.session);
            updateTabStrip();
            renderActiveTab(); // grid portion is deferred until tableBuilt fires
        }
        SqlEditor.onLoad = onLoad;
        // ── Tab management ──────────────────────────────────────────────────
        function getActiveTab() {
            return tabs.filter(t => t.id === activeTabId)[0];
        }
        function makeSession(sql) {
            const session = ace.createEditSession(sql);
            session.setMode("ace/mode/sql");
            session.setUseWrapMode(true);
            session.setTabSize(2);
            session.setUseSoftTabs(true);
            return session;
        }
        function createTab(initialSql) {
            const id = ++tabSeq;
            const session = makeSession(initialSql);
            const tab = {
                id,
                title: "Query " + id,
                session,
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
            tabs.push(tab);
            return tab;
        }
        function newTab() {
            const tab = createTab("-- New query\n");
            activeTabId = tab.id;
            editor.setSession(tab.session);
            updateTabStrip();
            renderActiveTab();
            editor.focus();
        }
        function switchToTab(id) {
            if (id === activeTabId)
                return;
            const tab = tabs.filter(t => t.id === id)[0];
            if (!tab)
                return;
            activeTabId = id;
            editor.setSession(tab.session);
            updateTabStrip();
            renderActiveTab();
            editor.focus();
        }
        function closeTab(id) {
            let idx = -1;
            for (let i = 0; i < tabs.length; i++) {
                if (tabs[i].id === id) {
                    idx = i;
                    break;
                }
            }
            if (idx === -1)
                return;
            const tab = tabs[idx];
            tab.runGen++; // invalidate any in-flight query on this tab
            // Closing the only tab: reset it in place to a fresh blank document
            // (keeps its number rather than spawning an incremented one).
            if (tabs.length === 1) {
                tab.session = makeSession("-- New query\n");
                tab.columns = null;
                tab.data = null;
                tab.commandMsg = null;
                tab.errorText = null;
                tab.rowsInfoText = "";
                tab.statusText = "Ready";
                tab.running = false;
                tab.loadStart = null;
                editor.setSession(tab.session);
                updateTabStrip();
                renderActiveTab();
                editor.focus();
                return;
            }
            const wasActive = (id === activeTabId);
            tabs.splice(idx, 1);
            if (wasActive) {
                const next = tabs[Math.min(idx, tabs.length - 1)];
                activeTabId = next.id;
                editor.setSession(next.session);
            }
            updateTabStrip();
            if (wasActive)
                renderActiveTab();
        }
        function updateTabStrip() {
            tabListEl.innerHTML = "";
            const frag = document.createDocumentFragment();
            for (const tab of tabs)
                frag.appendChild(buildTabEl(tab));
            tabListEl.appendChild(frag);
            // Keep the active tab in view if the strip overflows
            const activeEl = tabListEl.querySelector(".tab.active");
            if (activeEl && typeof activeEl.scrollIntoView === "function") {
                activeEl.scrollIntoView({ inline: "nearest", block: "nearest" });
            }
        }
        function buildTabEl(tab) {
            const el = document.createElement("div");
            el.className = "tab" + (tab.id === activeTabId ? " active" : "");
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
            close.innerHTML = ICON_CLOSE;
            el.appendChild(close);
            el.addEventListener("mousedown", (e) => {
                if (e.button === 1) {
                    e.preventDefault();
                    closeTab(tab.id);
                } // middle-click closes
                else if (e.button === 0)
                    switchToTab(tab.id);
            });
            close.addEventListener("mousedown", (e) => e.stopPropagation());
            close.addEventListener("click", (e) => {
                e.stopPropagation();
                closeTab(tab.id);
            });
            return el;
        }
        // Sync all shared UI (editor session, grid, status, overlay) to the
        // currently active tab's stored state.
        function renderActiveTab() {
            const tab = getActiveTab();
            if (!tab)
                return;
            if (editor.session !== tab.session)
                editor.setSession(tab.session);
            if (tab.errorText)
                showError(tab.errorText);
            else
                clearError();
            if (tab.commandMsg)
                showCommandMessage(tab.commandMsg);
            else
                showCommandMessage(null);
            // Grid calls are only safe after Tabulator has finished building;
            // the "tableBuilt" handler re-runs this once it's ready.
            if (tableBuilt) {
                table.setColumns(tab.columns || []);
                table.setData(tab.data || []);
            }
            rowsInfo.textContent = tab.rowsInfoText || "";
            setStatus(tab.statusText || "Ready");
            setRunning(tab.running);
            if (tab.running)
                showLoading();
            else
                hideLoading();
            editor.resize();
            if (tableBuilt)
                table.redraw(true);
        }
        // ── Object explorer / metadata divider (horizontal width drag) ──────
        function setupMetaDivider() {
            const divider = document.getElementById("metaDivider");
            const panel = document.getElementById("metadataPanel");
            const container = document.getElementById("app"); // holds [panel | divider | right pane]
            let isDragging = false;
            let startX = 0;
            let startW = 0;
            let wsWCached = 0;
            let latestX = 0;
            let rafId = null;
            let widthPx = null;
            function applyDrag() {
                rafId = null;
                const minW = 160;
                const maxW = Math.max(minW, wsWCached - 240);
                const newW = Math.max(minW, Math.min(maxW, startW + (latestX - startX)));
                widthPx = newW;
                panel.style.flex = `0 0 ${newW}px`;
                editor.resize();
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
                editor.resize();
                table.redraw(true);
            }
            divider.addEventListener("pointerdown", (e) => {
                isDragging = true;
                startX = e.clientX;
                latestX = e.clientX;
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
            // Reclamp stored width when the host frame is resized
            window.addEventListener("resize", () => {
                if (widthPx === null)
                    return;
                const wsW = container.getBoundingClientRect().width;
                const maxW = wsW - 240;
                if (widthPx > maxW) {
                    widthPx = Math.max(160, maxW);
                    panel.style.flex = `0 0 ${widthPx}px`;
                }
            });
        }
        // ── Object explorer collapse / minimize ─────────────────────────────
        // Slides the explorer panel's flex-basis to 0 and swaps in a thin rail on
        // the far left. The transition is class-gated so it never fires during
        // divider drags; the editor is resized each animation frame for smoothness.
        function setupMetaCollapse() {
            const panel = document.getElementById("metadataPanel");
            const rail = document.getElementById("metaRail");
            const divider = document.getElementById("metaDivider");
            const collapseBtn = document.getElementById("collapseMetaBtn");
            const expandBtn = document.getElementById("expandMetaBtn");
            const railLabel = rail.querySelector(".meta-rail-label");
            const DURATION = 220;
            let collapsed = false;
            let expandedWidth = 220;
            function animateEditorDuring(duration) {
                const end = performance.now() + duration;
                (function step() {
                    editor.resize();
                    if (performance.now() < end)
                        requestAnimationFrame(step);
                    else
                        table.redraw(true);
                })();
            }
            function collapse() {
                if (collapsed)
                    return;
                collapsed = true;
                expandedWidth = Math.max(160, Math.round(panel.getBoundingClientRect().width));
                // Pin the current width, force reflow, then animate to 0.
                panel.style.flex = `0 0 ${expandedWidth}px`;
                void panel.offsetWidth;
                panel.classList.add("meta-animating");
                panel.style.flex = "0 0 0px";
                divider.style.display = "none";
                animateEditorDuring(DURATION);
                window.setTimeout(() => {
                    panel.classList.remove("meta-animating");
                    panel.classList.add("meta-collapsed");
                    rail.classList.add("show");
                    editor.resize();
                    table.redraw(true);
                }, DURATION + 20);
            }
            function expand() {
                if (!collapsed)
                    return;
                collapsed = false;
                rail.classList.remove("show");
                panel.classList.remove("meta-collapsed");
                // Start from 0, force reflow, then animate back to the saved width.
                panel.style.flex = "0 0 0px";
                void panel.offsetWidth;
                panel.classList.add("meta-animating");
                panel.style.flex = `0 0 ${expandedWidth}px`;
                divider.style.display = "";
                animateEditorDuring(DURATION);
                window.setTimeout(() => {
                    panel.classList.remove("meta-animating");
                    editor.resize();
                    table.redraw(true);
                }, DURATION + 20);
            }
            collapseBtn.addEventListener("click", collapse);
            expandBtn.addEventListener("click", expand);
            if (railLabel)
                railLabel.addEventListener("click", expand);
        }
        // ── Divider / splitter ─────────────────────────────────────────────
        function setupDivider() {
            const divider = document.getElementById("divider");
            const editorPanel = document.getElementById("editorPanel");
            const gridEl = document.getElementById("grid");
            const skeletonEl = document.getElementById("resizeSkeleton");
            const mainEl = document.getElementById("main");
            let isDragging = false;
            let startY = 0;
            let startEditorH = 0;
            let editorHeightPx = null; // null → flex layout
            let gridDisplayBeforeDrag = "";
            // Cached during drag to avoid forced reflows in pointermove
            let mainHCached = 0;
            let divHCached = 0;
            let latestY = 0;
            let rafId = null;
            function applyDrag() {
                rafId = null;
                const minH = 80;
                const newH = Math.max(minH, Math.min(mainHCached - divHCached - minH, startEditorH + (latestY - startY)));
                editorHeightPx = newH;
                editorPanel.style.flex = `0 0 ${newH}px`;
                editor.resize();
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
                // Hide skeleton, restore grid, redraw at final size
                skeletonEl.style.display = "none";
                gridEl.style.display = gridDisplayBeforeDrag;
                editor.resize();
                table.redraw(true);
            }
            divider.addEventListener("pointerdown", (e) => {
                isDragging = true;
                startY = e.clientY;
                latestY = e.clientY;
                startEditorH = editorPanel.getBoundingClientRect().height;
                // Cache these once — they don't change during the drag
                mainHCached = mainEl.getBoundingClientRect().height;
                divHCached = divider.offsetHeight;
                divider.setPointerCapture(e.pointerId);
                divider.classList.add("dragging");
                // Lock cursor and selection for the whole document during drag
                document.body.style.userSelect = "none";
                document.body.style.cursor = "ns-resize";
                // Swap grid for skeleton so Tabulator's ResizeObserver stays silent
                gridDisplayBeforeDrag = gridEl.style.display;
                gridEl.style.display = "none";
                skeletonEl.style.display = "flex";
                e.preventDefault();
            });
            divider.addEventListener("pointermove", (e) => {
                if (!isDragging)
                    return;
                latestY = e.clientY;
                // Throttle style updates to one per animation frame
                if (rafId === null)
                    rafId = requestAnimationFrame(applyDrag);
            });
            divider.addEventListener("pointerup", stopDrag);
            divider.addEventListener("pointercancel", stopDrag);
            divider.addEventListener("lostpointercapture", stopDrag);
            window.addEventListener("blur", stopDrag);
            // Reclamp stored height when the host frame is resized
            window.addEventListener("resize", () => {
                if (editorHeightPx === null)
                    return;
                const mainH = mainEl.getBoundingClientRect().height;
                const divH = divider.offsetHeight;
                const maxH = mainH - divH - 80;
                if (editorHeightPx > maxH) {
                    editorHeightPx = Math.max(80, maxH);
                    editorPanel.style.flex = `0 0 ${editorHeightPx}px`;
                }
            });
        }
        function onWindowResize() {
            editor.resize();
            table.redraw(true);
        }
        // ── Status / error helpers ─────────────────────────────────────────
        function setStatus(text) { statusEl.textContent = text; }
        function setRunning(running) {
            document.getElementById("runBtn").disabled = running;
            document.getElementById("clearBtn").disabled = running;
            document.getElementById("formatBtn").disabled = running;
        }
        // Shows the overlay for the active tab and (re)starts the elapsed timer.
        // The timer reads the active tab's loadStart so switching tabs shows the
        // correct elapsed time for whichever query is currently in view.
        function showLoading() {
            loadingOverlay.style.display = "flex";
            updateLoadingTimer();
            if (timerInterval === null) {
                timerInterval = window.setInterval(updateLoadingTimer, 250);
            }
        }
        function updateLoadingTimer() {
            const tab = getActiveTab();
            if (tab && tab.running && tab.loadStart) {
                loadingTimer.textContent = Math.floor((Date.now() - tab.loadStart) / 1000) + "s";
            }
        }
        function hideLoading() {
            loadingOverlay.style.display = "none";
            if (timerInterval !== null) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
        }
        function showError(errText) {
            errorBox.style.display = "block";
            errorBox.textContent = errText;
            editor.resize(); // errorBox pushes editor up; notify Ace
        }
        function clearError() {
            errorBox.style.display = "none";
            errorBox.textContent = "";
            editor.resize();
        }
        // ── Grid population ────────────────────────────────────────────────
        function showCommandMessage(msg) {
            if (msg) {
                commandMessage.textContent = msg;
                commandMessage.style.display = "flex";
                document.getElementById("grid").style.display = "none";
            }
            else {
                commandMessage.style.display = "none";
                document.getElementById("grid").style.display = "";
            }
        }
        // Builds Tabulator column defs + row objects from a query result, without
        // touching the live grid (so it can be stored on a tab and rendered later).
        function buildGridModel(result) {
            const cols = result.columns || [];
            const rows = result.rows || [];
            const columns = cols.map(c => ({
                title: c,
                field: c,
                headerSort: true,
                resizable: true
            }));
            let data;
            if (rows.length > 0 && Array.isArray(rows[0])) {
                data = rows.map(r => {
                    const o = {};
                    cols.forEach((c, i) => o[c] = r[i]);
                    return o;
                });
            }
            else {
                data = rows;
            }
            return { columns, data };
        }
        // ── Query execution ───────────────────────────────────────────────
        async function executeQuery(sqlText) {
            const requestModel = {
                sql: sqlText,
                bypassCustomPlugins: document.getElementById("optBypassPlugins").checked,
                useLocalTimeZone: document.getElementById("optLocalTime").checked,
                blockDeleteWithoutWhere: document.getElementById("optBlockDelete").checked,
                blockUpdateWithoutWhere: document.getElementById("optBlockUpdate").checked
            };
            const execSqlRequest = {
                Request: JSON.stringify(requestModel),
                getMetadata: function () {
                    return {
                        boundParameter: null,
                        parameterTypes: {
                            Request: { typeName: "Edm.String", structuralProperty: 1 }
                        },
                        operationType: 0, operationName: "cd365_ExecSql"
                    };
                }
            };
            const resp = await Xrm.WebApi.online.execute(execSqlRequest);
            const actionResponse = await resp.json();
            return JSON.parse(actionResponse.Response);
        }
        // ── Run flow ───────────────────────────────────────────────────────
        // Runs the active tab's query. Results are stored on the tab, so a query
        // started on one tab keeps running in the background when the user switches
        // to another; the UI only reflects it while that tab is active.
        async function run() {
            const tab = getActiveTab();
            if (!tab)
                return;
            const selection = editor.session.getTextRange(editor.getSelectionRange());
            const sqlText = selection.trim() ? selection : editor.getValue();
            tab.errorText = null;
            tab.commandMsg = null;
            tab.statusText = "Running…";
            tab.running = true;
            tab.loadStart = Date.now();
            const myGen = ++tab.runGen;
            if (tab.id === activeTabId) {
                clearError();
                setStatus("Running…");
                setRunning(true);
                showLoading();
            }
            updateTabStrip();
            try {
                const t0 = performance.now();
                const result = await executeQuery(sqlText);
                const elapsed = (performance.now() - t0).toFixed(0);
                if (tab.runGen !== myGen)
                    return; // cancelled, closed, or superseded
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
                        ? `${result.recordsAffected} row(s) affected`
                        : "";
                    tab.statusText = `Done in ${elapsed} ms`;
                }
                else {
                    const model = buildGridModel(result);
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
                    if (tab.id === activeTabId)
                        renderActiveTab();
                    updateTabStrip();
                }
            }
        }
        // ── Object explorer / metadata ──────────────────────────────────────
        const ICON_TABLE = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
            '<path d="M1.5 2h13v12h-13V2zm1 1v2.5h11V3h-11zm0 3.5V9h4V6.5h-4zm5 0V9h6V6.5h-6zm-5 3.5v3h4v-3h-4zm5 0v3h6v-3h-6z"/></svg>';
        const ICON_FIELD = '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
            '<circle cx="8" cy="8" r="3.25"/></svg>';
        // Small "×" used on each tab's close button (static, trusted markup).
        const ICON_CLOSE = '<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
            '<path d="M4.5 3.5L8 7l3.5-3.5 1 1L9 8l3.5 3.5-1 1L8 9l-3.5 3.5-1-1L7 8 3.5 4.5z"/></svg>';
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
        function bySchemaName(a, b) {
            return String(a.SchemaName).toLowerCase().localeCompare(String(b.SchemaName).toLowerCase());
        }
        function setMetaTreeMessage(kind, text) {
            const cls = kind === "error" ? "meta-error" : "meta-loading";
            const spinner = kind === "loading" ? '<span class="meta-spinner"></span>' : "";
            const span = document.createElement("span");
            span.textContent = text;
            metaTreeEl.innerHTML = '<div class="' + cls + '">' + spinner + '</div>';
            metaTreeEl.firstElementChild.appendChild(span);
        }
        async function initMetadata() {
            setMetaTreeMessage("loading", "Loading tables…");
            refreshMetaBtn.disabled = true;
            refreshMetaBtn.classList.add("spinning");
            try {
                const data = await fetchMetadata("EntityDefinitions?$select=LogicalName,SchemaName");
                const entities = (data.value || []).filter(e => e.SchemaName).sort(bySchemaName);
                entityList = entities; // keep for autocomplete
                entityByName = {};
                for (const e of entities)
                    entityByName[(e.SchemaName || "").toLowerCase()] = e;
                renderTables(entities);
            }
            catch (err) {
                setMetaTreeMessage("error", "Failed to load tables. Click ⟳ to retry.");
            }
            finally {
                refreshMetaBtn.disabled = false;
                refreshMetaBtn.classList.remove("spinning");
            }
        }
        async function refreshMetadata() {
            for (const k in attributeCache)
                delete attributeCache[k];
            entityList = [];
            entityByName = {};
            await initMetadata();
        }
        // ── Object explorer search / filter ─────────────────────────────────
        function setupMetaSearch() {
            metaSearchInput = document.getElementById("metaSearch");
            const wrap = metaSearchInput.parentElement;
            const clearBtn = document.getElementById("metaSearchClear");
            let raf = null;
            function schedule() {
                wrap.classList.toggle("has-text", metaSearchInput.value.length > 0);
                if (raf !== null)
                    cancelAnimationFrame(raf);
                raf = requestAnimationFrame(() => { raf = null; applyFilter(metaSearchInput.value); });
            }
            metaSearchInput.addEventListener("input", schedule);
            metaSearchInput.addEventListener("keydown", (e) => {
                if (e.key === "Escape") {
                    metaSearchInput.value = "";
                    schedule();
                }
            });
            clearBtn.addEventListener("click", () => {
                metaSearchInput.value = "";
                schedule();
                metaSearchInput.focus();
            });
        }
        // Filters the rendered tree. Tables always match by name; fields are
        // filtered for tables whose columns are already loaded (lazy-loaded ones
        // only match by table name until expanded once).
        function applyFilter(query) {
            const q = query.trim().toLowerCase();
            const nodes = metaTreeEl.querySelectorAll(".tree-node");
            nodes.forEach(node => {
                const tableRow = node.querySelector(".tree-table-row");
                if (!tableRow)
                    return;
                const tlabelEl = tableRow.querySelector(".tree-label");
                const tlabel = tlabelEl && tlabelEl.textContent ? tlabelEl.textContent.toLowerCase() : "";
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
                    else if (fl && fl.textContent) {
                        const matched = fl.textContent.toLowerCase().indexOf(q) !== -1;
                        show = matched;
                        if (matched)
                            anyFieldMatch = true;
                    }
                    else {
                        show = false; // hide "No columns" / error rows while searching
                    }
                    fr.classList.toggle("tree-hidden", !show);
                });
                node.classList.toggle("tree-hidden", !(tableMatch || anyFieldMatch));
                // Reveal a matching column by expanding its (already loaded) table
                if (q !== "" && anyFieldMatch && children) {
                    node.classList.add("expanded");
                    children.style.display = "";
                }
            });
            // Short, subtle fade so the result update feels smooth
            if (typeof metaTreeEl.animate === "function") {
                metaTreeEl.animate([{ opacity: 0.55 }, { opacity: 1 }], { duration: 130, easing: "ease-out" });
            }
        }
        function reapplyFilter() {
            if (metaSearchInput && metaSearchInput.value)
                applyFilter(metaSearchInput.value);
        }
        function renderTables(entities) {
            metaTreeEl.innerHTML = "";
            if (entities.length === 0) {
                setMetaTreeMessage("empty", "No tables found");
                return;
            }
            const frag = document.createDocumentFragment();
            for (const ent of entities)
                frag.appendChild(buildTableNode(ent));
            metaTreeEl.appendChild(frag);
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
            icon.innerHTML = ICON_TABLE;
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
                    return; // ignore the 2nd click of a double-click (which inserts)
                const isExpanded = node.classList.toggle("expanded");
                children.style.display = isExpanded ? "" : "none";
                if (isExpanded && !node.dataset.loaded) {
                    node.dataset.loaded = "1";
                    loadFields(ent, children).catch(() => {
                        delete node.dataset.loaded; // allow a retry on next expand
                        children.innerHTML = '<div class="tree-error tree-field-row">Failed to load columns</div>';
                    });
                }
            });
            row.addEventListener("dblclick", () => insertIntoEditor(name));
            node.appendChild(row);
            node.appendChild(children);
            return node;
        }
        // DOM-free fetch + cache of one entity's attributes. Shared by the tree
        // (loadFields) and the autocomplete column completer.
        async function getAttributes(logicalName) {
            let attrs = attributeCache[logicalName];
            if (!attrs) {
                const data = await fetchMetadata("EntityDefinitions(LogicalName='" + logicalName +
                    "')/Attributes?$select=LogicalName,SchemaName,AttributeType");
                attrs = (data.value || []).filter(a => a.SchemaName).sort(bySchemaName);
                attributeCache[logicalName] = attrs; // cache once loaded
            }
            return attrs;
        }
        async function loadFields(ent, children) {
            children.innerHTML =
                '<div class="tree-loading tree-field-row"><span class="tree-spinner"></span><span>Loading…</span></div>';
            const attrs = await getAttributes(ent.LogicalName);
            children.innerHTML = "";
            if (attrs.length === 0) {
                children.innerHTML = '<div class="tree-empty tree-field-row">No columns</div>';
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
            icon.innerHTML = ICON_FIELD;
            const label = document.createElement("span");
            label.className = "tree-label";
            label.textContent = name;
            row.appendChild(icon);
            row.appendChild(label);
            row.addEventListener("dblclick", () => insertIntoEditor(name));
            return row;
        }
        function insertIntoEditor(text) {
            editor.session.insert(editor.getCursorPosition(), text);
            editor.focus();
        }
        // ── Autocomplete (Ace ext-language_tools) ───────────────────────────
        // Curated T-SQL keyword/function lists — mode-sql's built-in ANSI set
        // misses dialect items (TOP, ISNULL, CROSS APPLY, …), so we own this.
        const SQL_KEYWORDS = ["SELECT", "FROM", "WHERE", "JOIN", "INNER JOIN", "LEFT JOIN", "RIGHT JOIN",
            "FULL JOIN", "CROSS JOIN", "ON", "GROUP BY", "ORDER BY", "HAVING", "TOP", "DISTINCT", "AS", "AND", "OR",
            "NOT", "NULL", "IS NULL", "IS NOT NULL", "IN", "LIKE", "BETWEEN", "EXISTS", "UNION", "UNION ALL", "INSERT",
            "INTO", "VALUES", "UPDATE", "SET", "DELETE", "CASE", "WHEN", "THEN", "ELSE", "END", "ASC", "DESC", "OFFSET",
            "FETCH", "WITH", "CROSS APPLY", "OUTER APPLY"];
        const SQL_FUNCTIONS = ["COUNT", "SUM", "AVG", "MIN", "MAX", "ISNULL", "COALESCE", "CAST", "CONVERT", "GETDATE",
            "DATEADD", "DATEDIFF", "DATEPART", "YEAR", "MONTH", "DAY", "LEN", "SUBSTRING", "CHARINDEX", "REPLACE", "UPPER",
            "LOWER", "LTRIM", "RTRIM", "CONCAT", "STRING_AGG", "ROW_NUMBER", "RANK"];
        // The identifier immediately before a trailing dot at the cursor, if any
        // (handles both "a." and a partial "a.nam"). null when not in a dot context.
        function dotContext(session, pos) {
            const line = session.getLine(pos.row).slice(0, pos.column);
            const m = /([A-Za-z_][A-Za-z0-9_]*)\.\s*[A-Za-z0-9_]*$/.exec(line);
            return m ? m[1].toLowerCase() : null;
        }
        // Parse FROM/JOIN clauses into a token -> LogicalName map. Self-maps the
        // table name too, so "table.col" works without an explicit alias.
        function buildAliasMap(text) {
            const map = {};
            const KW = /^(on|where|inner|left|right|full|cross|outer|join|group|order|having|union|as)$/i;
            const re = /\b(?:from|join)\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+(?:as\s+)?([A-Za-z_][A-Za-z0-9_]*))?/gi;
            let m;
            while ((m = re.exec(text)) !== null) {
                const ent = entityByName[m[1].toLowerCase()];
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
        // The document text from the start up to the cursor (across lines).
        function textBeforeCursor(session, pos) {
            const lines = session.getLines(0, pos.row);
            if (lines.length)
                lines[lines.length - 1] = lines[lines.length - 1].slice(0, pos.column);
            return lines.join("\n");
        }
        // Which clause is the cursor in, based on the last clause keyword before it?
        //   "table"  → a table name is expected (after FROM / JOIN / INTO / UPDATE)
        //   "column" → a column is expected (SELECT list, WHERE, ON, GROUP/ORDER BY, HAVING, SET)
        //   "other"  → no strong expectation (e.g. start of statement)
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
        // Keywords (score ~1000) sit ABOVE columns/tables in a neutral context, but
        // columns/tables get boosted past them when the clause expects one (below).
        const keywordCompleter = {
            getCompletions(_editor, session, pos, _prefix, callback) {
                if (dotContext(session, pos)) {
                    callback(null, []);
                    return;
                } // after a dot only columns apply
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
                } // dot = column territory
                const ctx = clauseContext(textBeforeCursor(session, pos));
                const score = ctx === "table" ? 1300 : ctx === "column" ? 400 : 500;
                const results = entityList.map(e => {
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
                    const ent = entityByName[dot];
                    const logical = aliasMap[dot] || (ent && ent.LogicalName);
                    if (!logical) {
                        callback(null, []);
                        return;
                    }
                    getAttributes(logical)
                        .then(attrs => callback(null, attrs.map(a => colCompletion(a, 1300))))
                        .catch(() => callback(null, []));
                    return;
                }
                // Bare prefix: union of columns of every table referenced in FROM/JOIN.
                const logicals = uniq(Object.keys(aliasMap).map(k => aliasMap[k]));
                if (logicals.length === 0) {
                    callback(null, []);
                    return;
                }
                const ctx = clauseContext(textBeforeCursor(session, pos));
                const score = ctx === "column" ? 1200 : ctx === "table" ? 600 : 800;
                Promise.all(logicals.map(l => getAttributes(l)))
                    .then(lists => {
                    const out = [];
                    const seen = {};
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
            ace.require("ace/ext/language_tools"); // installs Autocomplete + startAutocomplete cmd
            editor.completers = [keywordCompleter, tableCompleter, columnCompleter];
            editor.setOptions({
                enableBasicAutocompletion: true, // Ctrl+Space — always available
                enableLiveAutocompletion: autoSuggestOn, // as-you-type — default on
                enableSnippets: false
            });
            // Dot trigger: an empty prefix won't auto-start the popup, so kick it
            // off ourselves right after a "." (gated by the auto-suggest toggle).
            editor.commands.on("afterExec", (e) => {
                if (!autoSuggestOn)
                    return;
                if (e.command && e.command.name === "insertstring" && e.args === ".") {
                    e.editor.execCommand("startAutocomplete");
                }
            });
        }
    })(SqlEditor = Sql4CdsApp.SqlEditor || (Sql4CdsApp.SqlEditor = {}));
})(Sql4CdsApp || (Sql4CdsApp = {}));
document.addEventListener("readystatechange", () => {
    if (document.readyState === "complete") {
        Sql4CdsApp.SqlEditor.onLoad();
    }
});
//# sourceMappingURL=sqlEditor.main.js.map