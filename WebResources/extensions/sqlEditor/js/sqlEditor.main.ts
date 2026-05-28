/// <reference path="../../../node_modules/@types/ace/index.d.ts" />
/// <reference path="../../../node_modules/@types/tabulator/index.d.ts" />

declare var Tabulator;
declare var sqlFormatter: any;

namespace Sql4CdsApp.SqlEditor {

    let editor: AceAjax.Editor;
    let table, statusEl, errorBox, rowsInfo, commandMessage, loadingOverlay, loadingTimer;
    let runGeneration = 0;
    let timerInterval: number | null = null;

    // Object explorer (metadata) state
    let metaTreeEl: HTMLElement, refreshMetaBtn: HTMLButtonElement, metaSearchInput: HTMLInputElement;
    const attributeCache: { [logicalName: string]: any[] } = {};

    export function onLoad() {
        // ── Ace setup ──────────────────────────────────────────────────
        editor = ace.edit("editor");
        editor.session.setMode("ace/mode/sql");
        editor.setTheme("ace/theme/sqlserver");
        editor.setOptions({
            fontSize: "13px",
            showPrintMargin: false,
            wrap: true,
            tabSize: 2,
            useSoftTabs: true
        });

        editor.setValue(
            `-- Write SQL here.
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
    `, -1);

        editor.commands.addCommand({
            name: "runQuery",
            bindKey: { win: "Ctrl-Enter", mac: "Command-Enter" },
            exec: () => run()
        });

        // ── Tabulator setup ────────────────────────────────────────────
        table = new Tabulator("#grid", {
            layout: "fitDataFill",
            placeholder: "No results yet",
            height: "100%",
            selectable: true,
            clipboard: true
        });

        // ── UI helpers ─────────────────────────────────────────────────
        statusEl       = document.getElementById("status");
        errorBox       = document.getElementById("errorBox");
        rowsInfo       = document.getElementById("rowsInfo");
        commandMessage = document.getElementById("commandMessage");
        loadingOverlay = document.getElementById("loadingOverlay");
        loadingTimer   = document.getElementById("loadingTimer");

        // ── Toolbar events ─────────────────────────────────────────────
        document.getElementById("runBtn")!.addEventListener("click", run);

        document.getElementById("clearBtn")!.addEventListener("click", () => {
            table.clearData();
            table.setColumns([]);
            showCommandMessage(null);
            rowsInfo.textContent = "";
            setStatus("Cleared");
            clearError();
        });

        document.getElementById("formatBtn")!.addEventListener("click", () => {
            const sql = editor.getValue();
            try {
                const formatted = sqlFormatter.format(sql, { language: "tsql" });
                editor.setValue(formatted, -1);
                setStatus("Formatted");
            } catch {
                setStatus("Format failed");
            }
        });

        document.getElementById("cancelBtn")!.addEventListener("click", () => {
            runGeneration++;
            hideLoading();
            setStatus("Cancelled");
            setRunning(false);
        });

        // ── Divider drag ───────────────────────────────────────────────
        setupDivider();

        // ── Object explorer (metadata tree) ────────────────────────────
        metaTreeEl     = document.getElementById("metaTree")!;
        refreshMetaBtn = document.getElementById("refreshMetaBtn") as HTMLButtonElement;
        refreshMetaBtn.addEventListener("click", () => { void refreshMetadata(); });
        setupMetaSearch();
        setupMetaDivider();
        void initMetadata(); // async, non-blocking — the rest of the page stays usable

        // ── Window resize: reclamp and redraw ──────────────────────────
        window.addEventListener("resize", onWindowResize);
    }

    // ── Object explorer / metadata divider (horizontal width drag) ──────
    function setupMetaDivider() {
        const divider = document.getElementById("metaDivider")!;
        const panel = document.getElementById("metadataPanel")!;
        const container = document.getElementById("app")!; // holds [panel | divider | right pane]

        let isDragging = false;
        let startX = 0;
        let startW = 0;
        let wsWCached = 0;
        let latestX = 0;
        let rafId: number | null = null;
        let widthPx: number | null = null;

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
            if (!isDragging) return;
            isDragging = false;
            if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
            divider.classList.remove("dragging");
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
            editor.resize();
            table.redraw(true);
        }

