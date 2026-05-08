# Frontend Audit Mismatch Report (2026-05-07)

Sources reviewed

- apps/web/.audit/FRONTEND_AUDIT_REPORT.md
- apps/web/frontend_errors.log

Current files checked

- apps/web/src/lib/services/api.ts
- apps/web/src/lib/services/api-envelope.ts
- apps/web/src/lib/remotes/auth.remote.ts
- apps/web/src/lib/remotes/banks.remote.ts
- apps/web/src/lib/remotes/dashboard.remote.ts
- apps/web/src/lib/remotes/debts.remote.ts
- apps/web/src/lib/remotes/notifications.remote.ts
- apps/web/src/lib/remotes/profile.remote.ts
- apps/web/src/lib/stores/import-progress.svelte.ts
- apps/web/src/lib/components/ThemeToggle.svelte
- apps/web/src/lib/components/forms/FormInput.svelte
- apps/web/src/lib/components/import/ImportHistoryTable.svelte
- apps/web/src/lib/components/layout/PageHeader.svelte
- apps/web/src/lib/components/dashboard/QuickActions.svelte
- apps/web/src/routes/(admin)/dashboard/+page.svelte
- apps/web/src/routes/(admin)/dashboard/import/+page.svelte
- apps/web/src/routes/(admin)/debts/[id]/+page.svelte
- apps/web/src/routes/(admin)/settings/banks/+page.svelte
- apps/web/src/routes/(admin)/admin/users/+page.server.ts
- apps/web/src/routes/(admin)/admin/users/[id]/+page.server.ts
- apps/web/src/routes/(admin)/admin/traces/+page.server.ts
- apps/web/src/routes/(admin)/dashboard/import/+page.server.ts
- apps/web/src/routes/(admin)/dashboard/preview/[id]/+page.server.ts
- apps/web/src/routes/(admin)/debts/[id]/confirmation/+page.server.ts
- apps/web/src/routes/(admin)/debts/create/+page.server.ts
- apps/web/src/routes/(admin)/settings/banks/+page.server.ts
- apps/web/src/routes/(app)/+page.svelte
- apps/web/src/routes/(app)/+page.server.ts
- apps/web/src/icons.d.ts
- packages/icons/src/index.ts
- apps/api/src/modules/debts/routes.ts
- apps/api/src/modules/user/routes.ts
- apps/api/src/modules/data/routes.ts
- apps/api/src/commons/http/response.ts
- apps/api/src/modules/system/handlers/check-debt.handler.ts

## Mismatches (audit vs current)

- Login logic broken (audit). Current login remote sets cookies and redirects normally; mustChangePassword only branches to change-password. Evidence: [apps/web/src/lib/remotes/auth.remote.ts](apps/web/src/lib/remotes/auth.remote.ts)
- Suggest/Respond debt routes missing (audit). Backend exposes /debts/:id/suggest and /debts/:id/suggestion/respond and frontend calls those paths. Evidence: [apps/api/src/modules/debts/routes.ts](apps/api/src/modules/debts/routes.ts), [apps/web/src/lib/remotes/debts.remote.ts](apps/web/src/lib/remotes/debts.remote.ts)
- Response envelope mismatch (audit). Backend uses { success, data, error } envelope and frontend extractApiData/extractApiErrorMessage expect that structure. Evidence: [apps/api/src/commons/http/response.ts](apps/api/src/commons/http/response.ts), [apps/web/src/lib/services/api-envelope.ts](apps/web/src/lib/services/api-envelope.ts)
- /check-debt exists but frontend expects a different payload (current mismatch). Backend returns { hasDebts, phone }, while UI expects { found, count, success }. Evidence: [apps/api/src/modules/system/handlers/check-debt.handler.ts](apps/api/src/modules/system/handlers/check-debt.handler.ts), [apps/web/src/routes/(app)/+page.svelte](apps/web/src/routes/(app)/+page.svelte)

## Type-check blockers and fix plan (no refactors executed)

- Eden Treaty typing: FlattenTreaty currently drops object members when a route node is callable, which hides .get/.post and causes errors on .debts.get, .debts.batch, .data.import, and .bank.accounts. Fix by adjusting ExtractObjectPart to preserve object keys (e.g., Omit<T, keyof Function> or a mapped type over keyof T) and re-check typings. Evidence: [apps/web/src/lib/services/api.ts](apps/web/src/lib/services/api.ts)
- API call shape usage: replace incorrect path forms with nested properties. Examples:
  - locals.api.v1.bank.accounts.post(payload) for create (no parentheses).
  - locals.api.v1.user.admin.users for admin list and detail (avoid ['admin/users']).
  - locals.api.v1.data.import.logs, locals.api.v1.data.import.preview, locals.api.v1.data.import({ id }).start.
  Evidence: [apps/web/src/lib/remotes/banks.remote.ts](apps/web/src/lib/remotes/banks.remote.ts), [apps/web/src/lib/remotes/dashboard.remote.ts](apps/web/src/lib/remotes/dashboard.remote.ts), [apps/web/src/routes/(admin)/dashboard/import/+page.server.ts](apps/web/src/routes/(admin)/dashboard/import/+page.server.ts)
