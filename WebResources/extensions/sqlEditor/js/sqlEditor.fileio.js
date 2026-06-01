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