        divider.addEventListener("pointerdown", (e: PointerEvent) => {
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

        divider.addEventListener("pointermove", (e: PointerEvent) => {
            if (!isDragging) return;
            latestX = e.clientX;
            if (rafId === null) rafId = requestAnimationFrame(applyDrag);
        });

        divider.addEventListener("pointerup", stopDrag);
        divider.addEventListener("pointercancel", stopDrag);
        divider.addEventListener("lostpointercapture", stopDrag);
        window.addEventListener("blur", stopDrag);

        // Reclamp stored width when the host frame is resized
        window.addEventListener("resize", () => {
            if (widthPx === null) return;
            const wsW = container.getBoundingClientRect().width;
            const maxW = wsW - 240;
            if (widthPx > maxW) {
                widthPx = Math.max(160, maxW);
                panel.style.flex = `0 0 ${widthPx}px`;
            }
        });
    }

    // ── Divider / splitter ─────────────────────────────────────────────
    function setupDivider() {
        const divider = document.getElementById("divider")!;
        const editorPanel = document.getElementById("editorPanel")!;
        const gridEl = document.getElementById("grid")!;
        const skeletonEl = document.getElementById("resizeSkeleton")!;
        const mainEl = document.getElementById("main")!;

        let isDragging = false;
        let startY = 0;
        let startEditorH = 0;
        let editorHeightPx: number | null = null; // null → flex layout
        let gridDisplayBeforeDrag = "";
        // Cached during drag to avoid forced reflows in pointermove
        let mainHCached = 0;
        let divHCached = 0;
        let latestY = 0;
        let rafId: number | null = null;

        function applyDrag() {
            rafId = null;
            const minH = 80;
            const newH = Math.max(minH, Math.min(mainHCached - divHCached - minH, startEditorH + (latestY - startY)));
            editorHeightPx = newH;
            editorPanel.style.flex = `0 0 ${newH}px`;
            editor.resize();
        }

        function stopDrag() {
            if (!isDragging) return;
            isDragging = false;
            if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
            divider.classList.remove("dragging");
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
            // Hide skeleton, restore grid, redraw at final size
            skeletonEl.style.display = "none";
            gridEl.style.display = gridDisplayBeforeDrag;
            editor.resize();
            table.redraw(true);
        }

        divider.addEventListener("pointerdown", (e: PointerEvent) => {
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

        divider.addEventListener("pointermove", (e: PointerEvent) => {
            if (!isDragging) return;
            latestY = e.clientY;
            // Throttle style updates to one per animation frame
            if (rafId === null) rafId = requestAnimationFrame(applyDrag);
        });

        divider.addEventListener("pointerup", stopDrag);
        divider.addEventListener("pointercancel", stopDrag);
        divider.addEventListener("lostpointercapture", stopDrag);
        window.addEventListener("blur", stopDrag);

        // Reclamp stored height when the host frame is resized
        window.addEventListener("resize", () => {
            if (editorHeightPx === null) return;
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
    function setStatus(text: string) { statusEl.textContent = text; }

    function setRunning(running: boolean) {
        (document.getElementById("runBtn") as HTMLButtonElement).disabled = running;
        (document.getElementById("clearBtn") as HTMLButtonElement).disabled = running;
        (document.getElementById("formatBtn") as HTMLButtonElement).disabled = running;
    }

    function showLoading() {
        if (timerInterval !== null) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        const start = Date.now();
        loadingTimer.textContent = "0s";
        loadingOverlay.style.display = "flex";
        timerInterval = window.setInterval(() => {
            const elapsed = Math.floor((Date.now() - start) / 1000);
            loadingTimer.textContent = elapsed + "s";
        }, 500);
    }

    function hideLoading() {
        loadingOverlay.style.display = "none";
        if (timerInterval !== null) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function showError(errText: string) {
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
    function showCommandMessage(msg: string | null) {
        if (msg) {
            commandMessage.textContent = msg;
            commandMessage.style.display = "flex";
            document.getElementById("grid")!.style.display = "none";
        } else {
            commandMessage.style.display = "none";
            document.getElementById("grid")!.style.display = "";
        }
    }

    function setGridFromResult(result) {
        const cols = result.columns || [];
        const rows = result.rows || [];

        const tabColumns = cols.map(c => ({
            title: c,
            field: c,
            headerSort: true,
            resizable: true
        }));

        let dataObjects;
        if (rows.length > 0 && Array.isArray(rows[0])) {
            dataObjects = rows.map(r => {
                const o = {};
                cols.forEach((c, i) => o[c] = r[i]);
                return o;
            });
        } else {
            dataObjects = rows;
        }

        table.setColumns(tabColumns);
        table.setData(dataObjects);
        showCommandMessage(null);
        rowsInfo.textContent = `${dataObjects.length} rows`;
    }

    // ── Query execution ───────────────────────────────────────────────
    async function executeQuery(sqlText: string) {
        const requestModel = {
            sql: sqlText,
            bypassCustomPlugins: (document.getElementById("optBypassPlugins") as HTMLInputElement).checked,
            useLocalTimeZone: (document.getElementById("optLocalTime") as HTMLInputElement).checked,
            blockDeleteWithoutWhere: (document.getElementById("optBlockDelete") as HTMLInputElement).checked,
            blockUpdateWithoutWhere: (document.getElementById("optBlockUpdate") as HTMLInputElement).checked
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
    async function run() {
        clearError();
        setStatus("Running…");
        setRunning(true);
        showLoading();

        const myGen = ++runGeneration;
        const selection = editor.session.getTextRange(editor.getSelectionRange());
        const sqlText = selection.trim() ? selection : editor.getValue();

        try {
            const t0 = performance.now();
            const result = await executeQuery(sqlText);
            const elapsed = (performance.now() - t0).toFixed(0);

            if (myGen !== runGeneration) return;

            if (!result.isSuccess) {
                showError(result.errorText || "Unknown error");
                setStatus("Error");
                return;
            }

            if (result.emptyResult) {
                table.clearData();
                table.setColumns([]);
                showCommandMessage("Command executed successfully");
                rowsInfo.textContent = result.recordsAffected > 0
                    ? `${result.recordsAffected} row(s) affected`
                    : "";
            } else {
                setGridFromResult(result);
            }
            setStatus(`Done in ${elapsed} ms`);
        } catch (e: any) {
            if (myGen !== runGeneration) return;
            showError(e && e.stack ? e.stack : String(e));
            setStatus("Error");
        } finally {
            if (myGen === runGeneration) {
                hideLoading();
                setRunning(false);
            }
        }
    }

    // ── Object explorer / metadata ──────────────────────────────────────
    const ICON_TABLE =
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
        '<path d="M1.5 2h13v12h-13V2zm1 1v2.5h11V3h-11zm0 3.5V9h4V6.5h-4zm5 0V9h6V6.5h-6zm-5 3.5v3h4v-3h-4zm5 0v3h6v-3h-6z"/></svg>';
    const ICON_FIELD =
        '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
        '<circle cx="8" cy="8" r="3.25"/></svg>';

    async function fetchMetadata(path: string): Promise<any> {
        const clientUrl = Xrm.Utility.getGlobalContext().getClientUrl();
        const resp = await fetch(clientUrl + "/api/data/v9.2/" + path, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0"
            }
        });
        if (!resp.ok) throw new Error("Metadata request failed: " + resp.status + " " + resp.statusText);
        return resp.json();
    }

    function bySchemaName(a, b) {
        return String(a.SchemaName).toLowerCase().localeCompare(String(b.SchemaName).toLowerCase());
    }

    function setMetaTreeMessage(kind: "loading" | "error" | "empty", text: string) {
        const cls = kind === "error" ? "meta-error" : "meta-loading";
        const spinner = kind === "loading" ? '<span class="meta-spinner"></span>' : "";
        const span = document.createElement("span");
        span.textContent = text;
        metaTreeEl.innerHTML = '<div class="' + cls + '">' + spinner + '</div>';
        metaTreeEl.firstElementChild!.appendChild(span);
    }

    async function initMetadata() {
        setMetaTreeMessage("loading", "Loading tables…");
        refreshMetaBtn.disabled = true;
        refreshMetaBtn.classList.add("spinning");
        try {
            const data = await fetchMetadata("EntityDefinitions?$select=LogicalName,SchemaName");
            const entities = (data.value || []).filter(e => e.SchemaName).sort(bySchemaName);
            renderTables(entities);
        } catch (err) {
            setMetaTreeMessage("error", "Failed to load tables. Click ⟳ to retry.");
        } finally {
            refreshMetaBtn.disabled = false;
            refreshMetaBtn.classList.remove("spinning");
        }
    }

    async function refreshMetadata() {
        for (const k in attributeCache) delete attributeCache[k];
        await initMetadata();
    }

    // ── Object explorer search / filter ─────────────────────────────────
    function setupMetaSearch() {
        metaSearchInput = document.getElementById("metaSearch") as HTMLInputElement;
        const wrap = metaSearchInput.parentElement!;
        const clearBtn = document.getElementById("metaSearchClear")!;
        let raf: number | null = null;

        function schedule() {
            wrap.classList.toggle("has-text", metaSearchInput.value.length > 0);
            if (raf !== null) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => { raf = null; applyFilter(metaSearchInput.value); });
        }

        metaSearchInput.addEventListener("input", schedule);
        metaSearchInput.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Escape") { metaSearchInput.value = ""; schedule(); }
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
    function applyFilter(query: string) {
        const q = query.trim().toLowerCase();
        const nodes = metaTreeEl.querySelectorAll<HTMLElement>(".tree-node");
        nodes.forEach(node => {
            const tableRow = node.querySelector(".tree-table-row") as HTMLElement;
            if (!tableRow) return;
            const tlabelEl = tableRow.querySelector(".tree-label");
            const tlabel = tlabelEl && tlabelEl.textContent ? tlabelEl.textContent.toLowerCase() : "";
            const tableMatch = q === "" || tlabel.indexOf(q) !== -1;

            const children = node.querySelector(".tree-children") as HTMLElement;
            const fieldRows = node.querySelectorAll<HTMLElement>(".tree-field-row");
            let anyFieldMatch = false;

            fieldRows.forEach(fr => {
                const fl = fr.querySelector(".tree-label");
                let show: boolean;
                if (q === "" || tableMatch) {
                    show = true;
                } else if (fl && fl.textContent) {
                    const matched = fl.textContent.toLowerCase().indexOf(q) !== -1;
                    show = matched;
                    if (matched) anyFieldMatch = true;
                } else {
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
        if (metaSearchInput && metaSearchInput.value) applyFilter(metaSearchInput.value);
    }

    function renderTables(entities) {
        metaTreeEl.innerHTML = "";
        if (entities.length === 0) {
            setMetaTreeMessage("empty", "No tables found");
            return;
        }
        const frag = document.createDocumentFragment();
        for (const ent of entities) frag.appendChild(buildTableNode(ent));
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

        row.addEventListener("click", (e: MouseEvent) => {
            if (e.detail > 1) return; // ignore the 2nd click of a double-click (which inserts)
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

    async function loadFields(ent, children: HTMLElement) {
        children.innerHTML =
            '<div class="tree-loading tree-field-row"><span class="tree-spinner"></span><span>Loading…</span></div>';
        let attrs = attributeCache[ent.LogicalName];
        if (!attrs) {
            const data = await fetchMetadata(
                "EntityDefinitions(LogicalName='" + ent.LogicalName +
                "')/Attributes?$select=LogicalName,SchemaName,AttributeType");
            attrs = (data.value || []).filter(a => a.SchemaName).sort(bySchemaName);
            attributeCache[ent.LogicalName] = attrs; // cache once loaded
        }
        children.innerHTML = "";
        if (attrs.length === 0) {
            children.innerHTML = '<div class="tree-empty tree-field-row">No columns</div>';
            return;
        }
        const frag = document.createDocumentFragment();
        for (const attr of attrs) frag.appendChild(buildFieldNode(attr));
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

    function insertIntoEditor(text: string) {
        editor.session.insert(editor.getCursorPosition(), text);
        editor.focus();
    }
}

document.addEventListener("readystatechange", () => {
    if (document.readyState === "complete") {
        Sql4CdsApp.SqlEditor.onLoad();
    }
});
