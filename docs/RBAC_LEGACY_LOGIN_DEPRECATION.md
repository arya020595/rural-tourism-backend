# Legacy Login Deprecation Plan

Status: Active
Last updated: 2026-04-13
Owner: Backend Team

## Purpose

This document tracks the compatibility bridge for legacy login endpoints while clients migrate to the canonical RBAC endpoint:

- Canonical endpoint: POST /api/auth/login

## Legacy Endpoints Kept Temporarily

- POST /api/users/login
- POST /api/tourists/login
- POST /api/association-users/login

These endpoints currently delegate authentication to the shared auth service.

## Runtime Deprecation Signals

Legacy login responses now include:

- HTTP header: Deprecation: true
- HTTP header: Sunset: Thu, 31 Dec 2026 23:59:59 GMT
- HTTP header: Link: </api/auth/login>; rel="successor-version"
- JSON fields: deprecated=true, migrate_to="/api/auth/login"

## Migration Target Contract

Clients should migrate to POST /api/auth/login with:

Request body:
- identifier
- password
- user_type (optional: operator, tourist, association)

Response envelope:
- success
- message
- data.token
- data.user
  - id
  - user_type
  - unified_user_id (operator)
  - legacy_user_id (tourist/association compatibility)
  - username
  - email
  - role
  - permissions

## Milestones

1. 2026-04-13: Compatibility bridge active and deprecation signals shipped.
2. 2026-06-30: All first-party frontend clients migrate to /api/auth/login.
3. 2026-09-30: Legacy endpoints disabled in staging; monitor external client errors.
4. 2026-12-31: Legacy endpoints removed from production.

## Removal Checklist

- First-party frontend login calls use /api/auth/login only.
- API consumers acknowledged deprecation timeline.
- Regression test coverage for /api/auth/login is in place.
- API docs updated to remove legacy login references.

## Rollback Strategy

If migration incidents occur before final sunset:

- Keep legacy endpoints enabled.
- Preserve deprecation headers and migration metadata.
- Re-announce updated sunset date in this document.
