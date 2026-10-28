# Product Blueprint — Algeria-first Social Media Management

**Status:** Proposed product requirements. Feature implementation and market assumptions remain unverified.  
**Last reviewed:** 2026-10-27

## 1. Product thesis

Build an AI-assisted social-media operations workspace that is useful to Algerian small businesses, creators, social-media managers and agencies, while keeping the architecture capable of serving customers in other markets later.

This must be more than a translation of Postiz. Differentiation should come from accurate Arabic/French/Darija workflows, mobile-first usability, reliable publishing operations, client approvals, measurable reporting, local commercial readiness and transparent handling of provider restrictions.

**Working label:** “Postiz Algeria” is a repository/product working name only. Before a public launch, decide whether the brand and domain are appropriate and review relevant trademark and upstream branding constraints.

## 2. Evidence and assumption ledger

| Claim | Status | Consequence |
|---|---|---|
| The repository is a fork of `gitroomhq/postiz-app` and contains application source | VERIFIED by GitHub repository metadata and root files | Audit and extend before considering a rewrite |
| Upstream describes scheduling, analytics, collaboration, AI and automation/API capabilities | VERIFIED as upstream README claims; actual paths still require source audit | Use as candidate baseline, not as proof of every feature working |
| Arabic RTL, French and Darija assistance can improve usability for target users | HYPOTHESIS until tested with target users | Build a testable localization slice and evaluate it |
| Local payment options and pricing will affect conversion | HYPOTHESIS | Research eligible merchant providers, requirements, cost and settlement before implementation |
| Every listed upstream social connector is production-ready for our use case | OPEN; must not be assumed | Inspect code, scopes, provider review status and real publish/read tests per connector |
| A generated caption is suitable to publish without a human review | NOT ACCEPTED as a default | Keep human approval and clear AI disclosure/quality controls where appropriate |

Do not upgrade a hypothesis to a fact merely because it is repeated in later documents.

## 3. Initial target users and jobs to be done

### A. Small business owner
- Prepare posts from a phone without learning a complicated marketing suite.
- Reuse branded content safely and see what is scheduled, published, failed or awaiting action.
- Understand basic results without needing a data analyst.

### B. Freelancer or social-media manager
- Manage multiple brands and channels from one workspace.
- Draft content, obtain client approval, schedule it, and report on delivered work.
- Avoid confusing content belonging to different clients.

### C. Marketing agency
- Separate client data, assets, users, approvals and reporting.
- Assign work, maintain a visible audit history, and export client-facing reports.
- Identify blocked integrations and failed jobs before a client reports them.

### D. Creator
- Plan formats and variants for different channels.
- Preserve creative control; see a channel-specific preview and publishing restrictions.
- Track performance only where the provider actually exposes the required metrics.

Validate these segments through interviews and observed workflows before treating them as proven market demand.

## 4. Product principles

1. **Mobile-first, not mobile-afterthought.** Core tasks must work on small screens: create, preview, schedule, approve, retry, and inspect results.
2. **Multilingual by design.** Separate interface language from post language. Support Arabic RTL and mixed Arabic/Latin text, French, and optional Darija generation. The UI should not change writing language unexpectedly.
3. **Truthful publishing state.** Distinguish Draft, Needs approval, Scheduled, Queued, Publishing, Published (provider-confirmed), Failed, Needs reconnection, and Manual action required.
4. **Official integrations only.** Use supported provider APIs and authorized OAuth flows. Do not rely on scraping, credential collection, or bypassing provider restrictions.
5. **AI assists; users control.** Generated content starts as a draft. Show editable output, language/style settings and the destination-specific constraints used for validation.
6. **Tenant boundaries first.** Agency/client separation must be enforced server-side, not only by hiding items in the interface.
7. **Evidence before release.** A connector, feature or deployment cannot be called production-ready without passing its defined acceptance gates.
8. **Progressive complexity.** Everyday workflows should be straightforward; advanced controls can be available without overwhelming novice users.
9. **Portable architecture.** Keep Algeria-specific taxonomies, locale defaults and payment adapters configurable rather than hard-coding them throughout core scheduling logic.
10. **Upstream awareness.** Prefer minimal, explainable changes and upstream-compatible patches. Avoid maintaining a fork that diverges without measurable value.

## 5. Scope

### Core product surface

- Workspaces, brands, member roles and channel connections.
- Unified content calendar, queue and scheduling workflows.
- Composer with per-channel text/media variants and preview.
- Approval requests, comments, revision history and audit events.
- Media library and reusable brand assets.
- Channel connection health and permission/expiry visibility.
- Publishing job status, failure classification, safe retries and manual-action guidance.
- Analytics and report exports, showing data freshness and source channel.
- Notifications for approvals, impending publish jobs, failures and reauthorization.
- Basic campaign/UTM metadata and content tagging where supported by the existing data model.
- Public API/webhook compatibility where the codebase already supports it, documented and access-controlled.

### Algeria-focused product additions

