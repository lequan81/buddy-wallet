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
	id: string;
	userId: string;
	action: ActivityAction;
	resource: ActivityResource;
	resourceId: string | null;
	changes:
		| {
				before?: Record<string, unknown>;
				after?: Record<string, unknown>;
			}
		| null;
	metadata: Record<string, unknown> | null;
	ipAddress: string | null;
	userAgent: string | null;
	location: string | null;
	createdAt: Date | string;
}

/**
 * Core Activity Type (Alias for ActivityLog)
 */
export type Activity = ActivityLog;
