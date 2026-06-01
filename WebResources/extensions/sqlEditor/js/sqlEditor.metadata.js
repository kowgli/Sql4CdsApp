var Sql4CdsApp;
(function (Sql4CdsApp) {
    var SqlEditor;
    (function (SqlEditor) {
        const ICON_TABLE_SVG = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
            '<path d="M1.5 2h13v12h-13V2zm1 1v2.5h11V3h-11zm0 3.5V9h4V6.5h-4zm5 0V9h6V6.5h-6zm-5 3.5v3h4v-3h-4zm5 0v3h6v-3h-6z"/></svg>';
        const ICON_FIELD_SVG = '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
            '<circle cx="8" cy="8" r="3.25"/></svg>';
        function parseSvg(svgString) {
            return new DOMParser().parseFromString(svgString, "image/svg+xml").documentElement;
        }
        // ── Dataverse metadata REST helper ─────────────────────────────────
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
        SqlEditor.fetchMetadata = fetchMetadata;
        function bySchemaName(a, b) {
            return String(a.SchemaName).toLowerCase().localeCompare(String(b.SchemaName).toLowerCase());
        }
        // ── Attribute cache + fetcher (shared with autocomplete) ───────────
        async function getAttributes(logicalName) {
            let attrs = SqlEditor.attributeCache[logicalName];
            if (!attrs) {
                const data = await fetchMetadata("EntityDefinitions(LogicalName='" + logicalName +
                    "')/Attributes?$select=LogicalName,SchemaName,AttributeType");
                attrs = (data.value || []).filter(a => a.SchemaName).sort(bySchemaName);
                SqlEditor.attributeCache[logicalName] = attrs;
            }
            return attrs;
        }
        SqlEditor.getAttributes = getAttributes;
        // ── Tree status messages ───────────────────────────────────────────
        function setMetaTreeMessage(kind, text) {
            SqlEditor.metaTreeEl.textContent = "";
            const wrap = document.createElement("div");
            wrap.className = kind === "error" ? "meta-error" : "meta-loading";
            if (kind === "loading") {
                const spinner = document.createElement("span");
                spinner.className = "meta-spinner";
                wrap.appendChild(spinner);
            }
            const label = document.createElement("span");
            label.textContent = text;
            wrap.appendChild(label);
            SqlEditor.metaTreeEl.appendChild(wrap);
        }
        // ── Load / refresh entity list ─────────────────────────────────────
        async function initMetadata() {
            setMetaTreeMessage("loading", "Loading tables…");
            SqlEditor.refreshMetaBtn.disabled = true;
            SqlEditor.refreshMetaBtn.classList.add("spinning");
            try {
                const data = await fetchMetadata("EntityDefinitions?$select=LogicalName,SchemaName");
                const entities = (data.value || []).filter(e => e.SchemaName).sort(bySchemaName);
                SqlEditor.entityList = entities;
                SqlEditor.entityByName = {};
                for (const e of entities)
                    SqlEditor.entityByName[(e.SchemaName || "").toLowerCase()] = e;
                renderTables(entities);
            }
            catch {
                setMetaTreeMessage("error", "Failed to load tables. Click ⟳ to retry.");
            }
            finally {
                SqlEditor.refreshMetaBtn.disabled = false;
                SqlEditor.refreshMetaBtn.classList.remove("spinning");
            }
        }
        SqlEditor.initMetadata = initMetadata;
        async function refreshMetadata() {
            for (const k in SqlEditor.attributeCache)
                delete SqlEditor.attributeCache[k];
            SqlEditor.entityList = [];
            SqlEditor.entityByName = {};
            await initMetadata();
        }
        SqlEditor.refreshMetadata = refreshMetadata;
        // ── Tree rendering ─────────────────────────────────────────────────
        function renderTables(entities) {
            SqlEditor.metaTreeEl.textContent = "";
            if (entities.length === 0) {
                setMetaTreeMessage("empty", "No tables found");
                return;
            }
            const frag = document.createDocumentFragment();
            for (const ent of entities)
                frag.appendChild(buildTableNode(ent));
            SqlEditor.metaTreeEl.appendChild(frag);
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
            icon.appendChild(parseSvg(ICON_TABLE_SVG));
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
                    return;
                const isExpanded = node.classList.toggle("expanded");
                children.style.display = isExpanded ? "" : "none";
                if (isExpanded && !node.dataset.loaded) {
                    node.dataset.loaded = "1";
                    loadFields(ent, children).catch(() => {
                        delete node.dataset.loaded;
                        children.textContent = "";
                        const errRow = document.createElement("div");
                        errRow.className = "tree-error tree-field-row";
                        errRow.textContent = "Failed to load columns";
                        children.appendChild(errRow);
                    });
                }
            });
            row.addEventListener("dblclick", () => insertIntoEditor(name));
            node.appendChild(row);
            node.appendChild(children);
            return node;
        }
        async function loadFields(ent, children) {
            children.textContent = "";
            const loadingRow = document.createElement("div");
            loadingRow.className = "tree-loading tree-field-row";
            const spinner = document.createElement("span");
            spinner.className = "tree-spinner";
            const loadingText = document.createElement("span");
            loadingText.textContent = "Loading…";
            loadingRow.appendChild(spinner);
            loadingRow.appendChild(loadingText);
            children.appendChild(loadingRow);
            const attrs = await getAttributes(ent.LogicalName);
            children.textContent = "";
            if (attrs.length === 0) {
                const emptyRow = document.createElement("div");
                emptyRow.className = "tree-empty tree-field-row";
                emptyRow.textContent = "No columns";
                children.appendChild(emptyRow);
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
            icon.appendChild(parseSvg(ICON_FIELD_SVG));
            const label = document.createElement("span");
            label.className = "tree-label";
            label.textContent = name;
            row.appendChild(icon);
            row.appendChild(label);
            row.addEventListener("dblclick", () => insertIntoEditor(name));
            return row;
        }
        function insertIntoEditor(text) {
            SqlEditor.editor.session.insert(SqlEditor.editor.getCursorPosition(), text);
            SqlEditor.editor.focus();
        }
        SqlEditor.insertIntoEditor = insertIntoEditor;
        // ── Search / filter ────────────────────────────────────────────────
        function setupMetaSearch() {
            SqlEditor.metaSearchInput = document.getElementById("metaSearch");
            const wrap = SqlEditor.metaSearchInput.parentElement;
            const clearBtn = document.getElementById("metaSearchClear");
            let raf = null;
            function schedule() {
                wrap.classList.toggle("has-text", SqlEditor.metaSearchInput.value.length > 0);
                if (raf !== null)
                    cancelAnimationFrame(raf);
                raf = requestAnimationFrame(() => { raf = null; applyFilter(SqlEditor.metaSearchInput.value); });
            }
            SqlEditor.metaSearchInput.addEventListener("input", schedule);
            SqlEditor.metaSearchInput.addEventListener("keydown", (e) => {
                if (e.key === "Escape") {
                    SqlEditor.metaSearchInput.value = "";
                    schedule();
                }
            });
            clearBtn.addEventListener("click", () => {
                SqlEditor.metaSearchInput.value = "";
                schedule();
                SqlEditor.metaSearchInput.focus();
            });
        }
        SqlEditor.setupMetaSearch = setupMetaSearch;
        // Filters the rendered tree. Tables always match by name; fields are
        // filtered for tables whose columns are already loaded.
        function applyFilter(query) {
            const q = query.trim().toLowerCase();
            const nodes = SqlEditor.metaTreeEl.querySelectorAll(".tree-node");
            nodes.forEach(node => {
                var _a, _b;
                const tableRow = node.querySelector(".tree-table-row");
                if (!tableRow)
                    return;
                const tlabelEl = tableRow.querySelector(".tree-label");
                const tlabel = (_b = (_a = tlabelEl === null || tlabelEl === void 0 ? void 0 : tlabelEl.textContent) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== null && _b !== void 0 ? _b : "";
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
                    else if (fl === null || fl === void 0 ? void 0 : fl.textContent) {
                        const matched = fl.textContent.toLowerCase().indexOf(q) !== -1;
                        show = matched;
                        if (matched)
                            anyFieldMatch = true;
                    }
                    else {
                        show = false;
                    }
                    fr.classList.toggle("tree-hidden", !show);
                });
                node.classList.toggle("tree-hidden", !(tableMatch || anyFieldMatch));
                if (q !== "" && anyFieldMatch && children) {
                    node.classList.add("expanded");
                    children.style.display = "";
                }
            });
            if (typeof SqlEditor.metaTreeEl.animate === "function")
                SqlEditor.metaTreeEl.animate([{ opacity: 0.55 }, { opacity: 1 }], { duration: 130, easing: "ease-out" });
        }
        function reapplyFilter() {
            if (SqlEditor.metaSearchInput === null || SqlEditor.metaSearchInput === void 0 ? void 0 : SqlEditor.metaSearchInput.value)
                applyFilter(SqlEditor.metaSearchInput.value);
        }
    })(SqlEditor = Sql4CdsApp.SqlEditor || (Sql4CdsApp.SqlEditor = {}));
})(Sql4CdsApp || (Sql4CdsApp = {}));
//# sourceMappingURL=sqlEditor.metadata.js.map