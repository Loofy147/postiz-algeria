# Publishing Reliability and Provider Capability Audit

**Review date:** 2026-10-28  
**Branch:** `feature/algeria-product-foundation`  
**Status:** Partial source audit. Findings below distinguish observed source behavior from behavior not yet exercised end-to-end.

## Scope and evidence limits

This pass inspected the feed-based autopost path, the Temporal publishing workflow, provider contracts, post persistence paths, and the subscription policy guard. It did not use live social accounts or execute real provider publishes. Provider approval, account-type permissions, and real-world outcomes remain **OPEN**. Source inspection proves that code exists, not that an external platform accepts an operation.

For reproducibility, relevant reviewed source blob SHAs are: `AutopostService` after hardening `4d366943096084c164cbf4592c0aef938937809d`; SSRF-safe text fetch `7adc28c0a0499d9baa61e47d4a08ea3229ea2326`; post workflow v1.1.2 `f2976a2645c1d66ae0f9b512244d7e93edf20877`; `PostsService` after dispatch-reporting and fail-closed change (current branch source; see file history); `PostsRepository` `c2830afdd0c3cdbd3ce78377b7066562fc58de06`; provider interface `261b84e25e623b8ca63c50b4cf0f2569d8a62b7b`.

## Findings

### PUB-SEC-01 — Server-side RSS/article fetch needed redirect-safe SSRF controls

**Status:** SSRF mitigation implemented; repository safety tests pass locally on Node 22.22.1, but the repository pins 22.23.4 and GitHub Actions has no run for the current PR head.  
**Priority:** P0 security gate.

Before the change, `AutopostService.loadXML()` delegated fetching to `rss-parser.parseURL(url)`, while `loadUrl()` used plain `fetch(url)` on a link originating in RSS content. The configured feed URL is validated by `AutopostDto`, but an RSS item link is separate external input. Validation of the initial URL alone does not make redirect destinations safe.

The new `fetchSafePublicHttpsText()` wrapper and dependency-injected `safe.public.https.fetch.core.mjs` helper:
- validates every URL hop as public HTTPS;
- follows redirects manually and limits redirect count;
- uses the existing pinned-DNS SSRF-safe Undici dispatcher at connection time;
- rejects embedded URL credentials;
- sets a per-request timeout and caps streamed response bytes.

Both RSS feed retrieval and article-link retrieval now use this helper. Empty feeds or feeds without a usable item link are reported as unsuccessful rather than treated as a valid latest item.

**Change/evidence paths:** [SSRF-safe fetch wrapper](../../libraries/nestjs-libraries/src/dtos/webhooks/safe.public.https.fetch.ts), [testable fetch core](../../libraries/nestjs-libraries/src/dtos/webhooks/safe.public.https.fetch.core.mjs), [core type contract](../../libraries/nestjs-libraries/src/dtos/webhooks/safe.public.https.fetch.core.d.mts), [URL safety regression tests](../../scripts/test-safe-public-fetch.mjs), [autopost service](../../libraries/nestjs-libraries/src/database/prisma/autopost/autopost.service.ts), [autopost DTO validation](../../libraries/nestjs-libraries/src/dtos/autopost/autopost.dto.ts), [existing SSRF dispatcher](../../libraries/nestjs-libraries/src/dtos/webhooks/ssrf.safe.dispatcher.ts).

**Remaining acceptance gates:**
- [x] Apply safe fetch to both configured RSS feeds and RSS item links.
- [x] Add regression checks proving unsafe URLs are rejected before the injected transport is called.
- [ ] Execute `pnpm run test:url-safety` under the repository's pinned Node/pnpm toolchain.
- [ ] Confirm the full CI build passes.
- [x] Add deterministic tests for private/non-HTTPS redirect destinations, redirect loops, and streamed response-size limits.

**Local test evidence (2026-10-28):** On the repository checkout at commit `fa466b9459fb5c2bc169632133d6345b75e143dd`, `corepack pnpm run test:url-safety` passed 6/6 and `corepack pnpm run test:localization` passed 4/4 using Node `v22.22.1` / pnpm `10.6.1`. The run emitted the repository engine mismatch warning because Node `22.23.4` is pinned. These are local tests, not GitHub Actions, the full workspace build, or provider-side verification.

### PUB-REL-01 — Temporal publish workflow has meaningful duplicate-prevention behavior

**Status:** Source behavior observed; broad provider-by-provider execution remains OPEN.  
**Priority:** Preserve existing design; test it rather than replacing it.

