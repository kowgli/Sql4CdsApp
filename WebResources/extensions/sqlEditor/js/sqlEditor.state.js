/// <reference path="../../../node_modules/@types/ace/index.d.ts" />
/// <reference path="../../../node_modules/@types/tabulator/index.d.ts" />
var Sql4CdsApp;
(function (Sql4CdsApp) {
    var SqlEditor;
    (function (SqlEditor) {
        SqlEditor.tableBuilt = false;
        SqlEditor.timerInterval = null;
        SqlEditor.attributeCache = {};
        SqlEditor.entityList = [];
        SqlEditor.entityByName = {};
        // ── Settings ───────────────────────────────────────────────────────
        SqlEditor.SETTING_IDS = {
            bypassCustomPlugins: "optBypassPlugins",
            useLocalTimeZone: "optLocalTime",
            blockDeleteWithoutWhere: "optBlockDelete",
            blockUpdateWithoutWhere: "optBlockUpdate",
            autoSuggest: "optAutoSuggest"
        };
        SqlEditor.settings = {
            bypassCustomPlugins: false,
            useLocalTimeZone: true,
            blockDeleteWithoutWhere: true,
            blockUpdateWithoutWhere: true,
            autoSuggest: true
        };
        SqlEditor.isSystemAdmin = false;
    })(SqlEditor = Sql4CdsApp.SqlEditor || (Sql4CdsApp.SqlEditor = {}));
})(Sql4CdsApp || (Sql4CdsApp = {}));
//# sourceMappingURL=sqlEditor.state.js.map