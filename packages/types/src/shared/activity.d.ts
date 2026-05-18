export type ActivityAction =
	| 'create'
	| 'update'
	| 'delete'
	| 'login'
	| 'logout'
	| 'login_failed'
	| 'export'
	| 'import'
	| 'import_preview'
	| 'status_change'
	| 'password_change'
	| 'logout_all'
	| 'delete_all'
	| 'register'
	| 'verify_email'
	| 'revoke_session'
	| 'confirm'
	| 'suggest_edit'
	| 'accept_suggestion'
	| 'reject_suggestion'
	| 'upload'
	| 'approve'
	| 'reject'
	| 'subscribe'
	| 'unsubscribe'
	| 'broadcast'
	| 'pending'
	| 'confirmed'
	| 'paid'
	| 'disputed'
	| 'cancelled'
	| string;

export type ActivityResource =
	| 'debt'
	| 'user'
	| 'session'
	| 'import'
	| 'export'
	| 'bank_account'
	| 'file'
	| 'push_subscription'
	| string;

export interface ActivityLog {
	readonly id: string;
	readonly userId: string;
	readonly action: ActivityAction;
	readonly resource: ActivityResource;
	readonly resourceId: string | null;
	readonly changes:
		| {
				readonly before?: Readonly<Record<string, unknown>>;
				readonly after?: Readonly<Record<string, unknown>>;
			}
		| null;
	readonly metadata: Readonly<Record<string, unknown>> | null;
	readonly ipAddress: string | null;
	readonly userAgent: string | null;
	readonly location: string | null;
	readonly createdAt: Date | string;
}

/**
 * Core Activity Type (Alias for ActivityLog)
 */
export type Activity = ActivityLog;
