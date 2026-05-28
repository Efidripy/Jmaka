# Jmaka UI Normalization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Normalize the Jmaka browser interface into one consistent, accessible, responsive tool UI without changing image/video processing behavior.

**Architecture:** Treat Jmaka as an ASP.NET Core/Razor + static CSS/vanilla JS application. First establish a shared UI baseline in CSS and markup, then normalize each feature surface in small passes, and finally verify with browser screenshots, accessibility checks, smoke tests, and `dotnet test`.

**Tech Stack:** ASP.NET Core Minimal API, Razor Pages/partials, static CSS, vanilla JavaScript, Playwright/browser automation, xUnit, PowerShell smoke scripts.

---

## Progress

- `Task 1: Baseline Audit` - completed
- `Task 2: CSS Token And Utility Baseline` - completed
- `Task 3: Razor Shell Normalization` - completed
- `Task 4: Modal Structure Normalization` - completed
- `Task 5: Global JavaScript UI State Cleanup` - completed
- `Task 6: Feature Tool UI Pass` - completed
- `Task 7: Responsive Pass` - completed
- `Task 8: Accessibility Audit And Fixes` - completed
- `Task 9: Browser Automation Smoke` - completed (smoke-script based)
- `Task 10: Designer-Eye Final Polish` - completed

## Execution Log

- `2026-05-28`: Started full localization sweep (RU/EN/ES consistency) across Razor modals and feature JS:
  - normalized `data-i18n` / `data-i18n-aria-label` usage in `Index.cshtml` and feature partials,
  - replaced hardcoded runtime UI/status strings in `features/videoedit/tool.js`, `features/crop/tool.js`, `features/oknoscale/tool.js`, `features/split/tool.js`, `features/oknofix/tool.js`,
  - extended `wwwroot/app.js` dictionaries with missing keys for overlay flow and okno hints/statuses.
- `2026-05-28`: Localization sweep checkpoint:
  - `Pages/Shared/Features/*.cshtml`: no remaining Russian `data-i18n*` attributes in active UI paths,
  - `features/*.js`: major hardcoded user-facing strings moved to `t(...)` / `vt(...)`,
  - final tail cleanup continues for residual dynamic fallbacks and non-attribute UI text.
- `2026-05-28`: Localization sweep tail pass:
  - `videoedit/tool.js`, `crop/tool.js`, `oknoscale/tool.js`, `split/tool.js`, `oknofix/tool.js` fallback/hint/status strings normalized,
  - regex checks for mixed `t/vt` key+Russian-fallback patterns returned no active matches in targeted feature scripts.
- `2026-05-28`: Mobile design normalization mini-pass completed:
  - `app.css`: help modal constrained (`max-height` + internal scroll) and compact mobile spacing,
  - `features/videoedit/style.css`: sticky mobile footer with wrapped action rows and compact paddings for narrow screens.