The current `post.workflow.v1.1.2.ts` separates read-only status checks from irreversible publishing mutations. Mutation activities have no automatic SDK retries; workflow logic distinguishes a heartbeat timeout before an activity started from a timeout after execution may have begun. The pending-post contract uses `pending`, `ready`, and `completed` states. Ambiguous outcomes are marked unconfirmed and the user is told to check the provider account before retrying. The provider interface explicitly documents that finalization must not repeat non-idempotent mutations after an unknown outcome. `PublishedWithError` preserves a provider post ID/URL when the external post exists but a follow-up mutation fails.

**Source paths:** [post workflow v1.1.2](../../apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.1.2.ts), [post activities](../../apps/orchestrator/src/activities/post.activity.ts), [provider operation contract](../../libraries/nestjs-libraries/src/integrations/social/social.integrations.interface.ts), [provider error types](../../libraries/nestjs-libraries/src/integrations/social.abstract.ts).

**Remaining acceptance gates:**
- [ ] Fault-injection tests for pre-request failure, accepted request with lost response, worker restart, duplicate workflow signal, and provider status polling outage.
- [ ] Run the same outcome matrix for every priority provider that implements `postPending`.
- [ ] Record residual duplication risk for providers that cannot reconcile a timed-out create operation.
- [ ] Prove cancellation/rescheduling cannot leave two active workflows for one post.

### PUB-REL-02 — Workflow dispatch and schedule reconciliation

**Status:** Source mitigations and standalone state-machine tests committed; Temporal integration, API, CI and reconciliation proof remain OPEN.  
**Priority:** P1 reliability/operations.

**Source finding:** the former implementation could return `false` after a workflow-list/termination failure, while some callers did not inspect that return value. It also used `TERMINATE_EXISTING` after a non-atomic list/terminate preflight, which could terminate an execution that appeared after the preflight and might be inside an irreversible provider request.

**Changes applied in this branch:**
- [x] Replace the queued-post start-then-signal sequence with Temporal `signalWithStart`, using `USE_EXISTING`. The server atomically starts the stable workflow if absent or delivers `poke` to the existing execution.
- [x] For DRAFT transitions, enumerate running executions and signal them without starting a new workflow.
- [x] Make the scheduled workflow's wait respond to `poke`: reload the post, follow its current publish date, and exit if it is no longer queued or has been deleted.
- [x] Re-read the post and refresh its pre-publish snapshot immediately before the first provider mutation when a scheduling signal is pending.
- [x] Return explicit `workflowDispatch` response values from create, status-change and schedule-date operations; failures are logged and surfaced as `unconfirmed`.
- [x] For deletion, soft-delete first, then send a dedicated `stop` signal to the stable root execution and other visible matching executions; do not terminate a workflow that may be inside a provider request.
- [x] The workflow stop handler wakes scheduled waits and delayed comment/follow-up waits, and applies to repeat-post child workflows (`postNow=true`) as well as the root.
- [x] Preserve an in-flight provider result, then stop before starting subsequent comments, notifications, webhooks, plugs or another repeat action when stop/deletion is observed.
- [x] Return deletion's `workflowSignal: 'not_required' | 'signalled' | 'unconfirmed'`.
- [x] Add seven dispatch-helper tests, six schedule-wait tests and four Autopost-dispatch tests; combined 17/17 pass locally on Node `v22.16.0`.
- [ ] Add service-level/API tests for dispatch and deletion response contracts and a Temporal test-environment suite for concurrent start, reschedule, draft, root stop and child stop.
- [ ] Fault-inject deletion/schedule during an in-flight provider activity and prove the accepted external result is recorded without blind retry or subsequent side effects.
- [ ] Run the new suites under pinned Node `22.23.4` / pnpm `10.6.1` and verify a successful GitHub Actions run.
- [ ] Verify missing-workflow reconciliation and measure the hourly recovery delay; confirm Sentry telemetry delivery.

**Residual boundary:** a `stop` signal cannot cancel an HTTP request already in flight or accepted by a social provider. A narrow check-to-provider-request race remains because the database does not yet enforce a durable publishing-attempt lease/CAS. Temporal visibility queries are eventually consistent; deletion therefore also targets the stable root workflow ID directly. This does not prove exactly-once external publishing.

