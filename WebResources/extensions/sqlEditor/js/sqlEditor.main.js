/// <reference path="../../../node_modules/@types/ace/index.d.ts" />
/// <reference path="../../../node_modules/@types/tabulator/index.d.ts" />
var Sql4CdsApp;
(function (Sql4CdsApp) {
    var SqlEditor;
    (function (SqlEditor) {
        let editor;
        let table, statusEl, errorBox, rowsInfo, commandMessage, loadingOverlay, loadingTimer;
        let runGeneration = 0;
        let timerInterval = null;
        function onLoad() {
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
            editor.setValue(`-- Write SQL here.
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
            statusEl = document.getElementById("status");
            errorBox = document.getElementById("errorBox");
            rowsInfo = document.getElementById("rowsInfo");
            commandMessage = document.getElementById("commandMessage");
            loadingOverlay = document.getElementById("loadingOverlay");
            loadingTimer = document.getElementById("loadingTimer");
            // ── Toolbar events ─────────────────────────────────────────────
            document.getElementById("runBtn").addEventListener("click", run);
            document.getElementById("clearBtn").addEventListener("click", () => {
                table.clearData();
                table.setColumns([]);
                showCommandMessage(null);
                rowsInfo.textContent = "";
                setStatus("Cleared");
                clearError();
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
                runGeneration++;
                hideLoading();
                setStatus("Cancelled");
                setRunning(false);
            });
            // ── Divider drag ───────────────────────────────────────────────
            setupDivider();
            // ── Window resize: reclamp and redraw ──────────────────────────
            window.addEventListener("resize", onWindowResize);
        }
        SqlEditor.onLoad = onLoad;
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
            }
            else {
                dataObjects = rows;
            }
            table.setColumns(tabColumns);
            table.setData(dataObjects);
            showCommandMessage(null);
            rowsInfo.textContent = `${dataObjects.length} rows`;
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
                if (myGen !== runGeneration)
                    return;
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
                }
                else {
                    setGridFromResult(result);
                }
                setStatus(`Done in ${elapsed} ms`);
            }
            catch (e) {
                if (myGen !== runGeneration)
                    return;
                showError(e && e.stack ? e.stack : String(e));
                setStatus("Error");
            }
            finally {
                if (myGen === runGeneration) {
                    hideLoading();
                    setRunning(false);
                }
            }
        }
    })(SqlEditor = Sql4CdsApp.SqlEditor || (Sql4CdsApp.SqlEditor = {}));
})(Sql4CdsApp || (Sql4CdsApp = {}));
document.addEventListener("readystatechange", () => {
    if (document.readyState === "complete") {
        Sql4CdsApp.SqlEditor.onLoad();
    }
});
//# sourceMappingURL=sqlEditor.main.js.map