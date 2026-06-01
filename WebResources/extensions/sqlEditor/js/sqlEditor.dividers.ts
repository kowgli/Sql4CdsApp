namespace Sql4CdsApp.SqlEditor {

    // ── Editor / results vertical splitter ─────────────────────────────
    export function setupDivider() {
        const divider    = document.getElementById("divider")!;
        const editorPanel = document.getElementById("editorPanel")!;
        const gridEl     = document.getElementById("grid")!;
        const skeletonEl = document.getElementById("resizeSkeleton")!;
        const mainEl     = document.getElementById("main")!;

        let isDragging = false;
        let startY = 0, startEditorH = 0, latestY = 0;
        let editorHeightPx: number | null = null;
        let gridDisplayBeforeDrag = "";
        let mainHCached = 0, divHCached = 0;
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
            skeletonEl.style.display = "none";
            gridEl.style.display = gridDisplayBeforeDrag;
            editor.resize();
            table.redraw(true);
        }

        divider.addEventListener("pointerdown", (e: PointerEvent) => {
            isDragging = true;
            startY = latestY = e.clientY;
            startEditorH = editorPanel.getBoundingClientRect().height;
            mainHCached = mainEl.getBoundingClientRect().height;
            divHCached  = divider.offsetHeight;
            divider.setPointerCapture(e.pointerId);
            divider.classList.add("dragging");
            document.body.style.userSelect = "none";
            document.body.style.cursor = "ns-resize";
            gridDisplayBeforeDrag = gridEl.style.display;
            gridEl.style.display = "none";
            skeletonEl.style.display = "flex";
            e.preventDefault();
        });

        divider.addEventListener("pointermove", (e: PointerEvent) => {
            if (!isDragging) return;
            latestY = e.clientY;
            if (rafId === null) rafId = requestAnimationFrame(applyDrag);
        });

        divider.addEventListener("pointerup",          stopDrag);
        divider.addEventListener("pointercancel",      stopDrag);
        divider.addEventListener("lostpointercapture", stopDrag);
        window.addEventListener("blur", stopDrag);

        window.addEventListener("resize", () => {
            if (editorHeightPx === null) return;
            const maxH = mainEl.getBoundingClientRect().height - divider.offsetHeight - 80;
            if (editorHeightPx > maxH) {
                editorHeightPx = Math.max(80, maxH);
                editorPanel.style.flex = `0 0 ${editorHeightPx}px`;
            }
        });
    }

    // ── Object explorer horizontal width splitter ───────────────────────
    export function setupMetaDivider() {
        const divider   = document.getElementById("metaDivider")!;
        const panel     = document.getElementById("metaSide")!;
        const container = document.getElementById("app")!;

        let isDragging = false;
        let startX = 0, startW = 0, latestX = 0, wsWCached = 0;
        let widthPx: number | null = null;
        let rafId: number | null = null;

        function applyDrag() {
            rafId = null;
            const minW = 160;
            const maxW = Math.max(minW, wsWCached - 240);
            widthPx = Math.max(minW, Math.min(maxW, startW + (latestX - startX)));
            panel.style.flex = `0 0 ${widthPx}px`;
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
            startX = latestX = e.clientX;
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

        divider.addEventListener("pointerup",          stopDrag);
        divider.addEventListener("pointercancel",      stopDrag);
        divider.addEventListener("lostpointercapture", stopDrag);
        window.addEventListener("blur", stopDrag);

        window.addEventListener("resize", () => {
            if (widthPx === null || panel.classList.contains("collapsed")) return;
            const maxW = container.getBoundingClientRect().width - 240;
            if (widthPx > maxW) {
                widthPx = Math.max(160, maxW);
                panel.style.flex = `0 0 ${widthPx}px`;
            }
        });
    }

    // ── Object explorer collapse / expand ──────────────────────────────
    // Animates the container's flex-basis down to the rail width while the
    // panel layer crossfades into the rail — no width jump on either end.
    // The transition is class-gated so it never fires during divider drags.
    export function setupMetaCollapse() {
        const side        = document.getElementById("metaSide")!;
        const panel       = document.getElementById("metadataPanel")!;
        const divider     = document.getElementById("metaDivider")!;
        const collapseBtn = document.getElementById("collapseMetaBtn")!;
        const expandBtn   = document.getElementById("expandMetaBtn")!;
        const railLabel   = document.querySelector("#metaRail .meta-rail-label") as HTMLElement | null;

        const DURATION = 240;
        const RAIL_W   = 34;  // must match #metaRail width in CSS
        let collapsed = false;
        let expandedWidth = 220;

        function animateEditorDuring(duration: number) {
            const end = performance.now() + duration;
            (function step() {
                editor.resize();
                if (performance.now() < end) requestAnimationFrame(step);
                else table.redraw(true);
            })();
        }

        function collapse() {
            if (collapsed) return;
            collapsed = true;
            expandedWidth = Math.max(160, Math.round(side.getBoundingClientRect().width));
            panel.style.width = expandedWidth + "px";
            side.style.flexBasis = expandedWidth + "px";
            void side.offsetWidth;
            side.classList.add("meta-animating", "collapsed");
            side.style.flexBasis = RAIL_W + "px";
            divider.style.display = "none";
            animateEditorDuring(DURATION);
            window.setTimeout(() => { side.classList.remove("meta-animating"); editor.resize(); table.redraw(true); }, DURATION + 20);
        }

        function expand() {
            if (!collapsed) return;
            collapsed = false;
            side.style.flexBasis = RAIL_W + "px";
            void side.offsetWidth;
            side.classList.add("meta-animating");
            side.classList.remove("collapsed");
            side.style.flexBasis = expandedWidth + "px";
            divider.style.display = "";
            animateEditorDuring(DURATION);
            window.setTimeout(() => { side.classList.remove("meta-animating"); panel.style.width = ""; editor.resize(); table.redraw(true); }, DURATION + 20);
        }

        collapseBtn.addEventListener("click", collapse);
        expandBtn.addEventListener("click", expand);
        if (railLabel) railLabel.addEventListener("click", expand);
    }
}
