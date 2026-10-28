# Publishing Reliability Audit — Preliminary Source Review

**Status:** Preliminary source audit; no provider-side publishing test has been performed by this document.
**Review date:** 2026-10-28
**Branch:** `feature/algeria-product-foundation`
**Purpose:** Map inherited behavior and prioritize evidence-producing tests before changing publishing architecture.

## Evidence rules

- **FACT** means directly visible in the cited source revision.
- **INFERENCE / RISK TO VERIFY** means the code path suggests a risk but exploitability or runtime impact has not been proven.
- **OPEN** means the required call-site trace, runtime test, or provider-side evidence is not yet available.
- Code presence and unit tests do not prove a provider accepted a real post.

## 1. Source surfaces inspected

| Area | Source | Direct observation | Status |
|---|---|---|---|
| API validation and tenant integration lookup | `apps/backend/src/api/routes/posts.controller.ts`; `libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts` | `POST /posts` calls server-side `validatePosts(org.id, ...)`; validation looks up each integration with the current organization ID before checking provider rules. | FACT — code present; endpoint integration test OPEN |
| Post ownership validation | `libraries/nestjs-libraries/src/database/prisma/posts/posts.repository.ts`; `.../posts/post.ownership.filters.ts`; `scripts/test-post-ownership-safety.mjs` | Save path validates supplied post IDs and group against organization-scoped, non-deleted rows; standalone tests cover foreign IDs/groups and duplicate IDs. | FACT — helper tests exist; repository/database integration and all mutation paths OPEN |
| Workflow dispatch | `libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts` (`startWorkflow`) | Checks for running workflows by post search attribute, attempts to terminate them, fails closed if listing/termination fails, skips workflow start for drafts, and starts `postWorkflowV112` with post and organization search attributes. | FACT — code present; concurrency/failure injection tests OPEN |
| Post state model | `libraries/nestjs-libraries/src/database/prisma/schema.prisma` (`State`) | Persisted enum currently contains `QUEUE`, `PUBLISHED`, `ERROR`, and `DRAFT`; no distinct `UNKNOWN`/ambiguous-publication state is present in this enum. | FACT — schema; whether another durable reconciliation mechanism exists is OPEN |
| State persistence | `libraries/nestjs-libraries/src/database/prisma/posts/posts.repository.ts` (`changeState`, `updatePost`) | State update helpers write by post ID; `updatePost` marks a row `PUBLISHED` and stores the provider post ID/URL. | FACT — code present; all callers and their tenant/trust boundaries must be traced before classifying as a defect |
| Workflow dispatch observability | `libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts` (`reportWorkflowDispatchFailure`, `startWorkflow`) | Dispatch errors are logged with operation, queue, post/org IDs and workflow ID, and sent to Sentry without post text/tokens in the structured context. | FACT — code present; alerting/retention configuration OPEN |
| Delete and cancellation | `libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts` (`deletePost`); `.../posts/posts.repository.ts` (`deletePost`) | Delete marks the group deleted, then attempts to find/terminate running Temporal executions. Exceptions in this deletion cancellation path are swallowed. | FACT — exception handling visible; consequence and recovery behavior are OPEN |
| Provider token refresh | `libraries/nestjs-libraries/src/integrations/refresh.integration.service.ts` | Failed refresh marks refresh as needed and informs the user; successful refresh persists updated token data through the integration service. | FACT — code present; provider-specific expiry/revocation cases OPEN |
| Provider exception contract | `libraries/nestjs-libraries/src/integrations/social.abstract.ts` | Defines typed failure cases including `RefreshToken`, `Disconnect`, `PublishedWithError`, and `BadBody`; documents pending-post status checks and finalization. | FACT — abstractions exist; actual provider implementations and workflow mapping OPEN |
| Error persistence | `libraries/nestjs-libraries/src/database/prisma/posts/posts.repository.ts` (`changeState`) | Error handling may persist serialized error details and a supplied body into the error table. | FACT — persistence path exists; confirm upstream sanitization and data retention/redaction before production use |

## 2. Preliminary findings

### PR-AUD-01 — Deletion cancellation failure is not observable

**Evidence:** `PostsService.deletePost` catches and ignores errors around listing and terminating Temporal workflows. The post group is marked deleted before cancellation is attempted.

**Risk to verify:** a workflow may remain running or cancellation may fail without a durable operator signal. A still-running workflow could interact with a post that users believe has been deleted.

**Required checks:**
- Inject list, describe, and terminate failures.
- Verify whether the workflow checks deletion/current state before each irreversible provider action.
- Verify cancellation semantics for a workflow already in a provider request.
- Define a safe user-visible deletion result and an operator-visible reconciliation record.
- Do not silently report successful cancellation unless it is confirmed.

