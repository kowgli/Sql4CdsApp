/// <reference path="../../../node_modules/@types/ace/index.d.ts" />
/// <reference path="../../../node_modules/@types/tabulator/index.d.ts" />

declare var Tabulator;
declare var sqlFormatter: any;

namespace Sql4CdsApp.SqlEditor {

    // ── Interfaces ─────────────────────────────────────────────────────
    export interface QueryTab {
        id: number;
        title: string;
        session: any;
        columns: any[] | null;
        data: any[] | null;
        commandMsg: string | null;
        rowsInfoText: string;
        errorText: string | null;
        statusText: string;
        running: boolean;
        runGen: number;
        loadStart: number | null;
    }

    export interface QuerySettings {
        bypassCustomPlugins: boolean;
        useLocalTimeZone: boolean;
        blockDeleteWithoutWhere: boolean;
        blockUpdateWithoutWhere: boolean;
        useTDSEndpoint: boolean;
        autoSuggest: boolean;
    }

    // ── Shared DOM element refs (assigned in onLoad) ───────────────────
    export let editor: AceAjax.Editor;
    export let table: any;
    export let statusEl: HTMLElement;
    export let errorBox: HTMLElement;
    export let rowsInfo: HTMLElement;
    export let commandMessage: HTMLElement;
    export let loadingOverlay: HTMLElement;
    export let loadingTimer: HTMLElement;
    export let exportWrap: HTMLElement;
    export let tableBuilt = false;
    export let timerInterval: number | null = null;

    // ── Metadata tree element refs (assigned in onLoad) ────────────────
    export let metaTreeEl: HTMLElement;
    export let refreshMetaBtn: HTMLButtonElement;
    export let metaSearchInput: HTMLInputElement;
    export const attributeCache: { [logicalName: string]: any[] } = {};
    export let entityList: any[] = [];
    export let entityByName: { [lower: string]: any } = {};

    // ── Settings ───────────────────────────────────────────────────────
    export const SETTING_IDS: { [K in keyof QuerySettings]: string } = {
        bypassCustomPlugins: "optBypassPlugins",
        useLocalTimeZone:    "optLocalTime",
        blockDeleteWithoutWhere: "optBlockDelete",
        blockUpdateWithoutWhere: "optBlockUpdate",
        useTDSEndpoint:      "optUseTDSEndpoint",
        autoSuggest:         "optAutoSuggest"
    };

    export const settings: QuerySettings = {
        bypassCustomPlugins:     false,
        useLocalTimeZone:        true,
        blockDeleteWithoutWhere: true,
        blockUpdateWithoutWhere: true,
        useTDSEndpoint:          false,
        autoSuggest:             true
    };

    export let isSystemAdmin = false;
}
