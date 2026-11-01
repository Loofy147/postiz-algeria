# Publishing Reliability Audit — Supplementary Source Review

**Status:** Dated supplementary evidence note. The canonical publishing audit is [PUBLISHING_AND_PROVIDER_AUDIT.md](PUBLISHING_AND_PROVIDER_AUDIT.md). No provider-side publishing test has been performed by this document.
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
| Delete and workflow wake-up | `libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts` (`deletePost`); `apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.1.2.ts` | Delete marks the group deleted, then signals the stable root execution and visible matching executions with `poke`; the response distinguishes `not_required`, `signalled`, and `unconfirmed`. The workflow rechecks row existence before comments and downstream actions. | FACT — signal path present; Temporal/in-flight provider fault-injection tests OPEN |
| Provider token refresh | `libraries/nestjs-libraries/src/integrations/refresh.integration.service.ts` | Failed refresh marks refresh as needed and informs the user; successful refresh persists updated token data through the integration service. | FACT — code present; provider-specific expiry/revocation cases OPEN |
| Provider exception contract | `libraries/nestjs-libraries/src/integrations/social.abstract.ts` | Defines typed failure cases including `RefreshToken`, `Disconnect`, `PublishedWithError`, and `BadBody`; documents pending-post status checks and finalization. | FACT — abstractions exist; actual provider implementations and workflow mapping OPEN |
| Error persistence | `libraries/nestjs-libraries/src/database/prisma/posts/posts.repository.ts` (`changeState`) | Error handling may persist serialized error details and a supplied body into the error table. | FACT — persistence path exists; confirm upstream sanitization and data retention/redaction before production use |

## 1A. Representative provider adapter trace

A read-only source inspection of four adapters found they use the pending/status/finalization contract, but this is **source-level evidence only**:

| Provider adapter | Observed implementation | Remaining verification |
|---|---|---|
| Instagram — `libraries/nestjs-libraries/src/integrations/social/instagram.provider.ts` | `postPending`, read-only container status checks, and `finalizePost`; source comments describe resuming when a prior finalization published but died before reporting. | Test single media, carousel, story, timeout after publish, token rejection, and account/app approval prerequisites. |
| TikTok — `libraries/nestjs-libraries/src/integrations/social/tiktok.provider.ts` | `postPending` returns a publish ID; `checkPostStatus` maps pending, complete, inbox/draft-like and failed states; transient status-check errors are kept pending. | Validate every status mapping against current official API docs and test account-type/audit restrictions and timeout recovery. |
| YouTube — `libraries/nestjs-libraries/src/integrations/social/youtube.provider.ts` | Uses resumable upload state, checks upload offset/status, and resumes remaining bytes in `finalizePost`. | Test interrupted chunks, expired upload sessions, thumbnail failure after video acceptance, quota and privacy settings. |
| Facebook — `libraries/nestjs-libraries/src/integrations/social/facebook.provider.ts` | Implements a pending contract for media/story publishing, checks media readiness, and uses an `attempting/confirmed/publishedCount` handshake before finalization. | Fault-inject each handshake boundary and verify no duplicate publication; verify scopes and eligible account types. |

The source supports the conclusion that a generalized pending workflow and provider-specific recovery mechanisms already exist. **Do not replace these with a new publishing engine.** Focus next on regression coverage for failure boundaries, provider-specific contract conformance, deletion/cancellation, and observability.

Additional source links:
- [Instagram adapter](../../libraries/nestjs-libraries/src/integrations/social/instagram.provider.ts)
- [TikTok adapter](../../libraries/nestjs-libraries/src/integrations/social/tiktok.provider.ts)
- [YouTube adapter](../../libraries/nestjs-libraries/src/integrations/social/youtube.provider.ts)
- [Facebook adapter](../../libraries/nestjs-libraries/src/integrations/social/facebook.provider.ts)

## 2. Preliminary findings

### PR-AUD-01 — Deletion must wake workflows without terminating provider work

**Initial evidence:** the former `PostsService.deletePost` caught and ignored errors around listing and terminating Temporal workflows. The database group was marked deleted before cancellation was attempted.

**Changes now committed to this branch:**
- [x] Report workflow list/signal failures through the existing structured Logger/Sentry helper.
- [x] Add the stable root workflow ID directly to the signal targets; do not depend only on an eventually consistent visibility query.
- [x] Signal `poke` instead of terminating a workflow that may be inside a provider request.
- [x] Return `workflowSignal: 'not_required' | 'signalled' | 'unconfirmed'`, not a claim that remote publication was cancelled.
- [x] After a provider activity returns, recheck that the root post still exists before sending later comments, webhooks or follow-up plug/repeat actions.

**Residual risk to verify:** a provider request already in flight may still complete after the user deletes the post. The workflow now preserves that outcome and stops subsequent actions where it observes the deleted row, but a narrow race remains between the last existence check and a new external provider request. The visibility query is eventually consistent; directly signalling the stable root mitigates, but does not replace, Temporal integration tests.

