# Production Readiness Checklist

**Status:** OPEN — no production-readiness claim is made by creating this checklist.  
**Release owner:** To be assigned.  
**Review date:** 2026-10-27

A release gate requires evidence linked from the release/PR. If a prerequisite is blocked, record the owner, external dependency, user impact and safe fallback.

## Gate A — Source, license and dependency baseline

- [ ] Exact base commit and upstream synchronization point recorded.
- [ ] AGPL-3.0 license, copyright notices and source-offer obligations reviewed.
- [ ] Any name/logo/domain changes reviewed for trademark and attribution constraints.
- [ ] Runtime/toolchain versions pinned and installation instructions reproduce successfully.
- [ ] Lockfile is consistent; dependency audit findings triaged.
- [ ] Build/lint/type checks/test commands and their exit codes archived.
- [ ] Secrets scan shows no committed credentials or private keys.
- [ ] Repository branch/PR process has required checks before merging.

**Evidence:** baseline report, CI run, dependency report, license review record.

## Gate B — Core workflows and localization

- [ ] Onboarding, channel connection, draft, edit, schedule, approve, cancel and failure recovery pass.
- [ ] Arabic RTL layout reviewed on desktop and mobile.
- [ ] Mixed Arabic/Latin mentions, URLs, hashtags, numbers, punctuation and emoji tested.
- [ ] French UI is complete for the supported product surface.
- [ ] Darija generation is labeled as an AI-assisted optional writing mode and reviewed by fluent users.
- [ ] UI locale, content language and timezone are independent settings.
- [ ] Timezone conversion is tested at day/month boundaries and near scheduled publish time.
- [ ] Accessibility: keyboard navigation, visible focus, semantic labels, contrast and error messaging checked.
- [ ] Low-bandwidth uploads, interrupted requests and reload recovery tested.

**Evidence:** automated test reports, screenshots where helpful, localization review record, reproducible test steps.

## Gate C — Publishing and integrations

- [ ] Provider matrix completed for every channel used in the release.
- [ ] Provider terms, scopes, app review/audit and account-type prerequisites verified.
- [ ] Provider-confirmed test publish exists for each advertised automatic publishing action, or action is labeled manual-only.
- [ ] Unsupported content/media combinations are blocked before scheduling.
- [ ] Expired/revoked OAuth credentials disable publishing and prompt reconnection.
- [ ] Retry and timeout behavior cannot silently mark an unconfirmed post Published.
- [ ] Duplicate-publish scenarios, reconciliation and uncertain outcomes tested.
- [ ] Provider quotas/rate limits are handled and visible to operators.
- [ ] Analytics claims match actual provider data, scope and collection freshness.

**Evidence:** sanitized provider test records and CI/test artifacts. Screenshots of a button or a successful mock are insufficient.

## Gate D — Tenant security and privacy

- [ ] Server-side authorization is enforced on every tenant-owned API/data access path.
- [ ] Adversarial tests prove cross-workspace read/write/export attempts are denied.
- [ ] Role/permission changes and approval actions are audit logged.
- [ ] OAuth tokens and AI/payment secrets are encrypted/protected with limited access.
- [ ] Logs and traces exclude access tokens, passwords, secrets and unnecessary sensitive post content.
- [ ] CSRF/session, XSS, SSRF, injection, upload validation and rate limiting reviewed against the actual stack.
- [ ] Dependencies and container images have an actionable vulnerability process.
- [ ] Privacy notice accurately describes processing, storage, hosting, subprocessors and retention.
- [ ] Data export/deletion and account-disconnection behavior are tested.
- [ ] Incident response and credential-rotation procedures exist.

**Release rule:** unresolved critical security issues block release. High findings require explicit risk owner and mitigation/acceptance before release.

## Gate E — Reliability and operations

- [ ] Liveness/readiness checks separate application health from dependency health.
- [ ] Structured logs include correlation/job identifiers without secrets.
- [ ] Metrics and alerts cover provider failures, queue lag, stuck jobs, retry volume, rate limits, storage and database health.
- [ ] Operators can inspect, retry safely or quarantine a failed job.
- [ ] Backoff and retry limits prevent hot loops and duplicate effects.
- [ ] Database migrations are reviewed, reproducible and have a recovery/rollback strategy.
- [ ] Backup is scheduled, and a restore has been demonstrated in an isolated environment.
- [ ] Deployment rollback has been tested; app and migration compatibility are documented.
- [ ] Load/soak tests represent scheduled jobs, media uploads and concurrent workspaces.
- [ ] Capacity limits and cost alerts are documented.
- [ ] External provider outage and expired credential drills were performed.
- [ ] Support ownership, escalation path, status communication and incident severity levels are defined.

## Gate F — AI quality, safety and cost

- [ ] AI outputs remain drafts until user-approved.
- [ ] Brand and tenant context is scoped and tested against cross-tenant leakage.
- [ ] User-controlled content and provider credentials are not placed in prompts unnecessarily.
- [ ] Timeouts, API errors, quota exhaustion and malformed model output preserve drafts.
- [ ] Arabic/French/Darija evaluation set has known expected qualities and human review.
- [ ] Product claims, prices, discounts and factual statements have review safeguards.
- [ ] Cost/usage per workspace is measurable; budgets/quotas and alerts are defined.
- [ ] Provider/model changes have regression evaluations.

## Gate G — Payments and commercial/legal prerequisites

- [ ] Merchant eligibility confirmed for the selected provider and business entity.
- [ ] API access, certification and approved transaction types confirmed.
- [ ] Payment test flow, webhook signature verification and idempotency pass.
- [ ] Subscription/cancellation/refund paths and failed-payment handling tested where applicable.
- [ ] Payment reconciliation matches provider transaction records.
- [ ] DZD price presentation reflects approved actual prices, with no invented exchange rate.
- [ ] Terms, privacy, cancellation/refund policy and support contacts receive appropriate review.
- [ ] Billing remains disabled where any provider/legal prerequisite is not confirmed.

## Gate H — Launch decision

- [ ] Pilot cohort and launch scope defined.
- [ ] Success thresholds documented before measuring results.
- [ ] Rollback/disable strategy exists for broken connectors and release-level incidents.
- [ ] First-post completion, provider-specific publish success, duplicate rate, recovery time, support burden and cost metrics are visible.
- [ ] Residual risks have named owners, impact and mitigation.
- [ ] Go/no-go decision records the evidence considered and dissent/unknowns.
- [ ] User feedback is gathered with consent and separated from inferred conclusions.

## Release decision record

Fill this in for each release:

| Field | Value |
|---|---|
| Release / commit | OPEN |
| Environment | OPEN |
| Test/CI run links | OPEN |
| Provider capabilities verified | OPEN |
| Open critical/high risks | OPEN |
| Backup/restore evidence | OPEN |
| Rollback evidence | OPEN |
| Cost limits / alert status | OPEN |
| Decision owner | OPEN |
| Decision | OPEN — GO / NO-GO |
| Decision timestamp | OPEN |
| Residual uncertainty | OPEN |

A release can be approved with known residual risks only when the impact, mitigation, owner and decision are explicit. Do not mark the checklist complete solely because all code is merged.