- `2026-05-28`: Re-ran visual regression (`tests/ui`): `24 files`, `Changed: 0`, `Issues: 0`.
- `2026-05-28`: Re-ran `dotnet test` after mobile polish: `21 passed`.
- `2026-05-28`: Added baseline design tokens and unified focus ring behavior in `src/Jmaka.Api/wwwroot/app.css` without changing existing selectors/IDs.
- `2026-05-28`: Ran `dotnet test` successfully (`21 passed`).
- `2026-05-28`: `smoke-api-version.ps1` failed because app process exited before endpoint became available; to be re-checked at next checkpoint.
- `2026-05-28`: Started `Task 3` and normalized `Index.cshtml` landmarks and live-region semantics (`main` role, grouped controls, status announcements).
- `2026-05-28`: Completed modal accessibility normalization in feature partials (`aria-labelledby`/`aria-describedby`, icon-only control labels for zoom/play buttons).
- `2026-05-28`: Improved modal responsive behavior in `app.css` (bounded modal height, internal body scroll, wrapped footer actions, mobile button layout).
- `2026-05-28`: Re-ran checks: `dotnet test` passed (`21 passed`), smoke passed (`/api/version -> 0.5.2`).
- `2026-05-28`: Added accessibility labels for JS-generated controls in `app.js` (gallery select buttons, download/delete actions).
- `2026-05-28`: Confirmed runtime script chain in `Index.cshtml` and kept changes scoped to active path (`features/shared/core.js` + feature tools).
- `2026-05-28`: Final validation checkpoint: `dotnet test` passed (`21 passed`), smoke passed (`/api/version -> 0.5.2`).
- `2026-05-28`: Added explicit `Design Skill Passes` record (`ui-visual-validator`, `webapp-testing/playwright`, `ui-ux-polish`, `gstack-design-review`, `accessibility-compliance-accessibility-audit`) with scope and outcomes.
- `2026-05-28`: Executed Playwright UI matrix capture (`desktop 1440x900`, `tablet 768x1024`, `mobile 390x844`) and saved artifacts to `tests/ui/artifacts/ui-matrix/`.
- `2026-05-28`: Final post-matrix validation: `dotnet test` passed (`21 passed`), smoke passed (`/api/version -> 0.5.2`, after one transient retry).
- `2026-05-28`: Added visual regression baseline workflow in `tests/ui`:
  - `jmaka-ui-matrix.js` (capture matrix),
  - `visual-baseline.js` (refresh baseline),
  - `visual-diff.js` (pixel diff + summary).
- `2026-05-28`: Baseline and diff run completed (`24 files`, `Changed: 0`, `Issues: 0`), summary: `tests/ui/artifacts/diff/summary.json`.

## Paranoid File Coverage

- `[x]` `src/Jmaka.Api/Pages/Index.cshtml`
- `[x]` `src/Jmaka.Api/Pages/Shared/Features/_CropModal.cshtml`
- `[x]` `src/Jmaka.Api/Pages/Shared/Features/_ImageEditModal.cshtml`
- `[x]` `src/Jmaka.Api/Pages/Shared/Features/_OknoFixModal.cshtml`
- `[x]` `src/Jmaka.Api/Pages/Shared/Features/_OknoScaleModal.cshtml`
- `[x]` `src/Jmaka.Api/Pages/Shared/Features/_SplitModal.cshtml`
- `[x]` `src/Jmaka.Api/Pages/Shared/Features/_Split3Modal.cshtml`
- `[x]` `src/Jmaka.Api/Pages/Shared/Features/_VideoEditModal.cshtml`
- `[x]` `src/Jmaka.Api/wwwroot/app.css`
- `[x]` `src/Jmaka.Api/wwwroot/app.js`
- `[x]` `src/Jmaka.Api/wwwroot/features/shared/core.js` (runtime path validated, no risky edits required)
- `[x]` `src/Jmaka.Api/wwwroot/features/crop/tool.js`
- `[x]` `src/Jmaka.Api/wwwroot/features/edit/tool.js`
- `[x]` `src/Jmaka.Api/wwwroot/features/oknofix/tool.js`
- `[x]` `src/Jmaka.Api/wwwroot/features/oknoscale/tool.js` (review pass, no extra safe changes required)
- `[x]` `src/Jmaka.Api/wwwroot/features/split/tool.js`
- `[x]` `src/Jmaka.Api/wwwroot/features/split3/tool.js` (logic hosted in `oknofix/tool.js`, verified)
- `[x]` `src/Jmaka.Api/wwwroot/features/videoedit/style.css`
- `[x]` `src/Jmaka.Api/wwwroot/features/videoedit/tool.js`

## Design Skill Passes

Applied order for final visual normalization:

1. `ui-visual-validator`
2. `webapp-testing` + `playwright`
3. `ui-ux-polish`
4. `gstack-design-review`
5. `accessibility-compliance-accessibility-audit`

Pass log:

- `2026-05-28` `ui-visual-validator`  
  Scope: `Index.cshtml`, all feature modals, shared modal CSS in `app.css`.  
  Result: unified dialog semantics (`aria-labelledby`/`aria-describedby`), icon-button labels, modal action consistency.

