/// <reference path="../../../node_modules/@types/ace/index.d.ts" />
/// <reference path="../../../node_modules/@types/tabulator/index.d.ts" />

declare var Tabulator;

namespace Sql4CdsApp.SqlEditor {

    let editor: AceAjax.Editor;
    let table, statusEl, errorBox, rowsInfo;

    export function onLoad() {
        // -----------------------------
        // Ace setup (SQL)
        // -----------------------------
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

        // -----------------------------
        // Tabulator setup (grid)
        // -----------------------------
        table = new Tabulator("#grid", {
            layout: "fitDataFill",
            placeholder: "No results yet",
            height: "100%",
            selectable: true,
            clipboard: true
        });

        // -----------------------------
        // UI helpers
        // -----------------------------
        statusEl = document.getElementById("status");
        errorBox = document.getElementById("errorBox");
        rowsInfo = document.getElementById("rowsInfo");


        //-----------------------------
        // Events
        //-----------------------------
        // Toolbar
        document.getElementById("runBtn").addEventListener("click", run);

        document.getElementById("clearBtn").addEventListener("click", () => {
            table.clearData();
            table.setColumns([]);
            rowsInfo.textContent = "0 rows";
            setStatus("Cleared");
            clearError();
        });

        document.getElementById("formatBtn").addEventListener("click", () => {
            // Very simple formatter to keep it drop-in
            const s = editor.getValue()
                .replace(/\t/g, "  ")
                .replace(/[ \t]+$/gm, "")
                .trimEnd();
            editor.setValue(s + "\n", -1);
            setStatus("Formatted");
        });
    }

    function setStatus(text) { statusEl.textContent = text; }

    function showError(errText) {
        errorBox.style.display = "block";
        errorBox.textContent = errText;
    }

    function clearError() {
        errorBox.style.display = "none";
        errorBox.textContent = "";
    }

    function setGridFromResult(result) {
        // Expect:
        // { columns: ["a","b"], rows: [ {a:1,b:"x"}, ... ] } OR rows: [ [1,"x"], ... ]
        const cols = result.columns || [];
        const rows = result.rows || [];

        const tabColumns = cols.map(c => ({
            title: c,
            field: c,
            headerFilter: true,
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
        rowsInfo.textContent = `${dataObjects.length} rows`;
    }

    // -----------------------------
    // Replace this with YOUR execution
    // -----------------------------
    async function executeQuery(sqlText) {
        // Replace with your backend call (fetch/Xrm.WebApi/etc.)
        // Note: CSP connect-src may block external calls. 【1-d6fba3】

        // Demo result (remove):
        return {
            columns: ["accountid", "name", "description"],
            rows: [
                { accountid: "1", name: "Sample Account", description: "This is a sample account" },
                { accountid: "2", name: "Another Account", description: "This is another account" },
                { accountid: "3", name: "Third Account", description: "This is the third account" }
            ]
        };
    }

    // -----------------------------
    // Run flow
    // -----------------------------
    async function run() {
        clearError();
        setStatus("Running...");
        (document.getElementById("runBtn") as HTMLButtonElement).disabled = true;

        const sqlText = editor.getValue();

        try {
            const t0 = performance.now();
            const result = await executeQuery(sqlText);
            const t1 = performance.now();

            setGridFromResult(result);
            setStatus(`Success in ${(t1 - t0).toFixed(0)} ms`);
        } catch (e) {
            showError(e && e.stack ? e.stack : String(e));
            setStatus("Error");
        } finally {
            (document.getElementById("runBtn") as HTMLButtonElement).disabled = false;
        }
    }
}

document.addEventListener('readystatechange', () => {
    if (document.readyState == 'complete') {
        Sql4CdsApp.SqlEditor.onLoad();
    }
});