**Required checks:**
- Inject Temporal client unavailable, visibility-list failure, root workflow missing, multiple active executions and signal failure.
- Inject deletion while a main provider request is in flight; verify the provider result is recorded and no later comments/follow-up actions run.
- Confirm the frontend presents `signalled` as a workflow wake-up, not proof that a provider-side effect was undone.
- Decide whether a durable publish-attempt lease/CAS is necessary to close the final check-to-request race.

**Acceptance:** deletion does not terminate an execution mid-provider request; workflow wake-up failures are visible as `unconfirmed`; accepted provider outcomes are retained; no subsequent external action begins after the workflow observes the deleted root.

**Status:** SOURCE MITIGATION COMMITTED; automated Temporal and in-flight provider tests remain OPEN.

### PR-AUD-02 — Ambiguous external publish outcome needs explicit verification

**Evidence:** the persisted `State` enum contains only `QUEUE`, `PUBLISHED`, `ERROR`, and `DRAFT`. The provider abstraction has `PublishedWithError` and pending-status contracts, which are useful existing mechanisms.

**Follow-up source trace:** `apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.1.2.ts` explicitly classifies activity timeouts as unknown when the activity had started, has a `markUnconfirmed` path that writes `ERROR` plus a warning telling the user to check the provider account before reposting, and treats pending posts through read-only `checkPostStatus` plus `finalizePost`. `apps/orchestrator/src/activities/post.activity.ts` documents that once the provider accepted the post, follow-up streak/notification failures must not trigger another publish. This is a meaningful existing safeguard.

**Remaining risk to verify:** the durable database enum still has no separate ambiguous state; ambiguity is currently represented through `ERROR` plus error/notification content. Confirm that this remains distinguishable and queryable by operators and that every provider-specific post path obeys the no-blind-retry contract. Do not add a new state until these checks show the existing representation is insufficient.

**Required checks:**
- Trace provider request → response parsing → workflow result → repository state write for representative providers.
- Simulate timeout before request, timeout after provider acceptance, worker restart, and follow-up mutation failure.
- Prove no blind retry occurs after a potentially successful external side effect.
- If the current model cannot represent the outcome, propose the smallest compatible durable representation and migration plan.

**Acceptance:** each tested failure is either provider-confirmed success, safe retry, terminal failure, or explicitly ambiguous with reconciliation; none is silently mislabeled as published.

**Status:** PARTIALLY INVESTIGATED — workflow-level safeguard found; provider-by-provider coverage, operator queryability, and fault-injection tests remain OPEN.

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

1. Add Temporal test-environment coverage for the dispatch contract, concurrent start/reschedule, and a provider activity already in flight.
2. Add failure-injection coverage for delete listing/termination and verify the `unconfirmed` result remains sticky across multiple executions.
3. Trace every caller of `changeState`, `updatePost`, `getPost`, and `getErrorsByPostIds`; test cross-tenant API paths against two real organizations.
4. Verify persisted provider error redaction and retention.
5. Only after those results, decide whether a database-level publishing-attempt/lease or a durable reconciliation queue is necessary.

## 4. Not yet verified

- No live social provider account or provider-approved test publish was used.
- No claim is made that duplicate publication is occurring.
- No claim is made that cross-tenant access is exploitable.
- Temporal workflow and activity code have been inspected, but the provider adapter trace and fault-injection tests are incomplete.
- No CI run is claimed by this audit.
- Production readiness remains OPEN.

## 5. Evidence links

- [Posts controller](../../apps/backend/src/api/routes/posts.controller.ts)
- [Posts service](../../libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts)
- [Posts repository](../../libraries/nestjs-libraries/src/database/prisma/posts/posts.repository.ts)
- [Post ownership filters](../../libraries/nestjs-libraries/src/database/prisma/posts/post.ownership.filters.ts)
- [Post ownership tests](../../scripts/test-post-ownership-safety.mjs)
- [Temporal post workflow v1.1.2](../../apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.1.2.ts)
- [Post activities](../../apps/orchestrator/src/activities/post.activity.ts)
- [Social provider abstraction](../../libraries/nestjs-libraries/src/integrations/social.abstract.ts)
- [Token refresh service](../../libraries/nestjs-libraries/src/integrations/refresh.integration.service.ts)
- [Instagram adapter](../../libraries/nestjs-libraries/src/integrations/social/instagram.provider.ts)
- [TikTok adapter](../../libraries/nestjs-libraries/src/integrations/social/tiktok.provider.ts)
- [YouTube adapter](../../libraries/nestjs-libraries/src/integrations/social/youtube.provider.ts)
- [Facebook adapter](../../libraries/nestjs-libraries/src/integrations/social/facebook.provider.ts)
- [Prisma schema](../../libraries/nestjs-libraries/src/database/prisma/schema.prisma)