- Arabic interface with true right-to-left layout, not merely translated strings.
- French interface; keep copy and date/number formatting locale-aware.
- Optional Darija writing mode with explicit dialect/style controls; evaluate quality with fluent reviewers.
- Content-language selector separate from UI language.
- Arabic/French mixed-direction composer, hashtags, mentions, URLs, emoji and punctuation tests.
- Locally relevant, editable content templates by business type; do not hard-code unverified cultural assumptions.
- Timezone-aware scheduling that preserves the existing browser-detected IANA timezone and explicit user override. For Algeria-focused onboarding, `Africa/Algiers` may be suggested as an editable choice, but must not silently override device settings or a saved preference.
- DZD display in commercial screens when actual DZD prices are established; never fabricate exchange rates or payment availability.
- Local payment adapter(s) only after merchant eligibility, API documentation, certification, settlement and refund processes are verified.
- Low-bandwidth and mobile network resilience: save drafts reliably, optimize media upload behavior, expose progress, and avoid duplicate publishing on retries.
- Operational help and onboarding in Arabic and French.

### AI capabilities to prioritize

- Caption variations by language, platform, objective and tone.
- Transform one approved source brief into channel-specific variants.
- Brand voice profile with explicit editable examples and per-brand boundaries.
- Calendar suggestions labeled as suggestions, not guaranteed optimal times.
- Hashtag and call-to-action proposals with user review.
- Text quality checks for length, unsupported claims, spelling and language mixing.
- Repurposing of owned content. Never imply permission to use copyrighted or private content that the user does not control.
- Provider-specific validation should be grounded in connector metadata or current official API rules, not LLM guesses.
- Bring-your-own-key or cost-controlled provider configuration only after secrets, quota, privacy, and billing impacts are assessed.

### Out of scope until supported by evidence

- Scraping social networks or automating browser login to bypass official APIs.
- Claiming universal auto-publishing on every social platform.
- Promising reach, virality, sales lift or engagement improvements without experiments.
- A full CRM, ad-buying platform, or all-in-one e-commerce suite in the first product phases.
- Collecting passwords or asking users to paste social-platform access tokens into support chats.
- Enabling paid subscriptions before the merchant/payment path is certified and reconciled.

## 6. Functional requirements and acceptance tests

### Localization
- Every visible string in the new/modified product surface comes from the localization system.
- Arabic route/page is correctly RTL; layout, icons, navigation, alignment, forms, modal direction and keyboard focus are checked.
- Mixed Arabic/Latin strings render correctly for URL, @mention, hashtag, digits and punctuation.
- Locale switching does not lose the current draft or change its authoring language silently.
- Tests cover date/time formatting and `Africa/Algiers` scheduling, including boundary conditions.

### Composer and scheduling
- A post may have channel-specific variants without silent content loss.
- Before scheduling, validate that the selected channel supports the chosen media/content type according to known connector capabilities.
- A scheduling request stores timezone context consistently and can be inspected in the audit log.
- Repeated requests and worker retries must not create duplicate posts where idempotency can be enforced.
- A post is marked Published only after a successful provider response or a documented provider-confirmed reconciliation.
- When auto-publishing is not available, show Manual action required with clear steps.

### AI generation
- AI output is a draft until user-approved.
- Inputs are scoped to the chosen workspace/brand; cross-tenant prompt/context leakage is prohibited.
- Record model/provider, template version and relevant cost/usage metadata without storing unnecessary sensitive prompts.
- A model/API failure leaves the original draft intact and reports a recoverable error.
- Evaluation set includes Arabic, French, Darija, mixed-script content, product descriptions, promotions and prohibited/unsupported claims.

### Teams, agencies and security
- Every tenant-owned record is authorized at API/data-access boundaries.
- Role changes, approval decisions and channel connection events are auditable.
- Tests prove one workspace cannot read or mutate another workspace's assets, drafts, analytics or credentials.
- Revoked/expired credentials stop publishing and trigger an actionable reconnection state.

### Analytics
- Each metric displays channel, collection time/range and any known provider limitations.
- Missing provider metrics are “unavailable,” not zero.
- Cross-platform totals are computed only for semantically comparable metrics and clearly disclose differences.
- Reports can be regenerated for the same date range and source data snapshot.

## 7. Technical direction

**Do not finalize the architecture until the code audit is done.** The upstream README describes a pnpm monorepo using Next.js, NestJS, Prisma/PostgreSQL and Temporal. The fork's current source should be inspected for the actual implementation of each subsystem before modifying it.

### Extension strategy
- Keep the existing scheduler, provider adapters and data model when they meet reliability and product requirements.
- Introduce a central locale/configuration layer for UI language, writing language, timezone and formatting.
- Reuse existing team, approval, analytics and integration mechanisms where they satisfy acceptance tests.
- Add capability metadata only where the current model cannot truthfully represent per-provider restrictions; avoid duplicate sources of truth.
- Keep AI generation behind a service/provider abstraction with cost limits, timeout handling and explicit user approval.
- Keep payment processing behind an adapter and do not store raw card data.
- Use migrations with rollback/back-up strategy; no direct production schema changes without migration review.