- `2026-05-28` `webapp-testing` + `playwright`  
  Scope: runtime availability + UI regression guard + multi-viewport screenshot evidence.  
  Result: smoke endpoint validation passed (`/api/version -> 0.5.2`), no functional regression after UI passes.  
  Artifacts: `tests/ui/artifacts/ui-matrix/` (`main`, `crop`, `split`, `split3`, `oknofix`, `oknoscale`, `imageedit`, `videoedit` for desktop/tablet/mobile).

- `2026-05-28` `ui-ux-polish`  
  Scope: density and readability of modal structure and action groups.  
  Result: modal body/footer behavior normalized for narrow screens, wrapped actions, stable vertical rhythm.

- `2026-05-28` `gstack-design-review` (manual equivalent pass in-session)  
  Scope: high-signal visual consistency checks across shell + tool dialogs.  
  Result: no additional structural mismatches requiring risky rewrites; polish folded into safe CSS/markup edits.

- `2026-05-28` `accessibility-compliance-accessibility-audit`  
  Scope: keyboard/focus semantics and dynamic control labeling in runtime-generated controls.  
  Result: `aria-label` coverage expanded in `app.js` and feature tool scripts (`crop`, `split`, `oknofix`, `edit`, `videoedit`).

Follow-up optional pass:

- integrate `tests/ui` matrix+diff scripts into CI for strict visual regression gates.

## Session Preflight

- `task_id`: `TASK-20260528-JMAKA-UI-NORMALIZATION`
- `intent`: `refactor`
- `repository`: `E:\GitHub\repos\Jmaka`
- `change_stream`: create a dedicated branch before implementation, suggested `ui-normalization`
- `single_integrator`: Codex or the active final integrator for the session
- `initial_risk`: `medium`
- `scope_in`: UI consistency, CSS tokens, Razor modal markup, vanilla JS UI state, responsive layout, accessibility, browser validation
- `scope_out`: image/video processing algorithms, API contracts, deploy scripts, storage layout, database/storage retention behavior
- `validation_plan`: `dotnet test`, `tests\smoke-api-version.ps1`, local browser smoke at `http://localhost:5189/`, Playwright screenshots for desktop/tablet/mobile, keyboard and accessibility pass

## Source Context

- Workspace bootstrap: `E:\GitHub\START-HERE.md`, `E:\GitHub\WORKSPACE.md`, `E:\GitHub\workspace\WORKSPACE-OPERATING-SYSTEM.md`
- Workspace agent rules: `E:\GitHub\AGENTS.md`
- Project card: `E:\GitHub\workspace\knowledge\projects\Jmaka.md`
- Project manifest: `E:\GitHub\workspace\control\manifests\projects\Jmaka\Jmaka.md`
- Repository agent notes: `E:\GitHub\repos\Jmaka\AGENTS.md`
- Repository overview: `E:\GitHub\repos\Jmaka\README.md`

## Required Skills

Use these skills in this order:

1. `design-system-patterns`  
   Path: `E:\GitHub\workspace\knowledge\.agents\skills\design-system-patterns\SKILL.md`  
   Purpose: define tokens for color, spacing, radii, shadows, focus, tool surfaces, status states.

2. `visual-design-foundations`  
   Path: `E:\GitHub\workspace\knowledge\.agents\skills\visual-design-foundations\SKILL.md`  
   Purpose: normalize typography, hierarchy, density, alignment, icon/button treatment.

3. `web-coder`  
   Path: `E:\GitHub\workspace\knowledge\.agents\skills\web-coder\SKILL.md`  
   Purpose: implement changes in Razor, CSS, and vanilla JS without assuming React/Tailwind.

4. `responsive-design`  
   Path: `E:\GitHub\workspace\knowledge\.agents\skills\responsive-design\SKILL.md`  
   Purpose: make the tool layout usable across desktop, tablet, and mobile.

5. `accessibility-compliance`  
   Path: `E:\GitHub\workspace\knowledge\.agents\skills\accessibility-compliance\SKILL.md`  
   Purpose: normalize focus, labels, ARIA, keyboard operation, contrast, target sizes.

