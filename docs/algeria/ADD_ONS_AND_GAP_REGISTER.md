# Add-ons and Gap Register — Postiz Algeria

**Status:** Proposed specification and audit queue; most items below are OPEN, not implemented or provider-verified.  
**Review date:** 2026-10-28  
**Working branch:** `feature/algeria-product-foundation`  
**Rule:** Audit inherited behavior before creating a replacement subsystem. Presence of a route, UI component or dependency is not proof of a working end-to-end feature.

**Latest audit:** [Publishing reliability and provider capability audit](PUBLISHING_AND_PROVIDER_AUDIT.md). RSS/article SSRF hardening is implemented in source, but regression execution and CI remain OPEN.

## 1. Executive decision

The fork should become an Algeria-first, mobile-usable social publishing workspace by extending the inherited Postiz platform. Do not attempt a wholesale rewrite or add competing scheduler, analytics, team, billing or AI frameworks without evidence that the current mechanism fails its acceptance criteria.

The first delivery sequence is:

1. Align CI with the repository's declared runtime and execute the localization regression suite in CI.
2. Validate Arabic RTL in a real browser, including mixed-script content, mobile layout and accessibility.
3. Validate the RSS/article SSRF fix, then close the open publishing handoff and provider-capability findings in the [source-backed audit](PUBLISHING_AND_PROVIDER_AUDIT.md).
4. Run tenant-isolation/security tests and close critical findings.
5. Implement only the missing pieces exposed by those audits.
6. Defer production billing and any claim of universal auto-publishing until external prerequisites are evidenced.

## 2. Inherited source surfaces — audit before replacing

The following source surfaces exist on the reviewed feature branch. This table asserts code presence only, not production correctness.

| Concern | Existing source surface | Required next step |
|---|---|---|
| Calendar, composer and channel-specific editor | `apps/frontend/src/app/(app)/(site)/launches/`, `apps/frontend/src/components/new-launch/providers/` | Trace draft → validation → schedule → worker → provider result for priority channel/media pairs. |
| Media library and upload routes | `apps/frontend/src/app/(app)/(site)/media/`, `apps/backend/src/api/routes/media.controller.ts` | Test upload validation, mobile interruption, resume behavior, storage limits and access controls. |
| Analytics | `apps/frontend/src/app/(app)/(site)/analytics/`, `apps/backend/src/api/routes/analytics.controller.ts` | Inspect source metrics, fetch cadence, missing values, stale data and export options. |
| Connections and public integration API | `apps/backend/src/api/routes/integrations.controller.ts`, `apps/backend/src/public-api/routes/v1/public.integrations.controller.ts` | Audit permissions, provider identity, token lifecycle and disconnect/revoke behavior. |
| Publishing and automation routes | `apps/backend/src/api/routes/posts.controller.ts`, `apps/backend/src/api/routes/autopost.controller.ts` | Map state transitions, retries, idempotency and reconciliation before adding new workers. |
| AI/copilot, agent-oriented and extension surfaces | `apps/backend/src/api/routes/copilot.controller.ts`, `apps/frontend/src/app/(app)/(site)/agents/`, `apps/extension/` | Verify tenant scoping, user approval boundaries, quotas, timeouts and recoverability before adding more agents. |
| Billing/payment | `apps/frontend/src/app/(app)/(site)/billing/`, `apps/backend/src/api/routes/billing.controller.ts`, `apps/backend/src/api/routes/payment.controller.ts`, `apps/backend/src/api/routes/stripe.controller.ts` | Determine what is actually wired; keep paid checkout off until local eligibility, reconciliation and lifecycle behavior are verified. |
| Workspaces, roles and connections | Prisma models include `Organization`, `UserOrganization`, `Integration`, `Post`, and user timezone fields | Prove tenant isolation and permission enforcement at the API/data boundary; do not assume the UI is the security boundary. |
| Locale foundation | `libraries/react-shared-libraries/src/translation/`, locale utility and `scripts/test-locale-utils.mjs` | Unit and server-rendered smoke tests pass; browser-level RTL, visual and accessibility checks remain OPEN. |

## 3. Prioritized add-ons and gaps

Status vocabulary: **IMPLEMENTED** = code exists and has the stated evidence; **IMPLEMENTED_UNVERIFIED** = code exists but acceptance proof is incomplete; **OPEN** = not audited or not implemented; **BLOCKED** = external approval, access or legal/commercial dependency prevents completion.

