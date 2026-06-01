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