**Evidence paths:** [PostsService](../../libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts), [dispatch helper](../../libraries/nestjs-libraries/src/database/prisma/posts/post-workflow.dispatch.ts), [dispatch tests](../../scripts/test-post-workflow-dispatch.mjs), [workflow v1.1.2](../../apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.1.2.ts), [schedule wait helper](../../apps/orchestrator/src/workflows/post-workflows/post-schedule.wait.ts), [schedule wait tests](../../scripts/test-post-schedule-wait.mjs).

### PUB-CAP-01 — Provider support cannot yet be represented as one verified product promise

**Status:** OPEN; provider-by-provider audit required.  
**Priority:** P0 before advertising any channel/media combination.

`IntegrationManager` enumerates many inherited social providers. The provider interface exposes useful constraints such as `maxLength`, `checkValidity`, DTOs, scopes and optional `postPending`/status/finalization methods. However, the existence of an adapter, UI tile, scope string or code-level validator does not prove that an authorized production account can publish every combination.

**Required capability record for each release-supported combination:**
- provider and official API product/version/documentation;
- account type and required scopes/permissions;
- application review/approval status and any account/geographic prerequisites;
- operation, post type and media types supported;
- evidence status: `NOT_AUDITED`, `CODE_FOUND`, `PARTIAL`, `VERIFIED`, `MANUAL_ONLY`, or `BLOCKED`;
- a dated, sanitized successful provider test or an explicit reason it cannot be run;
- known quotas, token refresh behavior, asynchronous processing and analytics limitations.

Do not add a second capability subsystem until the existing adapter/settings model has been assessed against these acceptance fields. Preflight must enforce limitations server-side before a post enters the publishing queue.

**Source paths:** [integration manager](../../libraries/nestjs-libraries/src/integrations/integration.manager.ts), [provider contract](../../libraries/nestjs-libraries/src/integrations/social/social.integrations.interface.ts), [server-side post validation](../../libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts).

### PUB-SEC-02 — Post/group writes lacked consistent organization ownership checks

**Status:** Source mitigation implemented; regression suite passes locally. Full repository typecheck/build and a database-backed cross-tenant integration test remain release gates.  
**Priority:** P0 security/data-integrity gate.

**Source finding:** `PostsService.mapTypeToPost()` validates that each selected integration belongs to the current organization, but does not validate client-supplied post IDs or group IDs. `createPost()` calls `guardAgainstRepublish()` with an organization-scoped lookup, but a missing result is treated like a non-published post and is not rejected there. `PostsRepository.createOrUpdatePost()` previously upserted by post ID alone; its update payload could therefore target an existing record from another organization. The repository also had group-based cleanup queries that did not include `organizationId`.

**Change applied in this branch:**
- [x] Add `validatePostOwnership()` to reject duplicate client-supplied IDs, IDs not returned by the current organization-scoped lookup, and groups not found within the current organization.
- [x] Reuse tested `ownedPostIdsWhere()`, `ownedPostIdWhere()`, and `ownedPostGroupWhere()` builders for the repository lookup filters.
- [x] Scope the upsert's extended unique filter to `id + organizationId + deletedAt:null`.
- [x] Scope previous-root lookup and both group-cleanup/sweep updates to the current organization.
- [x] Add a six-test tenant ownership suite and a root script `pnpm run test:tenant-safety`; wire it into the build workflow.
- [ ] Run backend TypeScript checks and the full workspace build after the latest repository changes.
- [ ] Add database-backed API/integration tests using two real test organizations to prove foreign post/group IDs cannot update, delete, publish, or reassign records.
- [ ] Audit other resource routes and direct repository mutation methods; this fix does not establish full application-wide tenant isolation.
- [ ] Confirm a successful GitHub Actions run. No Actions run is recorded for the current PR at the time of this review.

**Local evidence (2026-10-28):** On synced checkout commit `84aee2296bfae7a8f543313a6b0374fdee2fc344`, `corepack pnpm run test:tenant-safety` passed 6/6, `corepack pnpm run test:url-safety` passed 6/6, `corepack pnpm run test:localization` passed 4/4, `git diff --check` passed, and the backend TypeScript check passed with zero diagnostics using a 3 GiB heap. These are local Node `v22.22.1` / pnpm `10.6.1` results; the repository pins Node `22.23.4`. The ownership tests exercise the reusable guard contract and filter builders; they are not a substitute for database-backed API tests.

