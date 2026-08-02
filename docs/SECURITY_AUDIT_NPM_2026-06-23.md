# Dependency Security Audit — `npm audit`

**Project:** Rural Tourism Backend API
**Date:** 2026-06-23
**Tool:** `npm audit` (npm built-in dependency vulnerability scanner)
**Source:** GitHub Advisory Database (GHSA)

---

## 1. Summary

A dependency vulnerability scan was run against the backend's installed `node_modules`
using `npm audit`. The scan reported **48 vulnerabilities**:

| Severity  | Count |
|-----------|-------|
| Critical  | 4     |
| High      | 15    |
| Moderate  | 22    |
| Low       | 7     |
| **Total** | **48**|

> ⚠️ These figures reflect the audit run on 2026-06-23 and will change as
> dependencies are updated. Re-run `npm audit` to get current numbers.

Most findings are **transitive dependencies** (packages pulled in by our direct
dependencies) rather than packages we installed directly. A meaningful share also
come from the **development/test toolchain** (Jest, Babel, Istanbul), which is **not
shipped to production** — the production Docker image is built with `npm ci --omit=dev`
(see [`Dockerfile`](../Dockerfile)), so dev-only vulnerabilities do not reach the
deployed runtime.

---

## 2. Findings by category

### 2.1 Direct production dependencies

These are packages listed in [`package.json`](../package.json) `dependencies` (or
pulled directly by them) and **do** ship to production. Prioritise these.

| Package      | Severity | Issue (summary)                                                        | Fix |
|--------------|----------|------------------------------------------------------------------------|-----|
| `express`    | High     | Pulls vulnerable `body-parser`, `cookie`, `path-to-regexp`, `qs`, `send`, `serve-static` (ReDoS / injection / DoS) | `npm audit fix --force` → upgrades to `express@4.22.2` (outside current stated range `~4.16.1`) |
| `qs`         | High     | Prototype pollution; `arrayLimit` bypass DoS; `stringify` crash DoS    | Upgrade (bundled with the Express upgrade) |
| `path-to-regexp` | High | Backtracking regex / ReDoS                                             | Upgrade via Express |
| `send` / `serve-static` | Moderate | Template injection → XSS                                      | Upgrade via Express |
| `cookie`     | Low      | Accepts out-of-bounds characters in name/path/domain                   | Upgrade via Express |
| `sequelize`  | High     | SQL injection via JSON column cast type (v6); depends on vulnerable `uuid` | `npm audit fix` (non-breaking) |
| `nodemailer` | High     | SMTP command injection (`envelope.size`, CRLF in transport/HELO, List-* headers); jsonTransport / raw bypass of file & URL access controls; improper TLS cert validation in OAuth2 | `npm audit fix --force` → `nodemailer@9.0.1` (breaking) |
| `morgan`     | Moderate | Depends on vulnerable `on-headers` (HTTP response header manipulation) | `npm audit fix --force` → `morgan@1.11.0` (outside stated range) |
| `jade`       | Critical | Depends on vulnerable `clean-css`, `constantinople` (sandbox bypass → RCE), `transformers`, `uglify-js` | `npm audit fix --force` → `jade@1.9.2` (breaking). **See note below.** |
| `uuid`       | Moderate | Missing buffer bounds check in v3/v5/v6 when `buf` is provided         | `npm audit fix` (non-breaking) |

### 2.2 Transitive dependencies (via Puppeteer / `@sparticuz/chromium`)

Pulled in by the PDF-generation stack ([`puppeteer`](../package.json),
`puppeteer-core`, `@sparticuz/chromium`).

| Package      | Severity | Issue (summary)                                            | Fix |
|--------------|----------|-----------------------------------------------------------|-----|
| `basic-ftp`  | Critical | Path traversal; CRLF/FTP command injection; DoS           | `npm audit fix` |
| `ws`         | High     | Uninitialized memory disclosure; memory-exhaustion DoS    | `npm audit fix` |
| `form-data`  | High     | CRLF injection via unescaped multipart field/file names   | `npm audit fix` |
| `socks` / `ip-address` | Moderate | XSS in `Address6` HTML-emitting methods         | `npm audit fix` |

### 2.3 Development / test toolchain only (NOT in production image)

Excluded from the production build via `npm ci --omit=dev`. Lower priority — these
run only on developer machines and in CI.

| Package(s)   | Severity | Issue (summary)                                            | Fix |
|--------------|----------|-----------------------------------------------------------|-----|
| `@babel/core`| Moderate | Arbitrary file read via `sourceMappingURL` comment        | `npm audit fix` |
| `js-yaml` (via Jest/Istanbul) | Moderate | Prototype pollution & quadratic DoS in merge keys | `npm audit fix --force` → `jest@25` (breaking) |
| `lodash`     | High     | Code injection via `_.template`; prototype pollution      | `npm audit fix` |
| `jws`        | High     | Improper HMAC signature verification                      | `npm audit fix` |
| `validator`  | High     | URL validation bypass in `isURL`                          | `npm audit fix` |
| `minimatch` / `picomatch` / `brace-expansion` | Moderate–High | Various ReDoS | `npm audit fix` |
| `uglify-js` (via `jade`/`transformers`) | Critical | ReDoS; incorrect minification handling | tied to `jade` downgrade |
| `clean-css`, `constantinople`, `transformers` | Critical | Sandbox bypass → RCE (part of `jade` chain) | tied to `jade` downgrade |
| `dottie`     | Moderate | Prototype pollution bypass in `set()`/`transform()`       | `npm audit fix` |
| `js-cookie`  | High     | Per-instance prototype hijack in `assign()`               | `npm audit fix` |

---

## 3. Remediation guidance

`npm audit` reports two remediation paths:

1. **`npm audit fix`** — applies non-breaking, semver-compatible upgrades.
   Safe to run first; resolves most transitive and several direct findings.

2. **`npm audit fix --force`** — applies upgrades that **break** the stated
   dependency ranges and may introduce breaking API changes. These require
   testing before deploy:
   - `express` → `4.22.2` (outside `~4.16.1`)
   - `morgan` → `1.11.0`
   - `nodemailer` → `9.0.1` (major)
   - `jade` → `1.9.2` (**downgrade** — see note)
   - `js-yaml` path forces `jest@25` (major)

### Notes & cautions

- **`jade`**: `npm audit fix --force` resolves the `jade` chain by *downgrading* to
  `jade@1.9.2`, which is a breaking change. `jade` is the deprecated predecessor of
  Pug and is only used as the view engine. Consider **removing `jade` entirely** or
  migrating to a maintained engine rather than pinning an old version. Confirm whether
  any server-rendered views are still in use before changing this.
- **`express` / `nodemailer` upgrades are breaking.** Run the full test suite
  (`npm test`) and exercise email + PDF flows after upgrading.
- After any change, **re-run `npm audit`** and update the figures in Section 1.

### Suggested order of work

1. `npm audit fix` (non-breaking) → commit → run `npm test`.
2. Upgrade `nodemailer` to v9 on a branch → verify email sending → commit.
3. Upgrade `express` (and bundled sub-deps) on a branch → run full suite → commit.
4. Decide on `jade` (remove vs. replace) separately.
5. Re-run `npm audit`; record remaining accepted risks here.

---

## 4. Disclaimer

`npm audit` flags *known* advisories in the installed dependency tree. It does **not**
prove exploitability in this application's context, nor does it cover application-level
security (authz, input validation, secrets handling). It complements, but does not
replace, manual security review and penetration testing.

---

*Generated from `npm audit` output captured on 2026-06-23.*
