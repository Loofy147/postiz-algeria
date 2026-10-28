# Implementation Roadmap and Completion Checklist

**Status:** All phases OPEN. This is a plan, not an implementation report.  
**Review date:** 2026-10-28  
**Working branch:** `feature/algeria-product-foundation`

A phase is complete only when its exit criteria are supported by inspectable evidence. Keep unresolved tasks OPEN rather than marking them complete based on discussion.

## Phase 0 — Repository, product and gap baseline

- [ ] Record the exact upstream remote/source, fork relationship, default branch and baseline commit SHA.
- [ ] Review upstream license and all relevant notices; record the compliance plan.
- [ ] Inventory root workspaces, package scripts, apps, libraries, provider adapters, schedulers/workers, database schema and tests.
- [ ] Identify existing locale/i18n and RTL support; inspect how dates and timezones are stored and rendered.
- [ ] Identify existing approval, workspace/tenant and role models before proposing new schema.
- [x] Fix source-confirmed post/group write ownership gaps and add isolated tenant-guard regression tests; two-organization database/API coverage remains OPEN.
- [ ] Run the documented dependency install and full workspace build in a reproducible environment.
- [x] Run isolated repository regression commands: URL safety 6/6 and localization 4/4 on Node 22.22.1 / pnpm 10.6.1; exact pinned Node 22.23.4 and full CI/build remain OPEN.
- [ ] Save raw command output, environment/tool versions, exit codes and any blockers as an audit artifact.
- [ ] Review recent upstream security fixes and determine whether the fork is behind upstream.
- [ ] Write a baseline report separating verified facts, inference and open questions.
- [x] Create the prioritized [add-ons and gap register](ADD_ONS_AND_GAP_REGISTER.md), with source surfaces, owners/status vocabulary, acceptance criteria and no-duplication rules.
- [x] Identify the CI/runtime mismatch: repository declares Node.js 22.23.4 while the previous build workflow used 22.12.0; workflow alignment and locale tests are included in this branch, but a successful Actions run is still required.
- [x] Record a partial [publishing reliability/provider audit](PUBLISHING_AND_PROVIDER_AUDIT.md); add SSRF-safe RSS/article fetching with URL revalidation, pinned-DNS dispatch, redirect limits and response-size bounds. Regression execution and CI remain OPEN.

**Exit gate:** reproducible baseline report exists; test/build status is known, not assumed; no product implementation starts by duplicating an existing subsystem.

## Phase 1 — Architecture and provider capability audit

- [ ] Inventory every connector implemented in the current code, including supported operations, scopes, media types and platform-specific limitations.
- [ ] Check each connector's source code against the upstream's current official documentation.
- [ ] Exercise safe test-account flows where authorization is available: connect, validate, disconnect/revoke and reconnect.
- [ ] Test publishing only in provider-approved environments/accounts; never treat a UI success as proof of a provider publish.
- [ ] Record API quotas, approval/audit prerequisites, token expiry, analytics availability and known limitations.
- [ ] Map scheduler/worker retry behavior and possible duplicate-publish cases.
- [x] Inspect the Temporal publishing workflow's existing unknown-outcome and duplicate-prevention contracts; broad provider-by-provider fault-injection remains OPEN.
- [x] Replace empty workflow-dispatch catches with Sentry reporting and propagated start failures at the callers. Backend typecheck, telemetry-delivery verification and reconciliation tests remain OPEN.
- [ ] Identify observability gaps: job status, logs, queue lag, reconciliation, alerting and operator actions.
- [ ] Complete [Integration Capability Matrix](INTEGRATION_CAPABILITY_MATRIX.md) with evidence for each priority provider.

**Exit gate:** each priority connector is classified as Verified, Partial, Manual-only, Blocked or Not audited, with scope and evidence links.

## Phase 2 — Localization foundations