| ID | Priority | Feature / gap | Status | Why it matters |
|---|---|---|---|---|
| GA-01 | P0 | Reproducible CI/runtime and localization regression | IMPLEMENTED IN THIS CHANGESET; CI RUN OPEN | Prevent runtime drift and ensure the locale contract is checked on every PR. |
| GA-02 | P0 | Browser RTL, responsive layout and accessibility gate | OPEN | Server-rendered `lang/dir` does not prove every screen is usable in Arabic. |
| GA-03 | P0 | Reliable publishing state machine and recovery | OPEN — AUDIT FIRST | Incorrect “Published” states, duplicate posts or blind retries are release-blocking reliability defects. |
| GA-04 | P0 | Provider/action/media capability preflight | OPEN — AUDIT FIRST | Provider icons and adapter code do not prove a given account can publish a given content type. |
| GA-15 | P0 | SSRF-safe RSS/article fetch and redirect handling | IMPLEMENTED_UNVERIFIED | Both configured feed URLs and RSS item links trigger server-side outbound requests; redirect targets and response sizes must be controlled. |
| GA-16 | P1 | Publishing workflow dispatch observability and reconciliation | IMPLEMENTED_UNVERIFIED | Silently failed Temporal workflow starts can leave scheduled posts waiting for the periodic recovery sweep without immediate diagnostic evidence. |
| GA-17 | P0 | Post/group tenant ownership on writes | IMPLEMENTED_UNVERIFIED | Client-supplied post and group IDs must not be able to mutate or soft-delete another organization's content. |
| GA-05 | P0 | Tenant isolation, credential protection and audit trail | OPEN — AUDIT FIRST | Cross-client leakage or token exposure is unacceptable for agencies and business users. |
| GA-06 | P1 | Arabic/French content workflow and optional Darija assistance | OPEN — QUALITY REVIEW | UI language, post language, writing style and timezone must stay independent. |
| GA-07 | P1 | Mobile-first media resilience and draft recovery | OPEN — AUDIT FIRST | Upload interruption and weak connectivity must not lose content or cause duplicate publication. |
| GA-08 | P1 | Connection health and actionable recovery UX | OPEN — AUDIT FIRST | Users need to distinguish healthy, expired, revoked, permission-blocked and provider-outage states. |
| GA-09 | P1 | Trustworthy analytics and export contract | OPEN — AUDIT FIRST | Missing or stale metrics must not be presented as zero or compared as if equivalent. |
| GA-10 | P1 | Client/agency review and approval workflow | OPEN — AUDIT FIRST | Verify existing roles and approval mechanisms before adding a parallel workflow. |
| GA-11 | P1 | Algeria-focused template packs and onboarding | PROPOSED — VALIDATE WITH USERS | Improve time-to-first-post through editable bilingual, sector-specific starting points. |
| GA-12 | P1 | API/agent action safety and operational visibility | OPEN — AUDIT FIRST | Automation must remain scoped, reviewable and recoverable; do not duplicate existing APIs or agent surfaces. |
| GA-13 | P2 | Local commercial/payment adapter | BLOCKED UNTIL ELIGIBILITY VERIFIED | Existing billing routes do not prove local merchant eligibility, settlements or subscription support. |
| GA-14 | P1 | Export, deletion, retention and account-disconnection flow | OPEN — AUDIT FIRST | Users and operators need safe data portability and predictable cleanup when leaving the service. |

The priority labels are engineering risk judgments, not evidence that customers have requested these features. The sector template pack and commercial model require user validation.

## 4. Acceptance specifications

### GA-01 — Reproducible CI/runtime

**Change applied in this branch:** align the build workflow with Node.js `22.23.4` declared by the root package and add `pnpm run test:localization` after dependency installation.

Acceptance:
- [x] Workflow runtime matches `package.json` `engines.node` (`22.23.4`).
- [x] Workflow executes the four-test localization regression suite before the build.
- [ ] GitHub Actions run completes successfully on the feature branch; absence of a run is not a pass.
- [ ] Full workspace build is green in CI under the pinned runtime.
- [ ] CI artifacts expose actionable logs and preserve the failure exit code.