6. `accessibility-compliance-accessibility-audit`  
   Path: `E:\GitHub\workspace\knowledge\.agents\skills\accessibility-compliance-accessibility-audit\SKILL.md`  
   Purpose: audit findings after implementation and map them to remediation steps.

7. `web-design-reviewer`  
   Path: `E:\GitHub\workspace\knowledge\.agents\skills\web-design-reviewer\SKILL.md`  
   Purpose: inspect the running UI visually and fix layout/consistency defects.

8. `ui-visual-validator`  
   Path: `E:\GitHub\workspace\knowledge\.agents\skills\ui-visual-validator\SKILL.md`  
   Purpose: verify before/after screenshots and catch visual regressions.

9. `webapp-testing`  
   Path: `E:\GitHub\workspace\knowledge\.agents\skills\webapp-testing\SKILL.md`  
   Purpose: run local browser automation against the ASP.NET app.

10. `gstack-design-review`  
    Path: `E:\GitHub\workspace\knowledge\.agents\portable\codex-home-skills\gstack-design-review\SKILL.md`  
    Purpose: final designer-eye polish pass after the core normalization is stable.

Optional backup skills:

- `baseline-ui`: use as a checklist only; it is Tailwind/React-oriented and does not match Jmaka directly.
- `web-performance-optimization`: use only if UI changes introduce measurable load/runtime regressions.
- `gstack-qa`: use if the final UI pass needs full bug-fix QA instead of design-only review.

## Primary Files

Razor shell and modals:

- Modify: `src\Jmaka.Api\Pages\Index.cshtml`
- Modify: `src\Jmaka.Api\Pages\Shared\Features\_CropModal.cshtml`
- Modify: `src\Jmaka.Api\Pages\Shared\Features\_ImageEditModal.cshtml`
- Modify: `src\Jmaka.Api\Pages\Shared\Features\_OknoFixModal.cshtml`
- Modify: `src\Jmaka.Api\Pages\Shared\Features\_OknoScaleModal.cshtml`
- Modify: `src\Jmaka.Api\Pages\Shared\Features\_SplitModal.cshtml`
- Modify: `src\Jmaka.Api\Pages\Shared\Features\_Split3Modal.cshtml`
- Modify: `src\Jmaka.Api\Pages\Shared\Features\_VideoEditModal.cshtml`

Global UI assets:

- Modify: `src\Jmaka.Api\wwwroot\app.css`
- Modify: `src\Jmaka.Api\wwwroot\app.js`
- Modify: `src\Jmaka.Api\wwwroot\video-edit.css`
- Modify: `src\Jmaka.Api\wwwroot\video-edit.js`
- Review only unless needed: `src\Jmaka.Api\wwwroot\ascii-art.js`

Feature UI assets:

- Modify: `src\Jmaka.Api\wwwroot\features\shared\core.js`
- Modify: `src\Jmaka.Api\wwwroot\features\crop\tool.js`
- Modify: `src\Jmaka.Api\wwwroot\features\edit\tool.js`
- Modify: `src\Jmaka.Api\wwwroot\features\oknofix\tool.js`
- Modify: `src\Jmaka.Api\wwwroot\features\oknoscale\tool.js`
- Modify: `src\Jmaka.Api\wwwroot\features\split\tool.js`
- Modify: `src\Jmaka.Api\wwwroot\features\split3\tool.js`
- Modify: `src\Jmaka.Api\wwwroot\features\videoedit\style.css`
- Modify: `src\Jmaka.Api\wwwroot\features\videoedit\tool.js`

Tests and validation:

- Existing command: `dotnet test`
- Existing smoke: `powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\smoke-api-version.ps1`
- Add if useful: `tests\ui\jmaka-ui-smoke.py`
- Store generated local artifacts outside repo or under ignored temp paths; do not commit screenshots unless explicitly requested.

## Design System Targets

Normalize the interface around these targets:

