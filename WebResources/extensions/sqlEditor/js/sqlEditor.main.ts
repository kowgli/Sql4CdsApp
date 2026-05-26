/// <reference path="../../../node_modules/@types/ace/index.d.ts" />
/// <reference path="../../../node_modules/@types/tabulator/index.d.ts" />

declare var Tabulator;

namespace Sql4CdsApp.SqlEditor {

    let editor: AceAjax.Editor;
    let table, statusEl, errorBox, rowsInfo, commandMessage;

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
            `-- Write SQL here. You handle execution.
-- Ctrl+Enter to run.

SELECT *
FROM account
WHERE statecode = 0;
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
            const s = editor.getValue()
                .replace(/\t/g, "  ")
                .replace(/[ \t]+$/gm, "")
                .trimEnd();
            editor.setValue(s + "\n", -1);
            setStatus("Formatted");
        });

        // ── Divider drag ───────────────────────────────────────────────
        setupDivider();

        // ── Window resize: reclamp and redraw ──────────────────────────
        window.addEventListener("resize", onWindowResize);
    }

    // ── Divider / splitter ─────────────────────────────────────────────
    function setupDivider() {
        const divider = document.getElementById("divider")!;
        const editorPanel = document.getElementById("editorPanel")!;
        const mainEl = document.getElementById("main")!;

        let isDragging = false;
        let startY = 0;
        let startEditorH = 0;
        let editorHeightPx: number | null = null; // null → flex layout

        function stopDrag() {
            if (!isDragging) return;
            isDragging = false;
            divider.classList.remove("dragging");
            editor.resize();
            table.redraw(true);
        }

        divider.addEventListener("pointerdown", (e: PointerEvent) => {
            isDragging = true;
            startY = e.clientY;
            startEditorH = editorPanel.getBoundingClientRect().height;
            divider.setPointerCapture(e.pointerId);
            divider.classList.add("dragging");
            e.preventDefault();
        });

        divider.addEventListener("pointermove", (e: PointerEvent) => {
            if (!isDragging) return;
            const dy = e.clientY - startY;
            const mainH = mainEl.getBoundingClientRect().height;
            const divH = divider.offsetHeight;
            const minH = 80;
            const newH = Math.max(minH, Math.min(mainH - divH - minH, startEditorH + dy));
            editorHeightPx = newH;
            editorPanel.style.flex = `0 0 ${newH}px`;
            editor.resize();
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

    // ── Query execution (replace with your backend call) ──────────────
    async function executeQuery(sqlText: string) {
        const execSqlRequest = {        
            Request: sqlText,
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
        (document.getElementById("runBtn") as HTMLButtonElement).disabled = true;

        const selection = editor.session.getTextRange(editor.getSelectionRange());
        const sqlText = selection.trim() ? selection : editor.getValue();

        try {
            const t0 = performance.now();
            const result = await executeQuery(sqlText);
            const elapsed = (performance.now() - t0).toFixed(0);

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
            showError(e && e.stack ? e.stack : String(e));
            setStatus("Error");
        } finally {
            (document.getElementById("runBtn") as HTMLButtonElement).disabled = false;
        }
    }
}

document.addEventListener("readystatechange", () => {
    if (document.readyState === "complete") {
        Sql4CdsApp.SqlEditor.onLoad();
    }
});
