# Postiz Algeria — Product Documentation

> **Status:** planning baseline, not an implementation claim  
> **Repository:** [Loofy147/postiz-algeria](https://github.com/Loofy147/postiz-algeria)  
> **Upstream:** [gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app)  
> **Review date:** 2026-10-27

This directory defines the intended localized product, the implementation sequence, provider-capability evidence requirements, and production release gates. The application remains based on upstream Postiz until a code audit justifies specific changes.

## Documents

- [Product blueprint](PRODUCT_BLUEPRINT.md) — target users, differentiated capabilities, architecture constraints, decisions and success measures.
- [Baseline source audit](BASELINE_AUDIT.md) — repository provenance and verified current localization/RTL findings; separates source inspection from runtime verification.
- [Implementation roadmap](ROADMAP.md) — phased work, exit criteria and progress checklist.
- [Integration capability matrix](INTEGRATION_CAPABILITY_MATRIX.md) — per-provider verification record; an inherited connector is not automatically production-approved.
- [Production readiness checklist](PRODUCTION_READINESS.md) — security, reliability, legal, billing and release gates.

## Evidence rules

Every project status must be one of:

- **VERIFIED** — supported by a reproducible test, source inspection, provider response, CI run or other inspectable artifact.
- **IMPLEMENTED_UNVERIFIED** — code exists, but the acceptance test/evidence is incomplete.
- **USER_REPORTED** — reported by an operator, not independently verified.
- **INFERENCE** — a reasoned conclusion with stated basis.
- **OPEN** — unresolved or not yet investigated.
- **BLOCKED** — progress depends on an identified external prerequisite.

Discussion or a checklist entry alone is not proof. Keep source evidence, test results, and conclusions distinct.

## Current baseline

- The repository is a fork of `gitroomhq/postiz-app`; the application source and history are present.
- The root package identifies the codebase as AGPL-3.0 and uses pnpm workspaces.
- The project-specific documentation in this directory is a planning artifact. It does **not** prove a build passed, localizations were implemented, APIs were approved, or a deployment exists.
- The main branch is kept untouched by this initial documentation change; work is prepared on `feature/algeria-product-foundation`.
