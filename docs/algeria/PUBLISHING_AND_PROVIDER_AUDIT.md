# Publishing Reliability and Provider Capability Audit

**Review date:** 2026-10-28  
**Branch:** `feature/algeria-product-foundation`  
**Status:** Partial source audit. Findings below distinguish observed source behavior from behavior not yet exercised end-to-end.

## Scope and evidence limits

This pass inspected the feed-based autopost path, the Temporal publishing workflow, provider contracts, post persistence paths, and the subscription policy guard. It did not use live social accounts or execute real provider publishes. Provider approval, account-type permissions, and real-world outcomes remain **OPEN**. Source inspection proves that code exists, not that an external platform accepts an operation.

For reproducibility, relevant reviewed source blob SHAs are: `AutopostService` after hardening `4d366943096084c164cbf4592c0aef938937809d`; SSRF-safe text fetch `7adc28c0a0499d9baa61e47d4a08ea3229ea2326`; post workflow v1.1.2 `f2976a2645c1d66ae0f9b512244d7e93edf20877`; `PostsService` `6756ae653cc52dca7e03d5b997c7549e1b2782b5`; `PostsRepository` `c2830afdd0c3cdbd3ce78377b7066562fc58de06`; provider interface `261b84e25e623b8ca63c50b4cf0f2569d8a62b7b`.

## Findings

### PUB-SEC-01 — Server-side RSS/article fetch needed redirect-safe SSRF controls

**Status:** Mitigation implemented in this branch; automated execution and CI confirmation remain OPEN.  
**Priority:** P0 security gate.

Before the change, `AutopostService.loadXML()` delegated fetching to `rss-parser.parseURL(url)`, while `loadUrl()` used plain `fetch(url)` on a link originating in RSS content. The configured feed URL is validated by `AutopostDto`, but an RSS item link is separate external input. Validation of the initial URL alone does not make redirect destinations safe.

The new `fetchSafePublicHttpsText()` helper:
- validates every URL hop as public HTTPS;
- follows redirects manually and limits redirect count;
- uses the existing pinned-DNS SSRF-safe Undici dispatcher at connection time;
- rejects embedded URL credentials;
- sets a per-request timeout and caps streamed response bytes.

Both RSS feed retrieval and article-link retrieval now use this helper. Empty feeds or feeds without a usable item link are reported as unsuccessful rather than treated as a valid latest item.

**Change/evidence paths:** [safe public HTTPS fetch helper](../../libraries/nestjs-libraries/src/dtos/webhooks/safe.public.https.fetch.ts), [URL safety regression tests](../../scripts/test-safe-public-fetch.mjs), [autopost service](../../libraries/nestjs-libraries/src/database/prisma/autopost/autopost.service.ts), [autopost DTO validation](../../libraries/nestjs-libraries/src/dtos/autopost/autopost.dto.ts), [existing SSRF dispatcher](../../libraries/nestjs-libraries/src/dtos/webhooks/ssrf.safe.dispatcher.ts).

**Remaining acceptance gates:**
- [x] Apply safe fetch to both configured RSS feeds and RSS item links.
- [x] Add regression checks proving unsafe URLs are rejected before the injected transport is called.
- [ ] Execute `pnpm run test:url-safety` under the repository's pinned Node/pnpm toolchain.
- [ ] Confirm the full CI build passes.
- [ ] Add a deterministic test proving redirects to private IPs, non-HTTPS schemes, and redirect loops are rejected without issuing the second request.

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

### PUB-REL-02 — Workflow startup failures are swallowed instead of being operationally visible

**Status:** OPEN.  
**Priority:** P1 reliability/operations.

`PostsService.startWorkflow()` catches failures while listing/terminating prior workflows and while starting `postWorkflowV112`. These paths currently suppress the error. The caller in `createPost()` also attaches an empty catch. A database post can therefore be persisted as queued while workflow startup has failed, without an immediate actionable signal. The existing missing-post workflow may later recover some cases, but delayed recovery is not a substitute for observability.

**Required next work:**
- Add structured failure reporting (workflow ID, post ID, organization ID, operation, and safe error classification; never include credentials or post content).
- Measure failed workflow starts and queued-post age.
- Add a reconciliation test proving queued posts with no live workflow are detected and safely restarted.
- Define the user-visible behavior when dispatch is unavailable; do not claim a post is actively scheduled unless durable workflow handoff or reconciliation is evidenced.

**Source paths:** [PostsService](../../libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts), [missing-post workflow](../../apps/orchestrator/src/workflows/missing.post.workflow.ts).

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

1. Confirm the new safe-fetch code and regression suite under pinned Node.js `22.23.4` / pnpm `10.6.1`.
2. Add deterministic redirect and payload-bound tests; preserve the default SSRF protection.
3. Fix workflow-start observability and prove missing-workflow reconciliation.
4. Build the dated provider capability evidence matrix for launch-priority channels. Do not audit all inherited channels to the same depth before agreeing which channels are in the first release.
5. Run tenant isolation and entitlement tests against a real test database.

## Release gate

This audit is **not** a production-readiness certificate. No live provider publishing, external app approval, production deployment, or full tenant-isolation test is claimed here. Keep those gates OPEN until linked evidence exists.