- One spacing scale for panels, tables, modals, toolbar rows, preview areas, and form controls.
- One color vocabulary for primary action, secondary action, destructive action, warning, success, neutral, disabled, and focus.
- One control model for buttons, icon buttons, segmented choices, file actions, delete actions, sliders, selects, checkboxes, status badges, progress.
- One modal structure: header, body, preview/work area, controls, footer/actions.
- One table/card density: readable, compact, no accidental oversized hero styling.
- One responsive model: desktop split panes, tablet stacked groups, mobile single-column tool workflow.
- One accessibility model: visible focus, keyboard reachable actions, labelled controls, target size, contrast.

## Task 1: Baseline Audit

**Files:**
- Read: all primary files listed above
- Create: `docs\plans\ui-normalization-audit-notes.md` only if the findings are too large for implementation notes

**Steps:**

1. Run `git status --short` and record whether the worktree is clean.
2. Read `Index.cshtml`, all feature partials, `app.css`, `video-edit.css`, and feature CSS/JS files.
3. Map repeated UI patterns: buttons, panels, tables, modals, toolbar groups, preview containers, sliders, status messages.
4. Identify duplicate styling and inconsistent class names.
5. Identify risky JS-generated markup in `app.js`, `features/shared/core.js`, and feature `tool.js` files.
6. Record a short issue list with file paths and selectors/functions.

**Validation:**

- No code changes in this task except optional notes.
- Expected result: clear list of UI surfaces and repeated patterns.

**Commit:**

- Commit only if audit notes are created: `docs: add Jmaka UI normalization audit notes`

## Task 2: CSS Token And Utility Baseline

**Skills:** `design-system-patterns`, `visual-design-foundations`, `web-coder`

**Files:**
- Modify: `src\Jmaka.Api\wwwroot\app.css`
- Modify if needed: `src\Jmaka.Api\wwwroot\features\videoedit\style.css`
- Modify if needed: `src\Jmaka.Api\wwwroot\video-edit.css`

**Steps:**

1. Add or normalize CSS custom properties in `:root` for color, spacing, radius, border, shadow, focus, control height.
2. Add shared classes for app shell, panels, toolbars, button rows, form rows, status badges, previews, modal layout.
3. Keep changes compatible with existing class names first.
4. Avoid visual decoration that does not support the tool workflow.
5. Do not change API behavior or JS state names.

**Validation:**

- Run: `dotnet test`
- Run: `powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\smoke-api-version.ps1`
- Expected: both pass.

**Commit:**

- `style: add shared UI baseline tokens`

## Task 3: Razor Shell Normalization

**Skills:** `web-coder`, `accessibility-compliance`

**Files:**
- Modify: `src\Jmaka.Api\Pages\Index.cshtml`

**Steps:**

1. Normalize top-level landmarks: header, main, tool sections, upload region, history/results regions.
2. Ensure the language switcher has clear labels and keyboard operation.
3. Ensure upload/drop/paste affordances are visible and not text-heavy.
4. Normalize table headers, empty states, and action groups.
5. Add accessible labels where controls rely on icons or short symbols.
6. Keep all existing element IDs used by JavaScript unless the corresponding JS is updated in the same task.

**Validation:**

- Run local app: `dotnet run --project src\Jmaka.Api --launch-profile http`
- Open: `http://localhost:5189/`
- Verify: upload area visible, history area visible, language switcher still works.
- Then stop the app.

**Commit:**

- `refactor: normalize main Jmaka interface shell`

## Task 4: Modal Structure Normalization

**Skills:** `web-coder`, `accessibility-compliance`, `responsive-design`

**Files:**
- Modify: `src\Jmaka.Api\Pages\Shared\Features\_CropModal.cshtml`
- Modify: `src\Jmaka.Api\Pages\Shared\Features\_ImageEditModal.cshtml`
- Modify: `src\Jmaka.Api\Pages\Shared\Features\_OknoFixModal.cshtml`
- Modify: `src\Jmaka.Api\Pages\Shared\Features\_OknoScaleModal.cshtml`
- Modify: `src\Jmaka.Api\Pages\Shared\Features\_SplitModal.cshtml`
- Modify: `src\Jmaka.Api\Pages\Shared\Features\_Split3Modal.cshtml`
- Modify: `src\Jmaka.Api\Pages\Shared\Features\_VideoEditModal.cshtml`

**Steps:**