- [ ] Identify the existing frontend localization framework and conventions.
- [ ] Make interface locale independent from post authoring language.
- [ ] Implement or extend locale configuration without duplicating existing mechanisms.
- [ ] Verify true RTL layout, focus order, navigation, form validation, dialogs, charts, menus and icon orientation.
- [ ] Verify mixed-direction strings: Arabic + Latin product names, links, handles, hashtags, numbers and punctuation.
- [ ] Add Arabic and French user-facing strings for the first supported workflows.
- [ ] Add optional Darija generation settings only if the selected generation pathway and quality review are ready.
- [ ] Preserve the browser-detected IANA timezone and saved user preference; optionally suggest `Africa/Algiers` through an explicit, editable Algeria-focused onboarding choice.
- [x] Add automated locale fallback, direction and English/Arabic/French translation-key parity checks (`scripts/test-locale-utils.mjs`; 4 tests passed on 2026-10-28).
- [ ] Add a documented manual review script for visual RTL, typography and mixed-script formatting.
- [ ] Test on narrow mobile viewports and slower/unstable networks.

**Exit gate:** critical onboarding and content-scheduling journeys pass in Arabic RTL and French; no silent content/timezone loss occurs.

## Phase 3 — Core workflow improvements

- [ ] Review current calendar/composer/scheduling behavior before changing data contracts.
- [ ] Add/extend per-channel validation and previews using verified provider capability data.
- [ ] Make publish-state transitions explicit and auditable.
- [ ] Validate idempotency and retry handling; make ambiguous outcomes visible rather than forcing a blind retry.
- [ ] Verify queued posts are reconciled when Temporal workflow startup fails; define alerting and user-visible dispatch failure behavior.
- [ ] Add clear actionable states for expired permissions, provider errors and manual-only channels.
- [ ] Test file/media upload interruptions and recovery.
- [ ] Verify approval flow for at least one multi-user workspace and one separated client workspace.
- [ ] Exercise cross-organization post/group IDs against a test database, including create/update/soft-delete and publishing workflow actions.
- [ ] Add regression tests for all defects discovered in Phases 0–2.

**Exit gate:** priority end-to-end workflows pass, including expected provider failures and credential expiry.

## Phase 4 — AI content workflows

- [ ] Inspect existing AI services/providers, prompt storage, key handling, quotas and costs.
- [ ] Specify a narrow task contract for caption variants before adding generalized agents.
- [ ] Implement language/style selection and channel-specific output only where provider constraints are established.
- [ ] Keep output in draft state until human approval.
- [ ] Add timeout, quota, provider outage and retry behavior without destroying the user's draft.
- [ ] Create a small evaluation set with fluent reviewers for Arabic, French, Darija and mixed-script cases.
- [ ] Measure acceptance/edit rate and failure rate; do not use subjective demo quality as proof.
- [ ] Add per-workspace usage accounting and cost controls.

**Exit gate:** evaluation results and provider-cost behavior are inspectable; unsafe silent publishing is prevented.

## Phase 5 — Local commercial readiness

- [ ] Research and document current Algerian merchant eligibility and requirements for candidate payment providers.
- [ ] Confirm merchant account, API access, recurring-payment capabilities (if required), refund flow, settlement, reconciliation and test environment.
- [ ] Keep production billing disabled until provider certification and end-to-end reconciliation pass.
- [ ] Estimate cost per workspace at expected usage and define quotas/alert thresholds.
- [ ] Prepare terms, privacy notice, cancellation/refund process and retention policy for legal review.
- [ ] Define support channels, response expectations and an incident escalation path.
- [ ] Test subscription lifecycle only after provider eligibility has been confirmed.

**Exit gate:** payment and legal/commercial prerequisites are evidenced; there is no placeholder checkout presented as real payment processing.

## Phase 6 — Production hardening

- [ ] Run lint, type checks, unit, integration, authorization, localization, migration and end-to-end tests.
- [ ] Test tenant isolation with adversarial identifiers and direct API access.
- [ ] Inspect dependency/security findings and resolve or formally accept residual risks.
- [ ] Verify secure secret handling and that logs exclude tokens and sensitive content by default.
- [ ] Add production health/readiness checks, structured logs, alerting and queue monitoring.
- [ ] Demonstrate a database backup restore in a separate environment.
- [ ] Demonstrate rollback of an application release and database migration strategy.
- [ ] Load-test representative scheduling and media workflows; record limits and environment.
- [ ] Verify privacy/data export/deletion and incident response paths.
- [ ] Complete the [Production Readiness Checklist](PRODUCTION_READINESS.md).