- @repo/icons type declarations missing Moon and Sun. Add these exports to apps/web/src/icons.d.ts to match packages/icons exports. Evidence: [apps/web/src/icons.d.ts](apps/web/src/icons.d.ts), [packages/icons/src/index.ts](packages/icons/src/index.ts)
- FormInput prop spread too complex: restProps type intersects HTMLInputAttributes and UI Input Props. Narrow restProps type or cast when spreading into the Input component to avoid union explosion. Evidence: [apps/web/src/lib/components/forms/FormInput.svelte](apps/web/src/lib/components/forms/FormInput.svelte), [packages/ui/src/lib/components/ui/input/input.svelte](packages/ui/src/lib/components/ui/input/input.svelte)
- ImportHistoryTable uses ImportJob from store module but that type is not exported. Import ImportJob from @repo/types/infrastructure/jobs or re-export the type from the store. Evidence: [apps/web/src/lib/components/import/ImportHistoryTable.svelte](apps/web/src/lib/components/import/ImportHistoryTable.svelte), [apps/web/src/lib/stores/import-progress.svelte.ts](apps/web/src/lib/stores/import-progress.svelte.ts)
- PageHeader actions slot: actions is typed as (() => unknown) but {@render} expects a Snippet. Change actions type to Snippet (from svelte) or to (() => Snippet) and adjust usage. Evidence: [apps/web/src/lib/components/layout/PageHeader.svelte](apps/web/src/lib/components/layout/PageHeader.svelte)
- QuickActions expects createdAt as string; Debt uses Date | string. Widen RecentDebtItem to accept Date | string or map recentDebts to strings before passing. Evidence: [apps/web/src/lib/components/dashboard/QuickActions.svelte](apps/web/src/lib/components/dashboard/QuickActions.svelte), [packages/types/src/core/debt.d.ts](packages/types/src/core/debt.d.ts)
- debts/[id] page: tighten form typing and guards. Guard ActionData with typeof value === 'object' before using 'in', and widen FormWithMessage to include optional allProofsApproved/debtId. Also avoid constructing DebtDetailState when currentUser is null. Evidence: [apps/web/src/routes/(admin)/debts/[id]/+page.svelte](apps/web/src/routes/(admin)/debts/[id]/+page.svelte), [apps/web/src/routes/(admin)/debts/[id]/debt-detail.svelte.ts](apps/web/src/routes/(admin)/debts/[id]/debt-detail.svelte.ts)
- Banks page: accountName can be null; assign accountName = account.accountName ?? '' to satisfy type. Evidence: [apps/web/src/routes/(admin)/settings/banks/+page.svelte](apps/web/src/routes/(admin)/settings/banks/+page.svelte), [packages/types/src/core/bank.d.ts](packages/types/src/core/bank.d.ts)
- /check-debt UI: align UI expectations with backend response. Update UI to use hasDebts and remove count-based messaging, or extend backend to return count/found for the UI. Evidence: [apps/web/src/routes/(app)/+page.svelte](apps/web/src/routes/(app)/+page.svelte), [apps/web/src/routes/(app)/+page.server.ts](apps/web/src/routes/(app)/+page.server.ts)
- Profile/notifications update: backend UpdateProfileSchema only accepts name/email, but frontend sends phoneNumber and notification flags. Either expand schema/handler to accept those fields or create dedicated endpoints and update frontend. Evidence: [apps/api/src/modules/user/schema.ts](apps/api/src/modules/user/schema.ts), [apps/api/src/modules/user/handlers/profile.handler.ts](apps/api/src/modules/user/handlers/profile.handler.ts), [apps/web/src/lib/remotes/profile.remote.ts](apps/web/src/lib/remotes/profile.remote.ts), [apps/web/src/lib/remotes/notifications.remote.ts](apps/web/src/lib/remotes/notifications.remote.ts)
- Admin traces loader: data is typed as {} so 'error' in data triggers TS error. Add runtime guards and typed shape extraction for traces. Evidence: [apps/web/src/routes/(admin)/admin/traces/+page.server.ts](apps/web/src/routes/(admin)/admin/traces/+page.server.ts)

## State-machine removal (proposal only)

- Replace the auth-resolution machine with a plain status enum in hooks.server.ts and a small helper for transitions (no separate machine object). Evidence: [apps/web/src/lib/state-machines/auth-resolution.machine.ts](apps/web/src/lib/state-machines/auth-resolution.machine.ts), [apps/web/src/hooks.server.ts](apps/web/src/hooks.server.ts)
- Replace import upload/workflow machines with simple guard functions and direct state assignments inside the import store and page. Keep transition rules as static maps, but remove the machine wrappers and transition objects. Evidence: [apps/web/src/lib/state-machines/import-upload.machine.ts](apps/web/src/lib/state-machines/import-upload.machine.ts), [apps/web/src/lib/state-machines/import-workflow.machine.ts](apps/web/src/lib/state-machines/import-workflow.machine.ts)
