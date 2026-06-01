namespace Sql4CdsApp.SqlEditor {

    const SQL_KEYWORDS = [
        "SELECT","FROM","WHERE","JOIN","INNER JOIN","LEFT JOIN","RIGHT JOIN","FULL JOIN","CROSS JOIN",
        "ON","GROUP BY","ORDER BY","HAVING","TOP","DISTINCT","AS","AND","OR","NOT","NULL",
        "IS NULL","IS NOT NULL","IN","LIKE","BETWEEN","EXISTS","UNION","UNION ALL",
        "INSERT","INTO","VALUES","UPDATE","SET","DELETE","CASE","WHEN","THEN","ELSE","END",
        "ASC","DESC","OFFSET","FETCH","WITH","CROSS APPLY","OUTER APPLY"
    ];

    const SQL_FUNCTIONS = [
        "COUNT","SUM","AVG","MIN","MAX","ISNULL","COALESCE","CAST","CONVERT","GETDATE",
        "DATEADD","DATEDIFF","DATEPART","YEAR","MONTH","DAY","LEN","SUBSTRING","CHARINDEX",
        "REPLACE","UPPER","LOWER","LTRIM","RTRIM","CONCAT","STRING_AGG","ROW_NUMBER","RANK"
    ];

    // The identifier immediately before a trailing dot at the cursor, if any.
    function dotContext(session, pos): string | null {
        const line = session.getLine(pos.row).slice(0, pos.column);
        const m = /([A-Za-z_][A-Za-z0-9_]*)\.\s*[A-Za-z0-9_]*$/.exec(line);
        return m ? m[1].toLowerCase() : null;
    }

    // Parse FROM/JOIN clauses into a token -> LogicalName map.
    function buildAliasMap(text: string): { [token: string]: string } {
        const map: { [token: string]: string } = {};
        const KW = /^(on|where|inner|left|right|full|cross|outer|join|group|order|having|union|as)$/i;
        const re = /\b(?:from|join)\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+(?:as\s+)?([A-Za-z_][A-Za-z0-9_]*))?/gi;
        let m;
        while ((m = re.exec(text)) !== null) {
            const ent = entityByName[m[1].toLowerCase()];
            if (!ent) continue;
            map[m[1].toLowerCase()] = ent.LogicalName;
            if (m[2] && !KW.test(m[2])) map[m[2].toLowerCase()] = ent.LogicalName;
        }
        return map;
    }

    function colCompletion(a, score: number) {
        const v = (a.SchemaName || "").toLowerCase();
        return { caption: v, value: v, meta: a.AttributeType || "column", score };
    }

    function uniq(arr: string[]): string[] {
        const seen: { [k: string]: 1 } = {}, out: string[] = [];
        for (const x of arr) if (!seen[x]) { seen[x] = 1; out.push(x); }
        return out;
    }

    function textBeforeCursor(session, pos): string {
        const lines = session.getLines(0, pos.row);
        if (lines.length) lines[lines.length - 1] = lines[lines.length - 1].slice(0, pos.column);
        return lines.join("\n");
    }

    // Which clause is the cursor in, based on the last clause keyword seen before it?
    function clauseContext(before: string): "table" | "column" | "other" {
        const re = /\b(select|from|join|where|group\s+by|order\s+by|having|on|set|into|update|values)\b/gi;
        let last: string | null = null, m;
        while ((m = re.exec(before)) !== null) last = m[1].toLowerCase().replace(/\s+/g, " ");
        if (!last) return "other";
        if (last === "from" || last === "join" || last === "into" || last === "update") return "table";
        if (last === "select" || last === "where" || last === "on" || last === "set" ||
            last === "having" || last === "group by" || last === "order by") return "column";
        return "other";
    }

    const keywordCompleter: AceAjax.Completer = {
        getCompletions(_editor, session, pos, _prefix, callback) {
            if (dotContext(session, pos)) { callback(null, []); return; }
            const kw = SQL_KEYWORDS.map(k => ({ caption: k, value: k, meta: "keyword",   score: 1000 }));
            const fn = SQL_FUNCTIONS.map(f => ({ caption: f, value: f, meta: "function",  score: 900  }));
            callback(null, kw.concat(fn) as any);
        }
    };

    const tableCompleter: AceAjax.Completer = {
        getCompletions(_editor, session, pos, _prefix, callback) {
            if (dotContext(session, pos)) { callback(null, []); return; }
            const ctx   = clauseContext(textBeforeCursor(session, pos));
            const score = ctx === "table" ? 1300 : ctx === "column" ? 400 : 500;
            const results = entityList.map(e => {
                const v = (e.SchemaName || "").toLowerCase();
                return { caption: v, value: v, meta: "table", score };
            });
            callback(null, results as any);
        }
    };

    const columnCompleter: AceAjax.Completer = {
        getCompletions(_editor, session, pos, _prefix, callback) {
            const text     = session.getValue();
            const aliasMap = buildAliasMap(text);
            const dot      = dotContext(session, pos);

            if (dot) {
                const ent     = entityByName[dot];
                const logical = aliasMap[dot] || (ent && ent.LogicalName);
                if (!logical) { callback(null, []); return; }
                getAttributes(logical)
                    .then(attrs => callback(null, attrs.map(a => colCompletion(a, 1300)) as any))
                    .catch(() => callback(null, []));
                return;
            }

            const logicals = uniq(Object.keys(aliasMap).map(k => aliasMap[k]));
            if (logicals.length === 0) { callback(null, []); return; }
            const ctx   = clauseContext(textBeforeCursor(session, pos));
            const score = ctx === "column" ? 1200 : ctx === "table" ? 600 : 800;
            Promise.all(logicals.map(l => getAttributes(l)))
                .then(lists => {
                    const out: any[] = [], seen: { [v: string]: 1 } = {};
                    lists.forEach(attrs => attrs.forEach(a => {
                        const v = (a.SchemaName || "").toLowerCase();
                        if (!seen[v]) { seen[v] = 1; out.push(colCompletion(a, score)); }
                    }));
                    callback(null, out);
                })
                .catch(() => callback(null, []));
        }
    };

    export function setupAutocomplete() {
        (ace as any).require("ace/ext/language_tools");
        (editor as any).completers = [keywordCompleter, tableCompleter, columnCompleter];
        (editor as any).setOptions({
            enableBasicAutocompletion: true,
            enableLiveAutocompletion:  settings.autoSuggest,
            enableSnippets:            false
        });

        // Dot trigger: an empty prefix won't auto-open the popup, so kick it ourselves.
        editor.commands.on("afterExec", (e: any) => {
            if (!settings.autoSuggest) return;
            if (e.command?.name === "insertstring" && e.args === ".")
                e.editor.execCommand("startAutocomplete");
        });
    }
}