**Source paths:** [PostsRepository](../../libraries/nestjs-libraries/src/database/prisma/posts/posts.repository.ts), [ownership guard/filter contract](../../libraries/nestjs-libraries/src/database/prisma/posts/post.ownership.filters.ts), [ownership tests](../../scripts/test-post-ownership-safety.mjs), [PostsService](../../libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts), [posts controller](../../apps/backend/src/api/routes/posts.controller.ts).

### PUB-AUTO-01 — Autopost workflow dispatch needs explicit outcomes

**Status:** Source mitigation and helper tests committed; service/Temporal runtime verification remains OPEN.  
**Priority:** P1 reliability/operations.

**Source finding:** the earlier `AutopostService.processCron()` used optional chaining for the Temporal client and swallowed start/termination exceptions. The API methods could return persisted Autopost records without distinguishing a confirmed workflow transition from an unavailable or failed Temporal operation.

**Changes applied in this branch:**
- [x] Require a Temporal client for activation/deactivation orchestration.
- [x] Report failures through Logger and Sentry with organization, Autopost and workflow identifiers only.
- [x] Return `workflowDispatch` values from create/update, active-toggle and delete operations.
- [x] Isolate the dispatch result contract and add five standalone tests for activation, deactivation, missing workflow and failure handling; tests pass locally on Node `v22.16.0`.
- [ ] Add AutopostService tests with a mocked Temporal client and verify response behavior.
- [ ] Verify that `stop_requested` and `not_running` API statuses match the Temporal signal result, including a legacy history and an activity already in flight.
- [ ] Verify worker-restart recovery for active Autopost records.
- [ ] Resolve the separate entitlement-policy question in PUB-AUTH-01.

New activation uses `signalWithStart` with `USE_EXISTING` and an `activate` signal; deactivation sends `stop` and reports `not_running` when no execution exists. New histories use signal-driven waiting and exit after the current `autoPost` activity returns. A `patched('autopost-graceful-signals')` branch preserves the old sleep/continue-as-new command sequence for legacy histories, where a stop may wait for the current activity or hourly timer. The activity itself runs one LangGraph invocation across selected integrations and cannot be interrupted mid-flight by the workflow signal.

**Evidence paths:** [AutopostService](../../libraries/nestjs-libraries/src/database/prisma/autopost/autopost.service.ts), [dispatch helper](../../libraries/nestjs-libraries/src/database/prisma/autopost/autopost.workflow.dispatch.ts), [dispatch tests](../../scripts/test-autopost-workflow-dispatch.mjs).

### PUB-AUTH-01 — Autopost entitlement behavior is inconsistent across mutations

**Status:** OPEN; intended subscription semantics require confirmation against the product contract.  
**Priority:** P1; not currently classified as a cross-tenant data leak.

The global `PoliciesGuard` returns `true` when a route has no `@CheckPolicies` metadata. In `AutopostController`, create has a `WEBHOOKS` policy, while update, delete and active-toggle routes do not. The related repository mutations include the organization ID, which is positive evidence for tenant scoping, but the subscription/feature gate is not consistent across operations.

**Required next work:**
- Decide whether plans restrict creation only, or also editing, activation and running existing autoposts.
- Encode the intended action semantics in the policy service and regression tests; do not blindly copy the create policy to update/delete because its current quota logic only grants `Create`.
- Prove users cannot operate on another organization's autopost ID.
- Keep service-level organization constraints even when controller policies exist.

**Source paths:** [autopost controller](../../apps/backend/src/api/routes/autopost.controller.ts), [autopost repository](../../libraries/nestjs-libraries/src/database/prisma/autopost/autopost.repository.ts), [policy guard](../../apps/backend/src/services/auth/permissions/permissions.guard.ts), [policy service](../../apps/backend/src/services/auth/permissions/permissions.service.ts).

## Next execution order

1. Add Temporal test-environment/API coverage for dispatch, concurrent schedule changes, draft/delete transitions and provider-call fault injection.
2. Add Autopost failure-path tests and confirm the semantics of stop requests and subscription policy.
3. Confirm the SSRF production wrapper/validator/dispatcher under pinned Node.js `22.23.4` / pnpm `10.6.1` in CI.
4. Build the dated provider capability evidence matrix for launch-priority channels.
5. Run tenant isolation and entitlement tests against a real test database, then trace error redaction/retention.

## Release gate

This audit is **not** a production-readiness certificate. No live provider publishing, external app approval, production deployment, or full tenant-isolation test is claimed here. Keep those gates OPEN until linked evidence exists.
