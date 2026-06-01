namespace Sql4CdsApp.SqlEditor {

    // ── Tab-delimited clipboard format ─────────────────────────────────
    // RFC-4180-compatible quoting: values containing tabs, newlines or quotes
    // are wrapped in double quotes; internal quotes are doubled.
    export function buildTabDelimited(tab: QueryTab): string {
        if (!tab.columns || !tab.data) return "";
        const fields = tab.columns.map(c => c.field as string);
        const escape = (v: any): string => {
            const s = v == null ? "" : String(v);
            if (s.includes("\t") || s.includes("\n") || s.includes('"'))
                return '"' + s.replace(/"/g, '""') + '"';
            return s;
        };
        const header = fields.map(escape).join("\t");
        const rows   = tab.data.map(row => fields.map(f => escape(row[f])).join("\t"));
        return [header, ...rows].join("\r\n");
    }

    // ── Save query to file ─────────────────────────────────────────────
    export async function saveQuery(): Promise<void> {
        const tab = getActiveTab();
        if (!tab) return;
        const sql = editor.getValue();

        if (typeof (window as any).showSaveFilePicker === "function") {
            try {
                const handle: any = await (window as any).showSaveFilePicker({
                    suggestedName: tab.title + ".sql",
                    types: [{ description: "SQL files", accept: { "text/plain": [".sql"] } }]
                });
                const writable = await handle.createWritable();
                await writable.write(sql);
                await writable.close();
                tab.title = (handle.name as string).replace(/\.sql$/i, "");
                updateTabStrip();
                return;
            } catch (e: any) {
                if (e.name === "AbortError") return;
                // File System Access API blocked (e.g. cross-origin iframe) — fall through
            }
        }

        // Fallback: trigger a download via a temporary anchor element.
        const blob = new Blob([sql], { type: "text/plain" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = tab.title + ".sql";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ── Open query from file ───────────────────────────────────────────
    export function openQuery(): void {
        const input   = document.createElement("input");
        input.type    = "file";
        input.accept  = ".sql,.txt";
        input.style.display = "none";
        document.body.appendChild(input);
        input.onchange = async () => {
            const file = input.files?.[0];
            document.body.removeChild(input);
            if (!file) return;
            const text    = await file.text();
            const tabName = file.name.replace(/\.(sql|txt)$/i, "");
            const tab     = createTab(text);
            tab.title     = tabName;
            switchToTab(tab.id);
        };
        input.click();
    }
}
