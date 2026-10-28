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

### REVIEW-01 — Workflow dispatch failure can still be returned as success
**Priority:** P1 — reliability / user-visible correctness  
**Status:** Source-confirmed behavior; runtime impact not measured.

In `PostsService.startWorkflow()`, the failed workflow-list and failed termination branches call the reporting helper and then `return false`. They do not throw. The callers in `createPost()`, `changePostStatus()`, and `changeDate()` handle rejected promises but do not consistently inspect a `false` result. For example, the status-change path can return `{ id, state }` after dispatch returned false. The post has already been persisted, but the API response does not reliably distinguish “saved but workflow not started” from success.

This contradicts the broad wording in the gap register that dispatch errors are propagated to each caller. Logging/Sentry is useful, but does not repair the caller contract.

**Required change**
- Make dispatch results explicit and mandatory to handle, preferably a typed result/exception distinguishing `started`, `draft-no-dispatch`, and `not-started`.
- Ensure each caller reports a failure to the user/API or returns a documented pending/reconciliation state. Avoid duplicate Sentry events where the service and caller both report the same thrown error.
- Add tests for missing Temporal client, workflow-list failure, prior-run termination failure, workflow-start failure, and a successful start. Assert the actual caller response as well as telemetry.

**Evidence:** [PostsService](../../libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts) (`startWorkflow`, `createPost`, `changePostStatus`, `changeDate`); [gap register](ADD_ONS_AND_GAP_REGISTER.md#ga-16).

### REVIEW-02 — `TERMINATE_EXISTING` leaves a race after the “fail closed” check
**Priority:** P1 — publication integrity  
**Status:** Concurrency risk inferred from source; no duplicate publish is alleged.

The service first lists and terminates running workflows for a post, then calls Temporal `workflow.start` with stable ID `post_<postId>` and `workflowIdConflictPolicy: 'TERMINATE_EXISTING'`. A concurrent request can start a workflow after the preflight enumeration but before this start. The conflict policy can then terminate that newly running workflow. The preflight protects only executions it actually observed; it is not an atomic lock.

This is particularly sensitive because the code's own comments correctly identify that terminating a workflow during an in-flight provider mutation can leave the external outcome ambiguous.

**Required change**
- Remove automatic termination as a last-moment conflict policy unless the provider workflow can prove it is safe.
- Choose conflict behavior explicitly based on the desired semantics (e.g. fail on an unexpected conflict or attach to an existing execution), then implement a safe reschedule/restart protocol.
- Add concurrent-start/reschedule/delete fault-injection tests that assert one active workflow per post and no blind republish.

**Evidence:** [PostsService](../../libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts) (`startWorkflow`); [workflow v1.1.2](../../apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.1.2.ts).

### REVIEW-03 — Autopost workflow failures are still swallowed
**Priority:** P1 — automation reliability  
**Status:** Source-confirmed behavior; product impact needs runtime verification.

In `AutopostService.processCron()`, an absent Temporal client is hidden by optional chaining on `getRawClient()?.workflow.start(...)`, which resolves to `undefined`. Start and termination exceptions are caught and reduced to `false` without structured logging, Sentry reporting, or propagation. `createAutopost()`, `changeActive()`, and `deleteAutopost()` then return persisted data even when workflow orchestration failed. In particular, deletion/deactivation updates the database before termination is confirmed.

The improvements to the post workflow dispatch path have not been applied consistently to autopost orchestration.

**Required change**
- Use an explicit dispatch result/exception for absent client, failed start, and failed termination; preserve a useful operator event with safe context.
- Do not return an unqualified success when a requested activation or cancellation was not confirmed.
- Add tests for missing client, start failure, termination failure, idempotent repeated activation/deactivation, and recovery of active records without a running workflow.

**Evidence:** [AutopostService](../../libraries/nestjs-libraries/src/database/prisma/autopost/autopost.service.ts); [AutopostController](../../apps/backend/src/api/routes/autopost.controller.ts).

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

### REVIEW-05 — Runtime pin mismatch: Volta still selects Node 20.17.0
**Priority:** P2 — reproducibility  
**Status:** Confirmed configuration inconsistency.

Root `package.json` declares `engines.node = 22.23.4` and `packageManager = pnpm@10.6.1`; the GitHub Actions workflow now also pins Node 22.23.4 and pnpm 10.6.1. But `package.json` still has `volta.node = 20.17.0`. Developers using Volta may therefore get a different Node runtime from CI and the declared engine.

**Required change:** update the Volta pin to 22.23.4 or remove it if intentionally unused; verify all documented local/CI commands under exactly Node 22.23.4 and pnpm 10.6.1. Do not close the gate based on runs under 22.22.1.

**Evidence:** [package.json](../../package.json), [build workflow](../../.github/workflows/build.yml).

### REVIEW-06 — Deletion cancellation status can be overwritten after a failure
**Priority:** P2 — edge-case state accuracy  
**Status:** Conditional behavior confirmed in source; relevance depends on whether multiple executions can match.

In `PostsService.deletePost()`, a failure handling one workflow sets `workflowCancellation = 'unconfirmed'`. If the loop then processes another matching execution and successfully terminates it, it overwrites the value with `'requested'`, hiding the earlier failure. The normal workflow ID design suggests one current workflow per post, but the enumeration loop allows multiple matches and legacy/overlap conditions have not been ruled out.

**Required change:** make `unconfirmed` sticky for the entire operation (or return per-workflow outcomes), and add a test where one termination fails and another succeeds. A cancellation request must not be described as proof that an already-running provider HTTP request was reversed.

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
| GitHub Actions / combined status at reviewed head | **OPEN — zero runs/statuses returned** |
| Full workspace build on exact Node/pnpm pins | **OPEN** |
| SSRF production-validator/dispatcher coverage | **OPEN** |
| Two-organization DB/API tenant-isolation tests | **OPEN** |
| Post workflow dispatch caller contract | **Needs correction and tests** |
| Concurrent workflow conflict behavior | **Needs correction/design decision and tests** |
| Autopost dispatch/cancellation observability | **Needs correction and tests** |
| Browser RTL/mobile/accessibility review | **OPEN** |
| Live provider capability and approval proof | **OPEN** |
| Production readiness / release approval | **NOT ESTABLISHED** |

## Recommended execution order

1. Fix the post workflow dispatch result contract and the `TERMINATE_EXISTING` race; add deterministic tests before widening feature scope.
2. Apply equivalent reporting/recovery semantics to autopost orchestration and define entitlement expectations.
3. Bring the production SSRF wrapper/validator/dispatcher under tests; align Volta/Node pins.
4. Add real DB/API two-tenant tests and trace internal mutation/error-storage callers.
5. Consolidate the publishing audits and keep one status ledger.
6. Run pinned-toolchain CI/full build, then browser RTL/accessibility tests and provider-approved publishing tests.

**Scope limitation:** this pass re-fetched the GitHub PR, changed-file list, relevant source, diff patches, and CI/status metadata. It did not execute a fresh local build, run a live penetration test, or publish to a provider account. Findings labeled as source-confirmed are claims about code behavior, not observed production incidents.