**Acceptance:** failed cancellation produces a structured log/metric/alert and a durable recoverable outcome; tests prove that deletion does not trigger an unsafe second publish.

**Status:** EXPERIMENT NOT RUN — no production defect claim yet.

### PR-AUD-02 — Ambiguous external publish outcome needs explicit verification

**Evidence:** the persisted `State` enum contains only `QUEUE`, `PUBLISHED`, `ERROR`, and `DRAFT`. The provider abstraction has `PublishedWithError` and pending-status contracts, which are useful existing mechanisms.

**Risk to verify:** the current persisted states may not distinguish “provider accepted the post but the response/worker outcome is unknown” from an ordinary failure in every path. Adding a new state is not the default solution; first inspect the Temporal workflow, provider implementations, reconciliation routines, and stored release IDs.

**Required checks:**
- Trace provider request → response parsing → workflow result → repository state write for representative providers.
- Simulate timeout before request, timeout after provider acceptance, worker restart, and follow-up mutation failure.
- Prove no blind retry occurs after a potentially successful external side effect.
- If the current model cannot represent the outcome, propose the smallest compatible durable representation and migration plan.

**Acceptance:** each tested failure is either provider-confirmed success, safe retry, terminal failure, or explicitly ambiguous with reconciliation; none is silently mislabeled as published.

**Status:** OPEN — workflow and provider trace required.

### PR-AUD-03 — Tenant scope of internal mutation helpers needs call-site proof

**Evidence:** repository methods `changeState(id, ...)` and `updatePost(id, ...)` update by post ID; `getPost(..., orgId?)` accepts an optional organization ID. Other reviewed save paths do use organization-scoped filters, and a post-ownership helper test suite exists.

**Risk to verify:** helpers with optional tenant scoping can be safe for trusted worker-only callers but unsafe if reachable from a user-controlled path without prior authorization. Method signatures alone do not establish a vulnerability.

**Required checks:**
- Enumerate every call site for these methods and identify the trust boundary.
- Confirm user/API paths enforce organization scope before invoking them.
- Add integration tests for cross-organization IDs against every externally reachable mutation.
- Prefer required organization scope in methods used by request paths; keep any trusted system-level operation explicit.

**Acceptance:** every user-reachable operation proves cross-tenant read/write denial with tests against the service/repository boundary.

**Status:** OPEN — call-site audit required.

### PR-AUD-04 — Persisted provider errors require redaction review

**Evidence:** repository code can serialize error objects and supplied bodies into post/error records. The workflow-dispatch logger separately demonstrates a safer pattern that avoids attaching post content and tokens.

**Risk to verify:** provider response bodies or thrown objects may contain secrets, identifiers, or content not suitable for long-term logs.

**Required checks:**
- Trace how `BadBody`, `Disconnect`, `RefreshToken`, and `PublishedWithError` are mapped to persisted errors.
- Confirm token, authorization header, secret, and sensitive-content redaction.
- Bound error size and retention; ensure user-facing errors are curated separately from operator diagnostics.

**Acceptance:** automated redaction tests cover representative provider error payloads; raw credentials never reach logs or durable error records.

**Status:** OPEN — end-to-end error path not yet traced.

## 3. Immediate implementation plan

1. Locate and trace `postWorkflowV112`, its activities, and representative provider implementations before changing the state model.
2. Add tests for deletion/cancellation failure and dispatch concurrency using the repository's existing Temporal test approach.
3. Trace all callers of `changeState`, `updatePost`, `getPost`, and `getErrorsByPostIds`; turn any confirmed authorization gap into a minimal fix plus regression test.
4. Audit provider error redaction and add tests before changing log formats.
5. Only after those results, decide whether a schema change or new reconciliation worker is necessary.

## 4. Not yet verified

- No live social provider account or provider-approved test publish was used.
- No claim is made that duplicate publication is occurring.
- No claim is made that cross-tenant access is exploitable.
- No full Temporal workflow/provider adapter trace has been completed.
- No CI run is claimed by this audit.
- Production readiness remains OPEN.

## 5. Evidence links

- [Posts controller](../../apps/backend/src/api/routes/posts.controller.ts)
- [Posts service](../../libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts)
- [Posts repository](../../libraries/nestjs-libraries/src/database/prisma/posts/posts.repository.ts)
- [Post ownership filters](../../libraries/nestjs-libraries/src/database/prisma/posts/post.ownership.filters.ts)
- [Post ownership tests](../../scripts/test-post-ownership-safety.mjs)
- [Social provider abstraction](../../libraries/nestjs-libraries/src/integrations/social.abstract.ts)
- [Token refresh service](../../libraries/nestjs-libraries/src/integrations/refresh.integration.service.ts)
- [Prisma schema](../../libraries/nestjs-libraries/src/database/prisma/schema.prisma)
