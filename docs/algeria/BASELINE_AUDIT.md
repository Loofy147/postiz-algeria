# Baseline Source Audit — Localization and Repository

**Audit type:** source-level inspection of publicly readable repository files.  
**Audited ref:** `main` at `a5affe62c74e39c1e7ac960d50d8418b807d532c` (observed during this audit).  
**Date:** 2026-10-27  
**Runtime/build tests:** NOT RUN. This report does not claim that the application builds or that RTL works end-to-end.

## Confirmed repository facts

| Finding | Status | Evidence |
|---|---|---|
| `Loofy147/postiz-algeria` is a populated fork whose parent/source is `gitroomhq/postiz-app` | VERIFIED | [Repository metadata](https://api.github.com/repos/Loofy147/postiz-algeria) |
| Default branch is `main`; it contains the frontend, backend and shared libraries | VERIFIED | [Repository root](https://github.com/Loofy147/postiz-algeria/tree/main) |
| The root package declares AGPL-3.0 and pnpm workspaces | VERIFIED | [package.json](https://github.com/Loofy147/postiz-algeria/blob/main/package.json), [pnpm-workspace.yaml](https://github.com/Loofy147/postiz-algeria/blob/main/pnpm-workspace.yaml) |
| An existing i18next-based localization implementation exists | VERIFIED | [i18n config](https://github.com/Loofy147/postiz-algeria/blob/main/libraries/react-shared-libraries/src/translation/i18n.config.ts), [translation service](https://github.com/Loofy147/postiz-algeria/tree/main/libraries/react-shared-libraries/src/translation) |
| Available language list contains Arabic (`ar`) and French (`fr`) | VERIFIED | [i18n config](https://github.com/Loofy147/postiz-algeria/blob/main/libraries/react-shared-libraries/src/translation/i18n.config.ts) |
| Arabic, French and English each have a `translation.json` resource | VERIFIED | [Arabic](https://github.com/Loofy147/postiz-algeria/blob/main/libraries/react-shared-libraries/src/translation/locales/ar/translation.json), [French](https://github.com/Loofy147/postiz-algeria/blob/main/libraries/react-shared-libraries/src/translation/locales/fr/translation.json), [English](https://github.com/Loofy147/postiz-algeria/blob/main/libraries/react-shared-libraries/src/translation/locales/en/translation.json) |

## Translation-resource parity check

The source JSON resources were fetched from `main`, parsed as JSON, and compared by key against English. This was a static key/value comparison, not a test of the rendered interface or translation quality.

| Resource | Keys | Missing relative to English | Extra relative to English | Values exactly identical to English |
|---|---:|---:|---:|---:|
| English | 897 | — | — | — |
| Arabic | 897 | 0 | 0 | 2 |
| French | 897 | 0 | 0 | 36 |

The two Arabic values identical to English are `mcp` and `cli`. The French equality count contains a mixture that may include technical terms, brand names and genuine untranslated copy; each value needs contextual review before it is classified. Key parity alone does not establish translation accuracy, accessibility, text fit, or usable RTL behavior.

## Algeria-specific finding

[language.component.tsx](https://github.com/Loofy147/postiz-algeria/blob/main/apps/frontend/src/components/layout/language.component.tsx) maps the generic `ar` language code to the Saudi Arabia flag (`SA`). For an Algeria-first experience, that is a product-localization mismatch. The implementation should decide whether to use an Algerian regional presentation or remove national flags from language-only choices, then test the result. Do not change this silently without deciding the intended locale semantics.

## Direction handling found in source

- [change.dir.tsx](https://github.com/Loofy147/postiz-algeria/blob/main/apps/frontend/src/components/new-layout/change.dir.tsx) sets `dir=rtl` for `ar` and `he` when its effect runs on mount.
- [html.component.tsx](https://github.com/Loofy147/postiz-algeria/blob/main/apps/frontend/src/components/layout/html.component.tsx) also listens for language changes and updates the document direction from translation settings.
- [language.component.tsx](https://github.com/Loofy147/postiz-algeria/blob/main/apps/frontend/src/components/layout/language.component.tsx) updates the document direction during a language change.

This shows existing direction-handling code, not that every screen is RTL-correct. Potential runtime checks include initial-load/hydration parity, language switching, modal and editor direction, calendar/navigation layout, mixed Arabic/Latin strings and mobile overflow.

## Decision

**Do not introduce a second translation framework.** Reuse the existing i18next/locales architecture and target verifiable gaps: Algeria-aware language presentation, runtime RTL correctness, localization review and test coverage. Any proposed code change must first follow the repository's frontend-specific agent instructions and be tested against the pinned toolchain.

## Remaining open checks

- [ ] Obtain a reproducible development environment and read the repository's required Next.js guidance from the installed version before code changes.
- [ ] Run baseline install, lint/type checks, frontend/backend builds and existing tests; archive command, environment, exit code and logs.
- [ ] Inspect translation loading, namespace behavior and server/client locale synchronization.
- [ ] Perform screenshot/manual tests for Arabic RTL across all priority flows and mobile widths.
- [ ] Review the French resource's 36 English-identical values in context.
- [ ] Test actual user language choice persistence across reload and authenticated/unauthenticated surfaces.
- [ ] Evaluate Darija as content-generation style separately from interface localization.


## Implementation follow-up — 2026-10-28

The feature branch adds a shared locale utility at `libraries/react-shared-libraries/src/translation/locale.utils.ts`. It normalizes locale tags, resolves them against the supported language list with the configured fallback, and derives text direction from the primary language subtag. The authenticated app root renders validated `lang` and `dir` attributes server-side, reducing dependence on a post-mount direction correction. Client-side language changes update both attributes and remove their i18next event listener on cleanup. The Arabic language choice uses Algeria's `DZ` flag in this fork.

### Verification evidence

- `node --experimental-strip-types --test scripts/test-locale-utils.mjs` — **PASS, 4 tests** (regional locale normalization, blank/unsupported fallback, RTL/LTR detection and English/Arabic/French key-set parity).
- TypeScript transpilation diagnostics on all five changed TS/TSX files — **PASS, 0 syntax diagnostics**.
- `git diff --check` — **PASS**.
- `corepack pnpm exec tsc --noEmit --pretty false -p apps/frontend/tsconfig.json` — **PASS** (exit code 0).
- Production frontend build — **PASS**: `corepack pnpm --filter ./apps/frontend run build` completed with exit code 0, including optimized compile, Next.js TypeScript, page-data collection and static-page generation. The sandbox used Node `22.22.1` while the repository requests `22.23.4`; repeat in CI on the pinned runtime.
- Browser screenshots, visual RTL behavior, accessibility and mobile checks — **OPEN**.

### Timezone decision

The existing implementation detects the browser timezone and supports a per-user override stored in the user record; it also retains the prior selection for routes outside the signed-in layout. The Algeria localization work therefore must not force `Africa/Algiers` onto every user. Any Algeria-focused suggestion should be an explicit, editable default and must preserve user overrides. Source inspected: `apps/frontend/src/components/layout/set.timezone.tsx`, `apps/frontend/src/components/new-layout/layout.component.tsx`, `apps/frontend/src/components/settings/metric.component.tsx`, and the `User.timezoneName` field in the Prisma schema.
