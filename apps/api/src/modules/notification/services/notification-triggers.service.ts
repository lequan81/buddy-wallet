/**
 * Notification Triggers Service
 * @logicType backend
 *
 * Event-triggered notification functions that:
 * 1. Create in-app notifications in the database
 * 2. Enqueue push notification jobs to Redis (fire-and-forget)
 *
 * Used by debt handlers to notify users of relevant events.
 */
import { log } from '@repo/logger';
import { NotificationRepository } from '@/repositories/system/notification.repo';
import { enqueuePush } from './push.service';
import { db } from '@/providers/database';

const notificationRepo = new NotificationRepository(db);

// ── Types ────────────────────────────────────────────────────

interface DebtEvent {
  id: string;
  creditorId?: string | null;
  debtorId?: string | null;
  amount?: number;
  description?: string | null;
  uploadedById?: string;
  suggestedById?: string | null;
}

// ── Core Helper ──────────────────────────────────────────────

async function createAndPush(
  userId: string,
  title: string,
  message: string,
  type: string,
  resourceId: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    // 1. Create in-app notification (synchronous, in DB)
    await notificationRepo.create({
      userId,
      type,
      title,
      message,
      data: data ?? undefined
    });

    // 2. Enqueue push notification to Redis (fire-and-forget)
    enqueuePush(userId, {
      title,
      body: message,
      url: `/debts/${resourceId}`
    }).catch((err: unknown) => {
      log.error('NOTIFICATION', 'Push enqueue failed', { userId, error: String(err) });
    });
  } catch (err) {
    log.error('NOTIFICATION', 'Failed to create notification', { userId, type, error: String(err) });
  }
}

// ── Event Triggers ───────────────────────────────────────────

/**
 * Called after a debt is created.
 * Notifies the counterparty (the one who didn't create it).
 */
export async function onDebtCreated(
  debt: DebtEvent,
  creatorId: string
): Promise<void> {
  const targetUserId = debt.creditorId === creatorId ? debt.debtorId : debt.creditorId;
  if (!targetUserId) return; // Can't notify unregistered users

  const amountStr = debt.amount ? ` of ${debt.amount}` : '';
  await createAndPush(
    targetUserId,
    'New Debt Created',
    `A new debt${amountStr} has been created for you.`,
    'debt_created',
    debt.id,
    { debtId: debt.id }
  );
}

/**
 * Called after a debt is confirmed (both parties confirmed).
 * Notifies the other party.
 */
export async function onDebtConfirmed(
  debt: DebtEvent,
  confirmerId: string
): Promise<void> {
  const targetUserId = debt.creditorId === confirmerId ? debt.debtorId : debt.creditorId;
  if (!targetUserId) return;

  await createAndPush(
    targetUserId,
    'Debt Confirmed',
    'A debt has been confirmed by the other party.',
    'debt_confirmed',
    debt.id,
    { debtId: debt.id }
  );
}

/**
 * Called after an edit suggestion is submitted.
 * Notifies the debt uploader.
 */
export async function onSuggestionReceived(
  debt: DebtEvent,
  suggesterId: string
): Promise<void> {
  if (!debt.uploadedById || debt.uploadedById === suggesterId) return;

  await createAndPush(
    debt.uploadedById,
    'Edit Suggestion',
    'Someone has suggested an edit to your debt.',
    'suggestion_received',
    debt.id,
    { debtId: debt.id }
  );
}

/**
 * Called after a suggestion is accepted or rejected.
 * Notifies the suggester.
 */
export async function onSuggestionResponded(
  debt: DebtEvent,
  options: { accepted: boolean }
): Promise<void> {
  if (!debt.suggestedById) return;

  const { accepted } = options;
  const action = accepted ? 'accepted' : 'rejected';
  await createAndPush(
    debt.suggestedById,
    `Suggestion ${action}`,
    `Your edit suggestion has been ${action}.`,
    'suggestion_responded',
    debt.id,
    { debtId: debt.id, accepted }
  );
}

/**
 * Called after a debt is marked as paid.
 * Notifies the creditor.
 */
export async function onDebtPaid(
  debt: DebtEvent,
  payerId: string
): Promise<void> {
  if (!debt.creditorId || debt.creditorId === payerId) return;

  await createAndPush(
    debt.creditorId,
    'Debt Paid',
    'A debt has been marked as paid.',
    'debt_paid',
    debt.id,
    { debtId: debt.id }
  );
}