**Exit gate:** critical release gates pass and an independent reviewer can reproduce the evidence.

## Phase 7 — Controlled launch and validation

- [ ] Use a staged pilot with a small, explicitly recruited set of businesses/creators.
- [ ] Gather informed user feedback; separate direct observations from interpretations.
- [ ] Track first-post completion, provider-specific publish success, duplicate rate, support burden and unit costs.
- [ ] Review failures and incidents daily during the initial pilot.
- [ ] Maintain a documented rollback/disable switch for a broken provider or job type.
- [ ] Compare observations with predeclared success thresholds; do not change thresholds after seeing results without recording the revision.
- [ ] Decide whether to scale, revise or pause based on evidence.

**Exit gate:** pilot outcomes, residual risks, cost assumptions and a go/no-go decision are documented.

## Working discipline

For each issue or change, record:
1. Claim/problem and expected user impact.
2. Evidence and reproduction steps.
3. Proposed change and why existing mechanisms are insufficient.
4. Test/acceptance criteria.
5. Implementation commit/PR.
6. Verification result and residual uncertainty.
7. Rollback/recovery strategy where applicable.

### Current state

- [x] Confirmed repository is a populated fork of `gitroomhq/postiz-app`.
- [x] Locale foundation implemented on `feature/algeria-product-foundation`: supported-locale normalization, server-rendered `lang/dir`, client synchronization and Algeria-aware Arabic flag.
- [x] Focused locale regression suite passed 4/4; frontend TypeScript check passed; optimized frontend build passed under sandbox Node 22.22.1; built-app SSR locale smoke tests passed 4/4.
- [x] Created the [add-ons and gap register](ADD_ONS_AND_GAP_REGISTER.md) with 14 prioritized specifications, acceptance gates and audit-before-add constraints.
- [x] Corrected the CI workflow to request Node.js 22.23.4, pnpm 10.6.1 and run the localization suite before the build.
- [ ] GitHub Actions run for the latest branch commit — OPEN (the repository currently returns zero workflow runs; do not infer a pass).
- [ ] Full workspace build verified under the declared runtime — OPEN.
- [ ] Browser RTL/mobile/accessibility checks — OPEN.
- [ ] Provider/API audit and authorized provider-side publishing evidence — OPEN.
- [ ] Tenant-isolation, publishing recovery, data portability and production operations gates — OPEN.
- [ ] Production launch — OPEN.

## Evidence-backed implementation progress (2026-10-28)

The ranked add-on/gap specifications are in [ADD_ONS_AND_GAP_REGISTER.md](ADD_ONS_AND_GAP_REGISTER.md). That register distinguishes source presence from verified behavior and prevents work on replacement subsystems until audits establish a real gap.

- [x] Shared locale utilities resolve supported locale codes and derive text direction from the primary language subtag.
- [x] The authenticated app root now renders validated `lang` and `dir` attributes server-side from the language cookie.
- [x] Client-side language changes synchronize both document attributes and clean up the language-change subscription.
- [x] The Arabic language-picker flag maps to Algeria (`DZ`) in this fork.
- [x] Focused locale tests pass: regional locale normalization, invalid/blank fallback, RTL/LTR direction and translation-key parity (4/4).
- [x] Frontend TypeScript check passed: `corepack pnpm exec tsc --noEmit --pretty false -p apps/frontend/tsconfig.json` (exit code 0).
- [x] Optimized frontend production build passed: `corepack pnpm --filter ./apps/frontend run build` (exit code 0). Environment warning: sandbox Node was `22.22.1`; root package requests `22.23.4`, so CI should re-verify under the pinned runtime.
- [x] Built-app HTTP smoke test verifies initial HTML lang/dir for Arabic, ar-DZ, French and an invalid locale (4/4 PASS, 2026-10-28).
- [ ] Browser-level RTL and mobile visual checks remain OPEN.
