# Social Provider Capability Matrix

**Status:** Initial inventory only; no connector in this document is declared production-verified.  
**Review date:** 2026-10-27  
**Rule:** A provider icon, frontend option or upstream README entry does not prove an authorized production publishing path exists.

## How to use this matrix

For every connector, inspect code, record the exact provider API/docs and version, then test the supported actions against an authorized test account. Scope verification to the account type, geography, app approval status, media type and endpoint tested.

Status values:
- **NOT AUDITED** — implementation/docs not inspected for this product yet.
- **CODE FOUND** — connector code exists; API approval and runtime success are not established.
- **PARTIAL** — some actions work; unsupported actions are documented.
- **VERIFIED** — reproducible successful test evidence exists for a stated scope and account.
- **MANUAL-ONLY** — user must complete the action outside the app; UI must state this clearly.
- **BLOCKED** — depends on approval, access, external setup or an unresolved defect.

## Candidate channels inherited from the upstream README

The upstream README lists these candidate channels. This is a discovery list, not a guarantee that every one is implemented or publishable in this fork.

| Provider | Actions to audit | Initial status | Official reference starting point |
|---|---|---|---|
| Instagram | OAuth/account type, feed/reel/story media types, publishing, comments/insights where relevant, token lifecycle | NOT AUDITED | [Instagram Platform](https://developers.facebook.com/docs/instagram-platform/) |
| Facebook | Page connection, text/media publishing, permissions, insights, Page token lifecycle | NOT AUDITED | [Meta for Developers](https://developers.facebook.com/docs/) |
| TikTok | Direct Post vs upload/draft flow, content type, scope approval, audit/public visibility restrictions | NOT AUDITED | [Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started/) |
| YouTube | Video upload, metadata, privacy defaults, processing status, quota and analytics access | NOT AUDITED | [YouTube Data API](https://developers.google.com/youtube/v3/docs/videos/insert) |
| LinkedIn | Profile/Page permissions, post media types, organization scopes, analytics | NOT AUDITED | [LinkedIn developer documentation](https://learn.microsoft.com/en-us/linkedin/) |
| X | Post/media operations, API access tier, quotas, pricing and analytics availability | NOT AUDITED | [X API documentation](https://developer.x.com/en/docs/x-api) |
| Threads | Account/permission flow, publish types, insights and expiry | NOT AUDITED | [Meta for Developers](https://developers.facebook.com/docs/) |
| Pinterest | Pin creation/media, board permissions, quotas and analytics | NOT AUDITED | [Pinterest API](https://developers.pinterest.com/) |
| Reddit | Community/subreddit rules, authorization, post types, rate limits and analytics | NOT AUDITED | [Reddit API documentation](https://www.reddit.com/dev/api/) |
| Mastodon | Instance-specific API behavior, scopes, media and scheduled posting | NOT AUDITED | [Mastodon API](https://docs.joinmastodon.org/api/) |
| Bluesky | Session/security model, post/media support, rate limits and scheduling behavior | NOT AUDITED | [AT Protocol documentation](https://atproto.com/guides/overview) |
| Discord | Bot/webhook capabilities, channel permissions and whether the use case is messaging rather than social publishing | NOT AUDITED | [Discord developer documentation](https://discord.com/developers/docs/intro) |
| Slack | App/bot permissions, workspace installation and message/automation behavior | NOT AUDITED | [Slack API documentation](https://api.slack.com/) |
| Dribbble | Verify current supported operations, authentication and whether the connector still meets the product's publishing use case | NOT AUDITED | [Dribbble developer resources](https://developer.dribbble.com/) |

Some of these are messaging/community services rather than equivalent social publishing destinations. Product UI should label their capabilities accurately instead of treating every destination as interchangeable.

## Required evidence record per provider

Create one record per provider and tested capability, with:

- Provider, API product/version and official documentation URL.
- Source file(s), adapter/service and worker path in this repository.
- Required OAuth scopes/permissions and account prerequisites.
- Developer app approval/audit state and account type used for testing.
- Supported action and media/content type.
- Test timestamp (UTC), test environment, sanitized test identifier and outcome.
- Raw response/error classification with sensitive fields redacted.
- Resulting post identifier/permalink when the provider returns one.
- Rate-limit, quota, approval and known analytics limitations.
- Retry/idempotency behavior and handling for uncertain provider outcomes.
- Token expiry/revocation behavior.
- Regression-test location and evidence artifact/CI run link.
- Final classification and reviewer.

Never store raw OAuth tokens, client secrets, personal data or private post contents in the evidence log.

## Minimum acceptance scenarios

For each priority connector, test as applicable:

1. OAuth connect and expected permission check.
2. Account/channel identity and capability discovery.
3. Valid text-only post.
4. Each promised media type with valid and invalid files.
5. Scheduled publish in a test/staging context approved by the provider.
6. Provider rejection, expired/revoked token and rate limit.
7. Retry after transient failure and safe handling of ambiguous timeouts.
8. Reconciliation when the provider accepted a post but the worker did not record success.
9. Disconnect/revoke and confirmation that publishing stops.
10. Analytics retrieval, freshness and missing-metric behavior if analytics are advertised.

If a platform requires review/audit, approval and test accounts must be recorded as prerequisites. A successful local unit test proves adapter behavior under its fixture; it does not prove the provider granted production access.

## UI contract

The UI must reflect the matrix:
- Show supported actions for each connected channel.
- Disable or clearly label unsupported action/media combinations before scheduling.
- Provide Manual action required where auto-publishing is unavailable.
- Show Needs reconnection for expired/revoked authorization.
- Show Failed with an actionable explanation when publishing fails.
- Do not show Published without provider-confirmed success or a documented reconciliation proof.