### Cross-cutting operational requirements
- Structured logs with request/job/correlation IDs and no access tokens or sensitive post contents by default.
- Idempotent background work, bounded retries with backoff, dead-letter/reconciliation approach, and an operator-visible failed-job queue.
- Health/readiness checks, dependency checks and alerting for queue lag, failed publishing jobs, provider authentication errors and storage problems.
- Rate limiting, request validation, secure secret storage, least privilege and documented incident response.
- Separate development, preview/staging and production settings. Never place credentials in Git.
- Database backup and an observed restore test, not merely a backup configuration.
- Data export and deletion pathways with a retention policy aligned to legal review.

## 8. Commercial readiness for Algeria

These are investigation tasks, not assumptions about current availability:
- Verify applicable business/legal requirements for operating the service and subscriptions in Algeria.
- Compare eligible local and international payment providers, merchant onboarding, approved business categories, API access, fees, settlement currency, refunds, disputes, reconciliation and support.
- Confirm whether the chosen vendor supports recurring subscriptions or whether an alternative billing flow is needed.
- Decide on price points only after customer interviews, operating-cost estimates and willingness-to-pay evidence.
- Publish clear terms, privacy notice, refund/cancellation process, data retention and support contact.
- Measure AI, media storage, egress, database and background-job costs per active workspace before setting usage quotas.
- Document data hosting and subprocessors; do not promise local data residency unless deployment and contracts make it true.

## 9. Product metrics

Metrics need definitions, source fields and a known collection cadence before being used for decisions.

| Metric | Definition | Use |
|---|---|---|
| Time to first scheduled post | Median elapsed time from account/workspace onboarding start to first successfully scheduled post | Onboarding friction |
| First-post completion rate | Workspaces that schedule their first post / workspaces that begin onboarding in the same cohort | Activation |
| Publish success rate | Provider-confirmed successful publishing attempts / all eligible publishing attempts, grouped by provider and media type | Reliability; exclude drafts and unsupported attempts with explicit reporting |
| Duplicate publish rate | Confirmed duplicated published items / provider-confirmed publish operations | Retry/idempotency quality |
| Median recovery time | Median time from a detected publishing failure to recovery or a clear user action | Operational resilience |
| Approval turnaround | Median time from approval request to a decision | Agency workflow |
| Active workspaces | Workspaces with at least one qualifying action in the defined window | Adoption; define action list and window |
| AI acceptance rate | Generated drafts accepted with small/no edits / generated drafts reviewed | Assist usefulness, not content truth |
| Cost per active workspace | Infrastructure + metered API costs attributable to a workspace / active workspaces | Unit economics; disclose allocation method |
| Support burden | Support cases grouped by root cause per 100 active workspaces | UX and reliability priorities |

Do not optimize vanity metrics or infer business outcomes from publishing volume alone.

## 10. Key risks and responses

| Risk | Control |
|---|---|
| Provider API approval delays/restrictions | Capability matrix; keep unsupported workflows manual and label them accurately |
| Upstream drift makes maintenance expensive | Pin baseline commits, track upstream changes, test integration boundaries and periodically rebase |
| RTL is cosmetically translated but still unusable | RTL acceptance suite and review by Arabic-speaking users |
| Darija quality is inconsistent | Human evaluation and editable output; don't promise perfect dialect support |
| Local billing is not available for the target merchant | Validate eligibility early; keep paid checkout blocked until confirmed |
| AI sends inaccurate or inappropriate content | Draft-first workflow, editable output, policy checks and explicit human approval |
| Tenant leak exposes client information | Server-side authorization, adversarial cross-tenant tests and audit logs |
| Worker retry duplicates external posts | Idempotency where possible, reconciliation and honest uncertain-state handling |
| Hosting cost exceeds revenue | Instrument cost by tenant/provider; budgets, quotas and alerting |

## 11. Licensing and brand

The upstream repository identifies itself as AGPL-3.0. Before distributing or operating a modified version over a network, review the actual license text and compliance obligations with appropriate legal advice. Keep required copyright/license notices and provide corresponding source as required by the license. Do not assume a fork permits removal of upstream notices or proprietary relicensing of AGPL-covered changes.

## 12. Definition of product readiness

The product is not production-ready until:
- critical user journeys pass on mobile and desktop;
- localization and accessibility checks pass for supported locales;
- provider publishing behavior is verified per connector and account type;
- no known critical/high security issue remains without documented risk acceptance;
- multi-tenant access tests pass;
- migrations, backup restoration, monitoring and rollback are demonstrated;
- payment eligibility and customer-facing legal/commercial information are verified;
- cost limits and support/incident procedures exist;
- a staged launch has observable health metrics and a rollback decision rule.

See [roadmap](ROADMAP.md), [provider matrix](INTEGRATION_CAPABILITY_MATRIX.md) and [release checklist](PRODUCTION_READINESS.md).