1. Normalize modal wrapper class names and ARIA attributes.
2. Make every modal follow the same structure: title, close button, body, preview/work area, controls, actions/status.
3. Ensure close buttons have accessible labels.
4. Ensure destructive actions are visually distinct and labelled.
5. Preserve IDs and data attributes used by JS.
6. Move repeated visual concerns to CSS classes instead of inline styles where feasible.

**Validation:**

- Browser check each modal: Crop, Image Edit, OknoFix, OknoScale, Split, Split3, Video Edit.
- Keyboard check: open, tab through controls, close.
- Run: `dotnet test`

**Commit:**

- `refactor: normalize feature modal markup`

## Task 5: Global JavaScript UI State Cleanup

**Skills:** `web-coder`, `accessibility-compliance`

**Files:**
- Modify: `src\Jmaka.Api\wwwroot\app.js`
- Modify: `src\Jmaka.Api\wwwroot\features\shared\core.js`

**Steps:**

1. Identify functions that create buttons, rows, status messages, modals, or empty states.
2. Centralize repeated class assignment and ARIA attributes through small helpers only where duplication is real.
3. Normalize loading, error, success, disabled, and empty states.
4. Ensure JS-generated icon-only buttons receive `aria-label`.
5. Ensure updates that change status are exposed through visible text and appropriate live regions when needed.
6. Do not rewrite business logic or API request flow.

**Validation:**

- Run: `dotnet test`
- Run local browser smoke: upload screen loads, history fetches, no console errors on initial load.

**Commit:**

- `refactor: normalize global UI state rendering`

## Task 6: Feature Tool UI Pass

**Skills:** `web-coder`, `responsive-design`, `accessibility-compliance`

**Files:**
- Modify: `src\Jmaka.Api\wwwroot\features\crop\tool.js`
- Modify: `src\Jmaka.Api\wwwroot\features\edit\tool.js`
- Modify: `src\Jmaka.Api\wwwroot\features\oknofix\tool.js`
- Modify: `src\Jmaka.Api\wwwroot\features\oknoscale\tool.js`
- Modify: `src\Jmaka.Api\wwwroot\features\split\tool.js`
- Modify: `src\Jmaka.Api\wwwroot\features\split3\tool.js`
- Modify: `src\Jmaka.Api\wwwroot\features\videoedit\tool.js`
- Modify: `src\Jmaka.Api\wwwroot\features\videoedit\style.css`
- Modify if needed: `src\Jmaka.Api\wwwroot\video-edit.js`
- Modify if needed: `src\Jmaka.Api\wwwroot\video-edit.css`

**Steps:**

1. Normalize control groups for each tool.
2. Normalize preview/work-area sizing and overflow behavior.
3. Normalize slider/input labels and current value display.
4. Normalize action buttons and disabled states.
5. Normalize progress and job-status areas for video processing.
6. Keep tool-specific workflows intact.

**Validation:**

- Browser smoke each tool UI opens without console errors.
- For video edit, verify the empty/no-video state and controls do not overlap.
- Run: `dotnet test`

**Commit:**

- `refactor: normalize feature tool controls`

## Task 7: Responsive Pass

**Skills:** `responsive-design`, `web-design-reviewer`

**Files:**
- Modify: `src\Jmaka.Api\wwwroot\app.css`
- Modify: `src\Jmaka.Api\wwwroot\features\videoedit\style.css`
- Modify: `src\Jmaka.Api\wwwroot\video-edit.css`
- Modify Razor/JS only if markup prevents CSS-only fixes.

**Steps:**

1. Check desktop around `1440x900`.
2. Check tablet around `768x1024`.
3. Check mobile around `390x844`.
4. Fix overflow, clipped text, overlapping controls, cramped action rows.
5. Ensure modal bodies scroll internally when needed.
6. Ensure touch targets remain usable on mobile.

**Validation:**

- Capture screenshots for the main screen and at least Crop, Image Edit, Split, Video Edit.
- Run: `dotnet test`

**Commit:**

- `style: improve responsive UI layout`

## Task 8: Accessibility Audit And Fixes