Evidence note: Node.js `22.23.4` is a published Node 22 LTS security release dated 2026-10-21. See [official release notes](https://github.com/nodejs/nodejs.org/blob/main/apps/site/pages/en/blog/release/v22.23.4.md) and [GitHub Actions Node.js guidance](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs).

### GA-15 — SSRF-safe RSS and article retrieval

**Finding:** source review found RSS feed retrieval delegated to `rss-parser.parseURL()` and RSS item/article retrieval using plain `fetch(url)`. The configured feed URL is external input, and links/redirects returned by the feed are separate external input. Validation of the initial URL alone does not establish that later redirects stay on public HTTPS destinations.

**Change applied in this branch:**
- [x] Add `fetchSafePublicHttpsText()` using the existing SSRF-safe dispatcher with pinned DNS resolution.
- [x] Revalidate every redirect hop, reject non-public/non-HTTPS destinations and embedded credentials.
- [x] Cap request time and streamed response size (2 MiB for feed XML, 5 MiB for article HTML).
- [x] Route both RSS XML and article HTML retrieval through the shared helper.
- [x] Add a Node test suite asserting unsafe schemes/private literal IPs/localhost/URL credentials are rejected before the injected fetch transport is called.
- [ ] Run the regression suite under pinned Node.js `22.23.4` and pnpm `10.6.1`.
- [ ] Confirm GitHub Actions reports a passing run and the full workspace build succeeds.
- [x] Add deterministic redirect and redirect-loop tests, including proving an unsafe redirect destination is never requested.
- [x] Run `corepack pnpm run test:url-safety` — 6/6 PASS on Node 22.22.1 / pnpm 10.6.1; exact pinned Node 22.23.4 and GitHub Actions remain unverified.

**Current status:** `IMPLEMENTED_UNVERIFIED`. The safety suite is locally verified 6/6 on Node 22.22.1. The repository pins Node 22.23.4; repeat under that exact version and obtain a successful GitHub Actions run before closing the release gate. See [Publishing Reliability and Provider Capability Audit](PUBLISHING_AND_PROVIDER_AUDIT.md#pub-sec-01).

### GA-16 — Publishing workflow dispatch observability and reconciliation

**Finding:** source inspection found empty catches around previous-workflow enumeration/termination and workflow startup. Scheduled post persistence can succeed even if Temporal dispatch does not.

**Change applied in this branch:**
- [x] Report workflow list/termination errors through Sentry and a structured NestJS log record with safe context.
- [x] Throw if the Temporal client is absent; do not silently treat optional-chain dispatch as a successful start.
- [x] Fail closed when running executions cannot be listed or terminated; do not start with `TERMINATE_EXISTING` when the existing publish state is unknown.
- [x] Propagate startup errors to each caller and report with operation, post ID, organization ID, task queue and workflow ID only.
- [ ] Run backend typecheck/build on the pinned toolchain.
- [ ] Add a test for missing Temporal client and failed workflow start.
- [ ] Prove queued posts lacking a running workflow are detected and safely recovered; the existing sweep is hourly, so recovery delay must be measured.
- [ ] Confirm Sentry telemetry delivery in a configured test environment.

**Current status:** `IMPLEMENTED_UNVERIFIED`. Code has been committed, but no backend build, telemetry delivery test, or reconciliation test has been recorded. See [Publishing Reliability and Provider Capability Audit](PUBLISHING_AND_PROVIDER_AUDIT.md#pub-rel-02).

### GA-02 — Browser-level RTL and accessibility

Required test matrix:
- Arabic initial load and language switch; French/English switch back; invalid or regional locale fallback.
- Narrow mobile viewport and desktop viewport on the same priority journeys: login/onboarding, create/edit post, channel preview, schedule/calendar, validation error, media upload, settings and approval if available.
- Mixed Arabic/Latin brand names, URLs, email addresses, handles, hashtags, digits, punctuation and emoji.
- Keyboard-only navigation, logical focus order, visible focus, accessible names, field errors, dialog behavior, zoom and contrast.
- No lost draft, duplicate submission or silently changed authoring language when switching interface locale.

Acceptance:
- Store before/after screenshots or browser test artifacts for each critical route.
- No critical overflow, clipped text, mirrored icon with wrong meaning, unreachable control or direction/hydration mismatch remains.
- Add automated browser coverage only after selecting a test approach compatible with the repository; do not add a second i18n framework.
- Have Arabic- and French-speaking reviewers inspect real content; translation key parity alone is not a quality pass.

### GA-03 — Publishing reliability

Audit the current schema, Temporal/work queues, provider adapters and existing post statuses before proposing migrations. Establish a single, observable lifecycle that semantically distinguishes scheduled, queued, attempting, provider-confirmed success, terminal failure, user action required and ambiguous/unknown outcome. Map these concepts to existing states where possible.

Acceptance:
- A post is never marked published merely because a request was dispatched or a worker completed.
- A timeout after a possible provider-side success becomes an explicit ambiguous outcome and enters safe reconciliation; it does not trigger an unbounded blind retry.
- Retries are bounded, use backoff and are idempotent internally. Use provider idempotency facilities when available; otherwise document residual duplicate risk and reconcile by provider reference where possible.
- Expired tokens, denied permissions, rate limits, validation failures and provider outages produce distinct actionable errors.
- Operator can inspect job/post correlation IDs, retry only when safe, and quarantine repeated failures.
- Fault-injection tests cover pre-request failure, provider rejection, timeout before response, accepted post with lost response, worker restart and duplicate queue delivery.
- Metrics include confirmed publish success by provider/media type, duplicate rate, unknown-outcome count, retries per post and median recovery time.

### GA-04 — Provider capability preflight

Do not infer support from a provider icon, a frontend composer or a successful mock. Maintain an auditable capability record for each advertised provider action, account type and media/content type. Add a new registry/model only if source inspection shows current code cannot represent these constraints safely.

Minimum fields to record:
- provider, API product/version, official documentation URL and adapter/service source path;
- account type, permissions/scopes, app approval/audit state and geography/prerequisites;
- action and media/content type supported, restrictions and required user inputs;
- evidence status (`NOT_AUDITED`, `CODE_FOUND`, `PARTIAL`, `VERIFIED`, `MANUAL_ONLY`, `BLOCKED`);
- last verification date, test environment, sanitized evidence reference and known limitations.

Acceptance:
- Server-side preflight runs before scheduling, not only in the browser.
- Unsupported action/media combinations are blocked with a clear explanation.
- The UI says “Manual action required” when publishing cannot be automated and states when provider approval is missing.
- `VERIFIED` requires an authorized, reproducible provider-side result with scope (account type, media type, action and date). Unit tests alone cannot confer this status.
- Provider-specific limits are periodically revalidated against official docs.

Example external dependency: TikTok states that direct posting requires approved `video.publish` access and that unaudited clients are restricted to private visibility. Therefore a working upload flow is not proof of public publishing. See the [official Direct Post prerequisites](https://developers.tiktok.com/docs/en/content-posting-api-get-started).

### GA-17 — Post and group ownership on writes

**Finding:** a client-supplied post ID reached an upsert whose unique filter used only the ID. Group cleanup also relied on group IDs without the organization filter. A route-level check of the selected integration does not establish ownership of a separately supplied post or group ID.

**Change applied in this branch:**
- [x] Verify all supplied post IDs are unique and resolve to live posts owned by the current organization before a write.
- [x] Require a supplied group to be found within the current organization.
- [x] Add the current organization and live-row condition to the post upsert's extended unique filter.
- [x] Add organization scope to old-group lookup and both soft-delete cleanup queries.
- [x] Add six deterministic unit tests and a dedicated CI test step.
- [x] Backend TypeScript check: PASS with zero diagnostics using a 3 GiB Node heap on local Node 22.22.1 / pnpm 10.6.1; the repository pins Node 22.23.4.
- [ ] Complete the backend production build and confirm no project-wide regressions.
- [ ] Add two-organization database/API tests, including malicious ID/group attempts.
- [ ] Audit all other tenant-owned routes and background jobs; this finding is not evidence of a full tenant audit.

**Local evidence (2026-10-28, commit `84aee2296bfae7a8f543313a6b0374fdee2fc344`):** tenant-safety tests 6/6 PASS; URL-safety tests 6/6 PASS; localization tests 4/4 PASS; backend TypeScript check PASS; `git diff --check` PASS. Node version is 22.22.1, not pinned 22.23.4. **Status:** `IMPLEMENTED_UNVERIFIED`; backend build, database/API integration tests, full CI, and wider tenant audit remain open. See [PUB-SEC-02](PUBLISHING_AND_PROVIDER_AUDIT.md#pub-sec-02).

### GA-05 — Tenant isolation and credentials

Acceptance:
- Enumerate every tenant-owned path for posts, media, analytics, integrations, prompts/brand context, exports, team membership and agent/API operations.
- Tests prove a user in workspace A cannot read, update, delete, publish or export workspace B resources by changing IDs, routes, filters or API payloads.
- Authorization is enforced server-side on every relevant request and background job; hidden UI controls are not counted as enforcement.
- OAuth credentials/secrets are encrypted or stored through an approved secret mechanism, access is least-privilege, logs redact them and disconnection/revocation stops future publishing.
- Permission changes, integration connect/disconnect, approvals and manual retries are auditable.
- Critical findings block release; high findings require explicit owner, mitigation and risk acceptance.

### GA-06 — Arabic/French content studio

Keep three controls independent:
1. **Interface locale:** navigation and UI copy.
2. **Content language/style:** Arabic, French, mixed, and optional Darija style.
3. **Scheduling timezone:** browser-detected or saved user timezone; `Africa/Algiers` may be an explicit editable suggestion, never a silent global override.

Acceptance:
- Caption generation starts as a draft and never auto-publishes without an explicit, separately authorized action.
- Users can request platform-specific variants while preserving a canonical source draft and reviewing each variant independently.
- Brand examples and context are scoped to the active workspace/client.
- Evaluation set includes Algerian Arabic/French, Darija where enabled, mixed-script names, dates, prices, claims and calls to action.
- Fluent reviewers score linguistic correctness, clarity, cultural appropriateness and meaning preservation; failed outputs are editable and can be regenerated without losing the original.
- Store only the minimum data needed for debugging/usage accounting; disclose external model/provider processing.

### GA-07 — Mobile and unstable-network resilience

Acceptance:
- Show file constraints before upload and validate MIME type, size and media requirements on the server.
- Preserve post text and chosen channel variants across navigation, recoverable upload failures and page reload where technically safe.
- Show upload progress, cancellable uploads, actionable retry and a clear final status.
- Interrupted upload or worker retry must not create a duplicate post.
- Test slow network, offline/online transitions, request timeout and app backgrounding on representative mobile browsers.
- Any future offline draft feature must clearly distinguish local-only, synced and scheduled states; never claim a post is scheduled until the server confirms persistence.

### GA-08 — Connection health

Acceptance:
- Derive status from actual token/provider/permission checks and recent errors, not the mere presence of an Integration row.
- Distinguish connected, attention needed, expired/revoked, permission missing, provider outage/rate-limited and disconnected states as supported by evidence.
- A failed background publish links to the affected connection and recommended recovery action.
- Reconnect must not silently change the selected identity/page or expose tokens.
- Tests cover expiry, revocation, insufficient scopes, reconnect and removal.

### GA-09 — Analytics integrity

Acceptance:
- Every metric records provider/source, account, retrieval time, measurement window and any known limitations.
- Missing or unsupported metrics render as unavailable, never as numeric zero.
- Cross-platform comparisons are only calculated for semantically comparable metrics; caveats stay visible in exports.
- Re-fetching the same window is reproducible or the report states why source metrics can change.
- Add export formats only after verifying existing capability and access controls.
- Tests cover empty data, stale data, provider errors, partial accounts and differing metric definitions.

### GA-10 — Agency/client approvals

Audit inherited organizations, roles, post states and any review/approval mechanisms first. Add only missing behavior.

Acceptance:
- Workspace owners configure reviewer permissions without granting unnecessary publishing/credential access.
- Each approval action is bound to a specific post version and channel variant.
- Edits after approval invalidate approval when material content changes.
- Client users cannot access other clients' content, media, analytics or connections.
- Decision, actor, timestamp and version are auditable.
- Failed or overdue approvals are visible without sending content live.

### GA-11 — Algeria-focused templates and onboarding

Treat this as a user-validation experiment, not a presumed demand. Pilot editable template packs for a small set of sectors selected with actual users (for example, retail, food service and local professional services) rather than adding a large generic catalog.

Acceptance:
- Templates contain editable caption structure, CTA, channel variants and optional Arabic/French text; any Darija is clearly labeled.
- No invented offers, prices, legal claims, opening hours or stock availability.
- Templates do not silently add a brand watermark to content intended for channels whose rules prohibit it.
- Measure median time to first saved draft, first scheduled post completion and edit/rejection rate; compare against a predeclared baseline.
- Content stays user-reviewed and is never published automatically by the template.

### GA-12 — API/agent safety

Reuse existing public APIs, webhooks, MCP, extension or agent capabilities if they already meet the contract.

Acceptance:
- Agent/API principals have scoped permissions and auditable identities.
- Drafting, editing, scheduling, publishing, deleting and connecting accounts are separate capabilities; destructive or external side effects require explicit policy authorization.
- Publish requests use the same server-side capability checks and lifecycle as human-created posts.
- Commands support idempotency/correlation IDs where practical; webhooks have signature verification, replay protection and bounded retries.
- Tenant context cannot be supplied or overridden solely by untrusted prompt text.
- Usage limits, timeout behavior, audit trails and secret redaction are tested.

### GA-13 — Local commercial/payment adapter

**Status: BLOCKED until merchant and legal eligibility are verified.** Existing Stripe/billing routes are not evidence of Algerian merchant acceptance, DZD settlement, recurring-payment capability or production certification.

Before implementation, collect current official documents for candidate providers; confirm business/entity eligibility, transaction types, settlement, fees, API access, refunds, dispute process, webhook signatures, idempotency, reconciliation and test environment. Only then choose an adapter.

Acceptance before launch:
- The provider confirms eligibility for the actual merchant and product.
- Successful, failed, duplicated, refunded and disputed transaction paths reconcile to provider records.
- Signature verification and idempotency tests pass.
- Currency and totals reflect actual configured prices; no invented conversions or unsupported recurring-payment claims.
- Paid checkout remains disabled until the end-to-end gate passes.

### GA-14 — Portability, deletion and retention

Acceptance:
- Users can export their data in a documented, usable format, subject to authorization and reasonable resource limits.
- Disconnecting a provider stops future publishing; deletion behavior for tokens, media, posts, analytics and derived data is explicit.
- Retention and backup expiry rules are documented and reviewed; deletion promises state where backup retention still applies.
- User requests are tenant-scoped, auditable and retry-safe.
- Privacy copy matches actual hosting, processors and deletion behavior; no local data-residency promise without proof.

## 5. Release metrics and evidence

At minimum, publish a private operator report with the following definitions and per-provider breakdowns before a pilot:

| Metric | Definition |
|---|---|
| First-post completion | Workspaces that complete a first scheduled post / workspaces that start onboarding in the same cohort |
| Confirmed publish success | Provider-confirmed successes / eligible publish attempts, segmented by provider and media type |
| Duplicate rate | Confirmed duplicate provider posts / confirmed publish operations |
| Unknown-outcome rate | Attempts awaiting reconciliation / attempts whose provider outcome is ambiguous |
| Recovery time | Median elapsed time from detected failure to provider-confirmed recovery or documented user action |
| Locale critical defect count | Open critical RTL/translation/accessibility findings in priority journeys |
| AI acceptance rate | Generated drafts accepted with small/no edits / generated drafts reviewed; not a measure of truth |
| Cost per active workspace | Attributable infrastructure and API cost / defined active-workspace cohort, with allocation method documented |

Every result should link to the test/CI run, environment, commit SHA, timestamps and sanitized evidence. Report unsupported metrics as unavailable. Record the denominator and any excluded attempts.

## 6. Implementation discipline

For each add-on:
1. Record the user-visible problem and evidence.
2. Inspect the inherited implementation and test whether an existing path can be extended.
3. State assumptions, external dependencies and risk.
4. Specify acceptance criteria before code changes.
5. Add automated tests and, where relevant, provider-side or browser evidence.
6. Implement the smallest extension that closes the verified gap.
7. Record commit, test result, residual uncertainty and rollback/recovery approach.

Do not add a new framework, database model, provider adapter or billing vendor solely because it appears on this list. This register is an evidence-driven queue, not a commitment to implement every candidate.

## 7. Source references

- [Postiz upstream repository](https://github.com/gitroomhq/postiz-app) — source of inherited features; verify the fork directly before relying on upstream behavior.
- [Postiz product capabilities](https://postiz.com/) — current public product description; marketing copy is not technical verification.
- [TikTok Content Posting API prerequisites](https://developers.tiktok.com/docs/en/content-posting-api-get-started) — example of a provider approval/audit constraint.
- [Node.js 22.23.4 release](https://github.com/nodejs/nodejs.org/blob/main/apps/site/pages/en/blog/release/v22.23.4.md) — runtime/security release reference.
- [GitHub Actions Node.js build guidance](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs) — workflow runtime selection reference.
