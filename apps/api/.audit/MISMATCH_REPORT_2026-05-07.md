# API Audit Mismatch Report (2026-05-07)

Sources reviewed

- apps/api/.audit/implementation_plan.md
- apps/api/.audit/BACKEND_AUDIT_REPORT.md
- apps/api/.audit/audit_report_phase5.md
- apps/api/.audit/audit_report_270426.md

Current files checked

- apps/api/src/bootstrap.ts
- apps/api/src/index.ts
- apps/api/src/commons/http/response.ts
- apps/api/src/commons/security/password.ts
- apps/api/src/modules/auth/services/auth.service.ts
- apps/api/src/modules/auth/services/email.service.ts
- apps/api/src/modules/auth/handlers/login.handler.ts
- apps/api/src/modules/auth/handlers/password.handler.ts
- apps/api/src/modules/auth/handlers/register.handler.ts
- apps/api/src/modules/debts/services/debt.service.ts
- apps/api/src/modules/debts/handlers/list.handler.ts
- apps/api/src/modules/debts/handlers/confirm.handler.ts
- apps/api/src/modules/system/routes.ts
- apps/api/src/modules/system/services/system.service.ts
- apps/api/src/modules/data/handlers/data.handler.ts
- apps/api/src/repositories/auth/session.repo.ts
- packages/db/src/schema/session.schema.ts

## Mismatches (audit vs current)

- Route duplication via src/routes/api.ts. Audit claims a second routing path alongside module barrels; current code has no src/routes directory and routing is centralized in createApp via bootstrap. Evidence: [apps/api/src/bootstrap.ts](apps/api/src/bootstrap.ts)
- Legacy src/lib or src/app still used. Audit cites apiError/apiSuccess coming from legacy src/lib/http; current code uses commons/http/response.ts and no src/lib folder exists. Evidence: [apps/api/src/commons/http/response.ts](apps/api/src/commons/http/response.ts)
- SMTP transport re-created per send. Audit states SmtpTransport is created per email; current email service uses a singleton transport (lazy init) and real send flow. Evidence: [apps/api/src/modules/auth/services/email.service.ts](apps/api/src/modules/auth/services/email.service.ts)
- OTP generation uses Math.random. Audit states OTP uses Math.random; current OTP uses crypto.randomInt. Evidence: [apps/api/src/modules/auth/services/auth.service.ts](apps/api/src/modules/auth/services/auth.service.ts)
- Crypto helper duplication in auth.service.ts. Audit cites duplicate hashPassword/hashToken/redactIdentifier in auth.service.ts; current auth.service.ts contains none of those helpers and they live in commons/security/password.ts. Evidence: [apps/api/src/modules/auth/services/auth.service.ts](apps/api/src/modules/auth/services/auth.service.ts), [apps/api/src/commons/security/password.ts](apps/api/src/commons/security/password.ts)
- Access tokens are opaque (non-JWT). Audit states login generates opaque tokens while session auth expects JWT; current code signs JWT access tokens via signAccessToken and uses that on login/refresh. Evidence: [apps/api/src/modules/auth/services/auth.service.ts](apps/api/src/modules/auth/services/auth.service.ts), [apps/api/src/modules/auth/handlers/login.handler.ts](apps/api/src/modules/auth/handlers/login.handler.ts)
- Debt status transition uses "completed" instead of "paid". Audit flags mismatch in status transition map; current transition map uses "paid" and comments mention the fix. Evidence: [apps/api/src/modules/debts/services/debt.service.ts](apps/api/src/modules/debts/services/debt.service.ts)
- listDebts uses wrong filter key. Audit says list handler uses userId incorrectly; current list handler uses involvedUserId and adjusts for direction, plus batches user details. Evidence: [apps/api/src/modules/debts/handlers/list.handler.ts](apps/api/src/modules/debts/handlers/list.handler.ts)
- Two-party confirmation missing. Audit says confirm handler marks only one party or uses wrong flag; current confirm handler sets creditor/debtor flags and only flips status when both confirm. Evidence: [apps/api/src/modules/debts/handlers/confirm.handler.ts](apps/api/src/modules/debts/handlers/confirm.handler.ts)
- /check-debt endpoint missing. Audit says /check-debt is missing; current system routes expose /check-debt. Evidence: [apps/api/src/modules/system/routes.ts](apps/api/src/modules/system/routes.ts)
- Health service stub. Audit references health.service.ts stubs; current code uses system.service.ts with real checks and no health.service.ts file. Evidence: [apps/api/src/modules/system/services/system.service.ts](apps/api/src/modules/system/services/system.service.ts)
- Tokens stored in plaintext. Audit claims access/refresh tokens stored in plaintext; current schema stores accessTokenHash and refreshToken (hashed), and repo lookups are by hashes. Evidence: [packages/db/src/schema/session.schema.ts](packages/db/src/schema/session.schema.ts), [apps/api/src/repositories/auth/session.repo.ts](apps/api/src/repositories/auth/session.repo.ts)
- Auth handlers are class-based. Audit calls out class handlers; current auth handlers are split functional modules (login/register/password). Evidence: [apps/api/src/modules/auth/handlers/login.handler.ts](apps/api/src/modules/auth/handlers/login.handler.ts)

## Items still partially aligned with audits

- Legacy POST /data/import remains a stub in data.handler.ts; new preview/start endpoints exist but legacy path still returns placeholder results. Evidence: [apps/api/src/modules/data/handlers/data.handler.ts](apps/api/src/modules/data/handlers/data.handler.ts)

## Not re-verified here (keep on backlog)

- Notification repository stubs
- Repository-level validation (Valibot) in write paths
- Additional repository N+1 risks outside debts list
