---
name: edit-source-not-compiled-webresources
description: For web resources, only edit source files; user regenerates compiled/bundled output themselves
metadata:
  type: feedback
---

When changing `WebResources/`, only edit the **source** files. Do NOT edit compiled or bundled output — the user regenerates those themselves.

- **Source (edit these):** `*.main.ts` (TypeScript), `*.main.css`, `*.html`.
- **Generated (do NOT touch):** `*.main.js` (tsc `compileOnSave` output), `*.main.js.map`, `*.bundle.js` / `*.bundle.css` (produced by `WebResourceManager bundle`), and `*.min.*`.

**Why:** The user owns the build/compile/bundle/deploy steps. Hand-editing generated files creates churn and risks conflicting with their regeneration.

**How to apply:** Make the change in the `.ts`/`.main.css`/`.html` source only — then STOP. Do NOT run the bundle generator (`__GENERATE_BUNDLES.bat` / WebResourceManager) and do NOT deploy/sync (`__SYNC WEB RESOURCES.bat`). The user runs compile, bundle, and deploy themselves. Same rule is documented in CLAUDE.md under "Web resources".
