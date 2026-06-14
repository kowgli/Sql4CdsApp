namespace Sql4CdsApp.SqlEditor {

    // ── Tab strip element ref (assigned in onLoad) ─────────────────────
    export let tabListEl: HTMLElement;

    // ── Tab sequence counter ───────────────────────────────────────────
    let tabSeq = 0;

    // ── Multi-tab state ────────────────────────────────────────────────
    export let tabs: QueryTab[] = [];
    export let activeTabId = -1;

    // Small "×" built once as a DOM element and cloned per tab.
    const CLOSE_ICON_EL: Element = (() => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "10"); svg.setAttribute("height", "10");
        svg.setAttribute("viewBox", "0 0 16 16"); svg.setAttribute("fill", "currentColor");
        svg.setAttribute("aria-hidden", "true");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", "M4.5 3.5L8 7l3.5-3.5 1 1L9 8l3.5 3.5-1 1L8 9l-3.5 3.5-1-1L7 8 3.5 4.5z");
        svg.appendChild(path);
        return svg;
    })();

    // ── Session factory ────────────────────────────────────────────────
    function makeSession(sql: string): any {
        const session: any = (ace as any).createEditSession(sql);
        session.setMode("ace/mode/sql");
        session.setUseWrapMode(true);
        session.setTabSize(2);
        session.setUseSoftTabs(true);
        return session;
    }

    // ── Tab CRUD ───────────────────────────────────────────────────────
    export function getActiveTab(): QueryTab | undefined {
        return tabs.filter(t => t.id === activeTabId)[0];
    }

    export function createTab(initialSql: string): QueryTab {
        const id = ++tabSeq;
        const tab: QueryTab = {
            id,
            title:          "Query " + id,
            session:        makeSession(initialSql),
            columns:        null,
            data:           null,
            commandMsg:     null,
            rowsInfoText:   "",
            errorText:      null,
            statusText:     "Ready",
            running:        false,
            runGen:         0,
            loadStart:      null,
            recordViewMode: false,
            recordIndex:    0
        };
        tabs.push(tab);
        return tab;
    }

    export function newTab() {
        const tab = createTab("-- New query\n");
        activeTabId = tab.id;
        editor.setSession(tab.session);
        updateTabStrip();
        renderActiveTab();
        editor.focus();
    }

    export function switchToTab(id: number) {
        if (id === activeTabId) return;
        const tab = tabs.filter(t => t.id === id)[0];
        if (!tab) return;
        activeTabId = id;
        editor.setSession(tab.session);
        updateTabStrip();
        renderActiveTab();
        editor.focus();
    }

    function closeTab(id: number) {
        let idx = -1;
        for (let i = 0; i < tabs.length; i++) { if (tabs[i].id === id) { idx = i; break; } }
        if (idx === -1) return;

        const tab = tabs[idx];
        tab.runGen++;

        // Closing the only tab: reset in place rather than spawning a new one.
        if (tabs.length === 1) {
            tab.session = makeSession("-- New query\n");
            tab.columns = tab.data = null;
            tab.commandMsg = tab.errorText = null;
            tab.rowsInfoText = "";
            tab.statusText = "Ready";
            tab.running = false;
            tab.loadStart = null;
            tab.recordViewMode = false;
            tab.recordIndex = 0;
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
        if (wasActive) renderActiveTab();
    }

    // ── Tab strip rendering ────────────────────────────────────────────
    export function updateTabStrip() {
        tabListEl.innerHTML = "";
        const frag = document.createDocumentFragment();
        for (const tab of tabs) frag.appendChild(buildTabEl(tab));
        tabListEl.appendChild(frag);

        const activeEl = tabListEl.querySelector<HTMLElement>(".tab.active");
        if (activeEl && typeof activeEl.scrollIntoView === "function")
            activeEl.scrollIntoView({ inline: "nearest", block: "nearest" });
    }

    function buildTabEl(tab: QueryTab): HTMLElement {
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
        close.appendChild(CLOSE_ICON_EL.cloneNode(true));
        el.appendChild(close);

        el.addEventListener("mousedown", (e: MouseEvent) => {
            if (e.button === 1) { e.preventDefault(); closeTab(tab.id); }
            else if (e.button === 0) switchToTab(tab.id);
        });
        close.addEventListener("mousedown", (e: MouseEvent) => e.stopPropagation());
        close.addEventListener("click", (e: MouseEvent) => { e.stopPropagation(); closeTab(tab.id); });
        return el;
    }

    // ── Render active tab (syncs all shared UI to the active tab state) ─
    export function renderActiveTab() {
        const tab = getActiveTab();
        if (!tab) return;

        if (editor.session !== tab.session) editor.setSession(tab.session);

        if (tab.errorText) showError(tab.errorText); else clearError();
        if (tab.commandMsg) showCommandMessage(tab.commandMsg); else showCommandMessage(null);

        // Grid calls are only safe after Tabulator has finished building.
        if (tableBuilt) {
            table.setColumns(tab.columns || []);
            table.setData(tab.data || []);
        }

        rowsInfo.textContent = tab.rowsInfoText || "";
        const hasData = !!(tab.data && tab.data.length > 0);
        exportWrap.style.display = hasData ? "" : "none";
        viewToggleWrap.style.display = hasData ? "" : "none";
        setStatus(tab.statusText || "Ready");
        setRunning(tab.running);

        if (tab.running) showLoading(); else hideLoading();

        applyViewMode(tab);

        editor.resize();
        if (tableBuilt && !(tab.recordViewMode && hasData)) table.redraw(true);
    }
}
