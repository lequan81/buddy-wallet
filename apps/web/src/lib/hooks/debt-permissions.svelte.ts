import type { CurrentUser } from '@repo/types';
import { DEBT_STATUS } from '@repo/config';

interface DebtLike {
	uploadedById: string;
	creditorId?: string | null;
	creditorPhone?: string | null;
	debtorId?: string | null;
	debtorPhone?: string | null;
	status: string;
}

export function useDebtPermissions(debt: DebtLike, user: CurrentUser) {
	const isUploader = $derived(debt.uploadedById === user.id);
	const isCreditor = $derived(
		debt.creditorId === user.id || debt.creditorPhone === user.phoneNumber
	);
	const isDebtor = $derived(debt.debtorId === user.id || debt.debtorPhone === user.phoneNumber);
	const status = $derived(debt.status?.toLowerCase());

	return {
		isUploader,
		isCreditor,
		isDebtor,
		canEdit: $derived(isUploader && status === DEBT_STATUS.PENDING),
		canDelete: $derived(isUploader && status !== DEBT_STATUS.PAID),
		canSuggestEdit: $derived(
			!isUploader && (isCreditor || isDebtor) && status !== DEBT_STATUS.PAID && status !== DEBT_STATUS.CANCELLED
		),
		canConfirm: $derived(!isUploader && (isCreditor || isDebtor) && status === DEBT_STATUS.PENDING)
	};
}