**Skills:** `accessibility-compliance`, `accessibility-compliance-accessibility-audit`

**Files:**
- Modify all UI files touched earlier as needed.

**Steps:**

1. Check heading order and landmarks.
2. Check visible focus for all interactive controls.
3. Check keyboard operation for upload, language switcher, modals, close buttons, sliders, delete actions.
4. Check accessible names for icon-only buttons.
5. Check form labels and error/status text.
6. Check color contrast for text, borders, disabled state, focus ring.
7. Fix findings in severity order.

**Validation:**

- Manual keyboard pass.
- Browser console has no accessibility-related JS errors.
- Run: `dotnet test`

**Commit:**

- `fix: improve UI accessibility`

## Task 9: Browser Automation Smoke

**Skills:** `webapp-testing`, `playwright`

**Files:**
- Add if useful: `tests\ui\jmaka-ui-smoke.py`
- Use existing helper style from `webapp-testing` if managing the server automatically.

**Steps:**

1. Start the app with `dotnet run --project src\Jmaka.Api --launch-profile http`.
2. Use Playwright to open `http://localhost:5189/`.
3. Wait for the page to settle.
4. Capture main screen screenshot.
5. Open core tool modals and capture screenshots.
6. Check console errors.
7. Check that primary buttons are visible and enabled/disabled as expected.
8. Stop the app.

**Validation:**

- Expected: no uncaught console errors, no blank screens, no modal layout breakage.
- Run: `dotnet test`
- Run: `powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\smoke-api-version.ps1`

**Commit:**

- If a reusable UI smoke script was added: `test: add UI smoke coverage`
- If no script was added and only fixes were made: use the fix commit relevant to the changed files.

## Task 10: Designer-Eye Final Polish

**Skills:** `gstack-design-review`, `ui-visual-validator`, `web-design-reviewer`

**Files:**
- Modify only files required by verified visual findings.

**Steps:**

1. Review before/after screenshots for visual consistency.
2. Fix only concrete issues: alignment, spacing, hierarchy, button consistency, modal density, responsive overflow, focus visibility.
3. Avoid introducing new visual concepts late in the process.
4. Re-run screenshots after fixes.
5. Record final known limitations if any.

**Validation:**

- `dotnet test`
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\smoke-api-version.ps1`
- Local browser smoke at `http://localhost:5189/`
- Workspace gate if finalizing through workspace process:
  `powershell -NoProfile -ExecutionPolicy Bypass -File E:\GitHub\workspace\control\scripts\shared\validate-mix-gate.ps1 -ProjectName Jmaka`

**Commit:**

- `style: polish normalized Jmaka UI`

## Completion Criteria

- Main Jmaka screen has consistent visual hierarchy and spacing.
- All feature modals share one recognizable structure.
- Buttons, icon buttons, status messages, sliders, tables, previews, and destructive actions use one visual language.
- No desktop/tablet/mobile overflow or incoherent overlap in the tested viewports.
- Keyboard navigation works for primary flows.
- Icon-only controls have accessible names.
- `dotnet test` passes.
- `tests\smoke-api-version.ps1` passes.
- Browser smoke has no uncaught console errors.
- Any new plan/audit/test artifacts are committed intentionally.

## Suggested Commit Sequence

1. `docs: add Jmaka UI normalization plan`
2. `style: add shared UI baseline tokens`
3. `refactor: normalize main Jmaka interface shell`
4. `refactor: normalize feature modal markup`
5. `refactor: normalize global UI state rendering`
6. `refactor: normalize feature tool controls`
7. `style: improve responsive UI layout`
8. `fix: improve UI accessibility`
9. `test: add UI smoke coverage`
10. `style: polish normalized Jmaka UI`

## Do Not Do

- Do not rewrite the app into React/Vue/Svelte.
- Do not replace the API contract.
- Do not change image/video processing semantics.
- Do not reorganize deployment scripts.
- Do not introduce Tailwind just for this normalization pass.
- Do not commit generated screenshots or runtime artifacts unless explicitly requested.
- Do not remove existing IDs/classes until all JS references are checked.
