# Second-Pass Engineering Review — Postiz Algeria

**Review date:** 2026-11-01  
**Reviewed PR head:** see the live head shown in [PR #1](https://github.com/Loofy147/postiz-algeria/pull/1); the review is a rolling assessment.
**Branch:** `feature/algeria-product-foundation`  
**PR:** [#1](https://github.com/Loofy147/postiz-algeria/pull/1)  
**Review type:** Source/diff review with focused standalone helper tests. This is not a backend/full-workspace build, Temporal integration test, runtime penetration test or production-readiness certification.

**Reviewed PR diff:** last fetched PR metadata showed 40 files changed (+3154/-157); recheck the live PR before merge.

## Executive verdict

**Recommendation: keep PR #1 in draft; do not treat it as merge-ready yet.**

The direction is sound: avoid replacing existing Postiz subsystems, validate writes at the repository boundary, harden RSS/article retrieval, and preserve the Temporal pending/finalization model. However, the second pass found important behavior/contract gaps that are not closed by the current unit tests or by the documentation.

At the reviewed head, the PR is open and draft, with 32 changed files (+2266/-103). GitHub reported **no workflow runs, no combined status checks, and no recorded PR reviews** for this head. No current CI pass is claimed.

## Findings, ordered by risk

### REVIEW-01 — Workflow dispatch can be reported as success

**Priority:** P1 — reliability / user-visible correctness  
**Status:** PARTIALLY ADDRESSED IN SOURCE; CI and API-level integration proof OPEN.

The previous `false` return paths were removed from `PostsService.startWorkflow()`. Dispatch now uses a tested decision helper: queued posts start or reuse the stable Temporal workflow ID with `USE_EXISTING` and signal `poke`; draft transitions signal existing executions without starting another one. Missing-client, list, start, and signal errors are caught at the service boundary, logged to Sentry/Logger, and represented as `workflowDispatch: 'unconfirmed'`.

The create-post, change-status, and schedule-date responses now expose a dispatch status, so a persisted post is no longer indistinguishable from one whose dispatch was confirmed. Draft/no-workflow cases are represented separately from stop requests.

**Verification completed:** seven standalone dispatch-helper regression tests pass locally on Node `v22.16.0`. They cover queue dispatch, reuse/signaling, draft with and without a running workflow, and list/start/signal failures.

**Remaining gates**
- [ ] Add service-level tests proving the API response contract for create, status change and date change.
- [ ] Verify actual Temporal client behavior for `USE_EXISTING` followed by signal, including the concurrent-start case.
- [ ] Verify Sentry delivery and the hourly missing-workflow reconciliation path.
- [ ] Run the tests and backend/full workspace build under pinned Node `22.23.4` / pnpm `10.6.1` in GitHub Actions.

**Evidence:** [PostsService](../../libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts), [dispatch helper](../../libraries/nestjs-libraries/src/database/prisma/posts/post-workflow.dispatch.ts), [dispatch tests](../../scripts/test-post-workflow-dispatch.mjs), [CI workflow](../../.github/workflows/build.yml).
### REVIEW-02 — Destructive workflow conflict handling replaced; in-flight mutation remains a boundary

**Priority:** P1 — publication integrity  
**Status:** DESTRUCTIVE RESTART PATH REMOVED; SCHEDULE-WAIT REGRESSION TESTS PASS LOCALLY; FULL CONCURRENCY PROOF OPEN.

The post dispatcher no longer terminates the previously running execution and no longer starts with `TERMINATE_EXISTING`. A queued post now uses Temporal `signalWithStart` with `USE_EXISTING`, which atomically starts the stable workflow or signals the existing execution with `poke`. A running scheduled workflow now uses Temporal `condition()` through a testable wait state machine, re-reads the post after a signal, and exits without changing a draft back to `ERROR`. Before the first provider mutation, it rechecks the latest queued state/date and refreshes the persisted post snapshot if a signal arrived.

**Verification completed:** five standalone schedule-wait tests pass locally on Node `v22.16.0`, covering due posts, a later reschedule, conversion to draft, an early signal, and deletion.

**Residual uncertainty:** signaling does not cancel an HTTP request already in flight at a social provider. There is also no database-level publishing lease/CAS that makes the final state check and provider call atomic. A narrow race remains between the last recheck and the irreversible remote request; the provider outcome must still be treated as potentially ambiguous. No duplicate publication is alleged.

**Remaining gates**
- [ ] Add Temporal test-environment coverage for two concurrent schedule changes and a start/start race.
- [ ] Fault-inject a schedule/draft/delete request while the provider activity is in flight; verify the accepted outcome is recorded and no blind retry occurs.
- [ ] Decide whether a database-level publishing-attempt/lease state is required to close the final check-to-request race.

**Evidence:** [PostsService](../../libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts), [workflow v1.1.2](../../apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.1.2.ts), [schedule-wait helper](../../apps/orchestrator/src/workflows/post-workflows/post-schedule.wait.ts), [schedule-wait tests](../../scripts/test-post-schedule-wait.mjs).
### REVIEW-03 — Autopost dispatch reporting is implemented; integration proof remains OPEN

**Priority:** P1 — automation reliability  
**Status:** SOURCE MITIGATION COMMITTED; FOUR HELPER TESTS PASS LOCALLY; SERVICE/WORKER INTEGRATION OPEN.

`AutopostService.processCron()` now checks the Temporal client instead of relying on optional chaining. Activation uses Temporal `signalWithStart` with `USE_EXISTING` and an `activate` signal; deactivation sends `stop`, and a missing execution is reported as `not_running`. Errors produce structured Logger/Sentry events with organization, autopost and workflow IDs, without embedding feed content or credentials. Create/update, active-toggle and delete responses include a `workflowDispatch` status: `started_or_reused`, `stop_requested`, or `unconfirmed`.

The decision/result contract is isolated in `autopost.workflow.dispatch.ts`. Five standalone tests pass locally on Node `v22.16.0`, covering activation, deactivation, and failure reporting for both paths.

New histories use signal-driven waiting and exit after the current `autoPost` activity returns. `patched('autopost-graceful-signals')` preserves the original timer/continue-as-new path for older histories; a legacy stop may therefore wait for the current activity or hourly timer. `AutopostActivity.autoPost()` is one activity that can run a LangGraph job across multiple integrations, so a stop signal cannot interrupt its internal provider work midway.

**Remaining gates**
- [ ] Add service-level tests for missing Temporal client, stable workflow ID, and Sentry context.
- [ ] Verify `signalWithStart`/`activate`/`stop` behavior in the Temporal test environment, including legacy histories and continue-as-new.
- [ ] Verify active-autopost recovery after a worker restart and deletion while a workflow is active.
- [ ] Resolve whether subscription/role policy is intended to gate update, activate and deactivate as well as create.

**Evidence:** [AutopostService](../../libraries/nestjs-libraries/src/database/prisma/autopost/autopost.service.ts), [dispatch helper](../../libraries/nestjs-libraries/src/database/prisma/autopost/autopost.workflow.dispatch.ts), [tests](../../scripts/test-autopost-workflow-dispatch.mjs), [AutopostController](../../apps/backend/src/api/routes/autopost.controller.ts).

### REVIEW-04 — SSRF tests bypass the production URL validator and dispatcher
**Priority:** P1 — security verification gap  
**Status:** Mitigation code is present; production gate remains unverified.

The core regression suite imports `fetchPublicHttpsText()` and injects a test validator that accepts any URL whose hostname equals `public.example`. That verifies redirect logic and response-size logic in the helper, but it does not exercise the production wrapper's `isSafePublicHttpsUrl` validator or `getSsrfSafeDispatcher()`/pinned-DNS behavior. The current suite therefore cannot, by itself, prove that actual production DNS resolution, rebinding defenses, and the dispatcher are wired and effective.

This is a test-coverage limitation, not evidence that the mitigation is broken.

**Required change**
- Add tests against the production validator for IPv4/IPv6 private, loopback, link-local, reserved and mixed/obfuscated host forms, including redirect hops.
- Add a controlled integration test for the actual wrapper/dispatcher seam and DNS pinning behavior without making unsafe requests to real private services.
- Verify invalid/expired DNS, redirect-to-private, timeout/abort, oversized compressed/decoded body, unsupported content, and error behavior.
- Keep CI/release status `OPEN` until those checks run under the repository's pinned runtime.

**Evidence:** [fetch wrapper](../../libraries/nestjs-libraries/src/dtos/webhooks/safe.public.https.fetch.ts), [fetch core](../../libraries/nestjs-libraries/src/dtos/webhooks/safe.public.https.fetch.core.mjs), [current core tests](../../scripts/test-safe-public-fetch.mjs), [autopost source](../../libraries/nestjs-libraries/src/database/prisma/autopost/autopost.service.ts).

### REVIEW-05 — Runtime pins aligned; exact toolchain proof OPEN

**Priority:** P2 — reproducibility  
**Status:** CONFIGURATION ALIGNED; PINNED-RUNTIME EXECUTION OPEN.

Root `package.json` declares Node `22.23.4` and pnpm `10.6.1`; the build workflow uses those versions, and the Volta Node pin is now also `22.23.4`.

**Remaining gate:** run all tests and the full workspace build under exactly Node `22.23.4` / pnpm `10.6.1`. The local standalone tests in this follow-up used Node `22.16.0` and do not close this gate.

**Evidence:** [package.json](../../package.json), [build workflow](../../.github/workflows/build.yml).
### REVIEW-06 — Post deletion now requests graceful stop across root and repeat workflows

**Priority:** P1 — publication integrity / data lifecycle  
**Status:** SOURCE MITIGATION COMMITTED; TEMPORAL AND IN-FLIGHT FAILURE TESTS OPEN.

The delete path now returns `workflowSignal: 'not_required' | 'signalled' | 'unconfirmed'`. It signals the stable root workflow ID directly and also signals other running executions found by the Temporal visibility query. Deletion sends a dedicated `stop` signal, distinct from `poke` used for rescheduling. The workflow stop handler wakes scheduled waits and delayed comment/follow-up waits, and sets a workflow-local stop flag. This also covers repeat-post child workflows (`postNow=true`), which previously could bypass the scheduled wait. A provider activity already in flight is allowed to return and persist its result; after that, the workflow exits before starting comments, notifications, webhooks, plugs or another repeat action. It also exits before starting a provider action when it has observed the stop or deleted root.

**Residual uncertainty:** the Temporal visibility query is eventually consistent, so the stable root handle is signalled separately; repeat child discovery still depends on visibility. A narrow race remains if deletion lands after the last database existence check but before a provider request is sent. An external request already accepted by the provider cannot be rolled back. The code does not claim exactly-once external effects.

**Remaining gates**
- [ ] Add Temporal test-environment coverage for stop signal delivery to root and repeat child executions.
- [ ] Inject deletion while main publish/comment activities are in flight; verify accepted results are recorded and no subsequent actions run.
- [ ] Test visibility-list failure, missing root, multiple children and signal failure.
- [ ] Add a durable publish lease/CAS if fault injection demonstrates the final check-to-request race is unacceptable.

**Evidence:** [PostsService deletion path](../../libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts), [post workflow v1.1.2](../../apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.1.2.ts), [schedule wait helper](../../apps/orchestrator/src/workflows/post-workflows/post-schedule.wait.ts), [schedule wait tests](../../scripts/test-post-schedule-wait.mjs).
### REVIEW-07 — Publishing audit source-of-truth corrected

**Priority:** P2 — audit quality  
**Status:** DOCUMENTATION MITIGATION COMMITTED; PERIODIC CONSISTENCY CHECKS REMAIN OPEN.

The repository now designates `PUBLISHING_AND_PROVIDER_AUDIT.md` as the canonical publishing audit. `PUBLISHING_RELIABILITY_AUDIT.md` is explicitly labelled a supplementary source review. Its stale claim that deletion cancellation errors are still swallowed has been corrected; PR-AUD-01 now describes the `stop` signal, root/child workflows, and remaining in-flight provider limitations. Duplicate numbering in the supplementary implementation plan has also been removed.

**Remaining gate:** keep a single current status ledger and update both reports whenever implementation behavior changes. The supplementary audit remains useful for detailed source observations, but it must not contradict the canonical findings.

**Evidence:** [canonical audit](PUBLISHING_AND_PROVIDER_AUDIT.md), [supplementary source review](PUBLISHING_RELIABILITY_AUDIT.md), [README](README.md), [roadmap](ROADMAP.md), [gap register](ADD_ONS_AND_GAP_REGISTER.md).
### REVIEW-08 — Tenant ownership tests are unit tests, not database/API isolation proof
**Priority:** P1 release gate  
**Status:** Confirmed scope limitation; no application-wide tenant breach is asserted.

The repository guard validates supplied IDs and groups using organization-scoped queries, and its filter builders are used in the upsert/cleanup paths. That is a good targeted defense. However, `test-post-ownership-safety.mjs` tests the pure guard and filter-building contract; it does not exercise Prisma, the controller, authorization, soft-delete behavior or two real organizations. The repository also retains internal helpers such as `changeState(id,...)` and `getErrorsByPostIds(postIds)` without an organization argument. Their signatures alone do not prove exploitability, because callers may be trusted worker paths, but the call-site/trust-boundary audit remains unfinished.

**Required change**
- Add DB-backed integration tests with org A and org B for foreign post/group IDs across edit, update, group cleanup, reschedule, delete, publish, debug/error export and API read paths.
- Enumerate callers of post mutation/error helpers, identify the trust boundary, and require organization scope for request-facing paths. Keep worker/system paths explicit.
- Verify raw error/body retention and redaction in Post.error/Error records and the debug export. The source can store serialized errors and post bodies; token leakage has not been demonstrated, so treat it as an open data-minimization review, not a confirmed leak.

**Evidence:** [ownership guard](../../libraries/nestjs-libraries/src/database/prisma/posts/post.ownership.filters.ts), [ownership tests](../../scripts/test-post-ownership-safety.mjs), [repository](../../libraries/nestjs-libraries/src/database/prisma/posts/posts.repository.ts), [PostsService](../../libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts), [posts controller](../../apps/backend/src/api/routes/posts.controller.ts).

### REVIEW-09 — Autopost authorization intent is unresolved
**Priority:** P2 — entitlement consistency  
**Status:** Existing inconsistency found; intended product contract is OPEN.

The autopost create route has `@CheckPolicies([AuthorizationActions.Create, Sections.WEBHOOKS])`, whereas update, delete and active-toggle routes do not. Repository mutations are organization-scoped, so this is not by itself evidence of cross-tenant IDOR. The actual question is whether the subscription/role contract is meant to gate only creation or also update/activation/running workflows.

**Required change:** write the entitlement contract first, then add policy tests for create/update/activate/deactivate/delete and the ongoing worker. Do not blindly copy the create policy if the policy's quota semantics are only valid for creation.

**Evidence:** [AutopostController](../../apps/backend/src/api/routes/autopost.controller.ts), [provider/entitlement audit](PUBLISHING_AND_PROVIDER_AUDIT.md#pub-auth-01).

## Positive findings to preserve

- The post save path performs server-side integration validation and now checks supplied IDs/groups at the repository boundary with organization-scoped filters. This reduces risk from trusting client-supplied IDs.
- The post workflow already has meaningful ambiguous-outcome handling and separates read-only status checks from irreversible publish actions. Expand fault-injection coverage before changing its architecture.
- The RSS/article SSRF defense revalidates redirects, enforces HTTPS, applies timeouts/byte limits, and uses the existing safe dispatcher in the production wrapper. The missing piece is proving that wrapper/validator/dispatcher path with tests and CI.
- Locale logic adds SSR `lang/dir`, normalizes regional tags, provides a fallback, and cleans up the i18next listener. Real browser RTL, responsive and accessibility verification remains open.
- The changed explicit type annotations appear to be compile-oriented rather than new runtime behavior; check them in the pinned full build rather than inferring correctness from source review.

## Release gate snapshot

| Gate | Current assessment |
|---|---|
| GitHub Actions / combined status at latest reviewed head | **OPEN — no successful run/status verified** |
| Full workspace build on exact Node/pnpm pins | **OPEN** |
| SSRF production-validator/dispatcher coverage | **OPEN** |
| Two-organization DB/API tenant-isolation tests | **OPEN** |
| Post workflow dispatch caller contract | **Partially addressed; 6 helper tests pass locally; API/Temporal/CI proof OPEN** |
| Concurrent workflow conflict behavior | **Destructive termination removed; 5 wait-state tests pass locally; in-flight/CAS race OPEN** |
| Autopost dispatch/cancellation observability | **Source mitigation committed; tests and terminate semantics OPEN** |
| Browser RTL/mobile/accessibility review | **OPEN** |
| Live provider capability and approval proof | **OPEN** |
| Production readiness / release approval | **NOT ESTABLISHED** |

## Recommended execution order

1. Add Temporal test-environment and service/API coverage for the new dispatch and schedule-signal behavior.
2. Add Autopost failure-path tests and settle stop confirmation and entitlement semantics.
3. Bring the production SSRF wrapper/validator/dispatcher under tests; run the pinned Node/pnpm toolchain.
4. Add real DB/API two-tenant tests and trace internal mutation/error-storage callers.
5. Consolidate the publishing audits and keep one authoritative status ledger.
6. Run pinned-toolchain CI/full build, then browser RTL/accessibility tests and provider-approved publishing tests.

**Scope limitation:** this follow-up re-fetched the GitHub source and reviewed the committed diffs. The 7 post-dispatch tests, 6 schedule-wait tests, and 5 Autopost-dispatch tests passed locally (18/18 combined) on Node `v22.16.0`; no backend/full workspace build, Temporal test-environment run, successful GitHub Actions run, live penetration test, or provider publish is claimed. Findings describe source behavior, not production incidents.
