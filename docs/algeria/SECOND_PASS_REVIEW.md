# Second-Pass Engineering Review — Postiz Algeria

**Review date:** 2026-10-28  
**Reviewed PR head:** `df6ba0f009720db8c2f8af1a5f42d39eb3b38cd5`  
**Branch:** `feature/algeria-product-foundation`  
**PR:** [#1](https://github.com/Loofy147/postiz-algeria/pull/1)  
**Review type:** Read-only source/diff/CI metadata review. This is not a runtime penetration test or production-readiness certification.

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

**Verification completed:** six standalone dispatch-helper regression tests pass locally on Node `v22.16.0`. They cover queue dispatch, reuse/signaling, draft with and without a running workflow, and list/start/signal failures.

**Remaining gates**
- [ ] Add service-level tests proving the API response contract for create, status change and date change.
- [ ] Verify actual Temporal client behavior for `USE_EXISTING` followed by signal, including the concurrent-start case.
- [ ] Verify Sentry delivery and the hourly missing-workflow reconciliation path.
- [ ] Run the tests and backend/full workspace build under pinned Node `22.23.4` / pnpm `10.6.1` in GitHub Actions.

**Evidence:** [PostsService](../../libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts), [dispatch helper](../../libraries/nestjs-libraries/src/database/prisma/posts/post-workflow.dispatch.ts), [dispatch tests](../../scripts/test-post-workflow-dispatch.mjs), [CI workflow](../../.github/workflows/build.yml).
### REVIEW-02 — Destructive workflow conflict handling replaced; in-flight mutation remains a boundary

**Priority:** P1 — publication integrity  
**Status:** DESTRUCTIVE RESTART PATH REMOVED; SCHEDULE-WAIT REGRESSION TESTS PASS LOCALLY; FULL CONCURRENCY PROOF OPEN.

The post dispatcher no longer terminates the previously running execution and no longer starts with `TERMINATE_EXISTING`. A queued post uses `USE_EXISTING`, then signals `poke`. A running scheduled workflow now uses Temporal `condition()` through a testable wait state machine, re-reads the post after a signal, and exits without changing a draft back to `ERROR`. Before the first provider mutation, it rechecks the latest queued state/date and refreshes the persisted post snapshot if a signal arrived.

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

`AutopostService.processCron()` now checks the Temporal client instead of relying on optional chaining. Start and stop errors produce structured Logger/Sentry events with organization, autopost and workflow IDs, without embedding feed content or credentials. Create/update, active-toggle and delete responses include a `workflowDispatch` status: `started_or_reused`, `stop_requested`, or `unconfirmed`.

The decision/result contract is isolated in `autopost.workflow.dispatch.ts`. Four standalone tests pass locally on Node `v22.16.0`, covering activation, deactivation, and failure reporting for both paths.

**Remaining gates**
- [ ] Add service-level tests for missing Temporal client, stable workflow ID, and Sentry context.
- [ ] Confirm whether `terminateWorkflow()` distinguishes “no workflow existed” from “termination requested”; do not overstate `stop_requested`.
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
### REVIEW-06 — Deletion cancellation failure status is now sticky

**Priority:** P2 — edge-case status accuracy  
**Status:** SOURCE MITIGATION COMMITTED; FAILURE-INJECTION TEST OPEN.

The successful termination path now preserves an earlier `unconfirmed` result rather than overwriting it with `requested` when a later matching execution terminates successfully. This fixes the result-aggregation defect identified in the first review.

**Remaining gate:** add a test where one workflow termination fails and another succeeds. A termination request still does not prove that an external provider request already in flight was reversed.

**Evidence:** [PostsService deletion path](../../libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts).
### REVIEW-07 — Publishing audit documents disagree about current behavior
**Priority:** P2 — audit correctness  
**Status:** Confirmed documentation defect.

There are two overlapping publishing audits: `PUBLISHING_AND_PROVIDER_AUDIT.md` and `PUBLISHING_RELIABILITY_AUDIT.md`. The former is linked by the README and gap register as the main audit; the roadmap links both. The second-pass audit file still says deletion cancellation exceptions “are swallowed” in its source-surface table, then later says the cancellation reporting mitigation has been committed. Its immediate implementation plan also repeats steps and numbering. Those contradictions make it unclear which status is authoritative.

**Required change:** designate one canonical audit, link the second as a dated supplement or merge its unique findings, remove stale claims and duplicate checklist entries, and update the dispatch status wording after REVIEW-01 is fixed. Never mark a finding closed from a commit message alone.

**Evidence:** [primary audit](PUBLISHING_AND_PROVIDER_AUDIT.md), [preliminary audit](PUBLISHING_RELIABILITY_AUDIT.md), [README](README.md), [roadmap](ROADMAP.md), [gap register](ADD_ONS_AND_GAP_REGISTER.md).

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

**Scope limitation:** this follow-up re-fetched the GitHub source and reviewed the committed diffs. The 6 post-dispatch tests, 5 schedule-wait tests, and 4 Autopost-dispatch tests passed locally on Node `v22.16.0`; no backend/full workspace build, Temporal test-environment run, successful GitHub Actions run, live penetration test, or provider publish is claimed. Findings describe source behavior, not production incidents.
