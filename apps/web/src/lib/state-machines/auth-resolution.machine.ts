export type AuthResolutionState =
	| 'idle'
	| 'resolving'
	| 'authenticated'
	| 'unauthenticated'
	| 'offline';

export type AuthResolutionEvent =
	| 'START'
	| 'USER_RESOLVED'
	| 'NO_USER'
	| 'TIMEOUT'
	| 'NETWORK_ERROR';

const TRANSITIONS: Record<AuthResolutionState, Partial<Record<AuthResolutionEvent, AuthResolutionState>>> = {
	idle: {
		START: 'resolving'
	},
	resolving: {
		USER_RESOLVED: 'authenticated',
		NO_USER: 'unauthenticated',
		TIMEOUT: 'offline',
		NETWORK_ERROR: 'offline'
	},
	authenticated: {
		TIMEOUT: 'offline',
		NETWORK_ERROR: 'offline'
	},
	unauthenticated: {
		START: 'resolving',
		TIMEOUT: 'offline',
		NETWORK_ERROR: 'offline'
	},
	offline: {
		START: 'resolving',
		USER_RESOLVED: 'authenticated',
		NO_USER: 'unauthenticated'
	}
};

export function transitionAuthResolution(
	state: AuthResolutionState,
	event: AuthResolutionEvent
): AuthResolutionState {
	return TRANSITIONS[state][event] ?? state;
}

export function createAuthResolutionMachine(initial: AuthResolutionState = 'idle') {
	let current = initial;

	return {
		getState(): AuthResolutionState {
			return current;
		},
		send(event: AuthResolutionEvent): AuthResolutionState {
			current = transitionAuthResolution(current, event);
			return current;
		}
	};
}
