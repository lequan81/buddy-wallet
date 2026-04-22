/**
 * Notification Service
 *
 * Handles event-driven notifications via @OnEvent decorators.
 * Listens for domain events and sends push notifications to users.
 */
import { injectable, inject } from 'tsyringe';
import { logger } from '@repo/logger';
import { OnEvent } from '@/lib/decorators/on-event';
import { Retryable } from '@/lib/decorators/retryable';
import { PushService } from './PushService';
import type {
  DebtCreatedEvent,
  DebtConfirmedEvent,
  DebtPaidEvent,
  DebtCancelledEvent,
  UserRegisteredEvent
} from '@/app/Providers/EventServiceProvider';

@injectable()
export class NotificationService {
  constructor(
    @inject(PushService) private readonly pushService: PushService
  ) {}

  /**
   * Handle debt.created event
   * Sends notification to counterparty when a new debt is created
   */
  @OnEvent('debt.created')
  @Retryable({ maxAttempts: 3, backoffMs: 1000 })
  async handleDebtCreated(event: DebtCreatedEvent): Promise<void> {
    logger.app('NotificationService: Handling debt.created event', {
      debtId: event.debtId,
      creditorId: event.creditorId,
      debtorId: event.debtorId
    });

    // Notify the debtor that a debt was recorded against them
    if (event.debtorId) {
      await this.pushService.sendToUser(event.debtorId, {
        title: 'New Debt Recorded',
        body: `A debt of ${event.amount} has been recorded. You are listed as the debtor.`,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        tag: `debt-created-${event.debtId}`,
        url: `/debts/${event.debtId}`,
        data: { debtId: event.debtId, type: 'debt_created' },
        requireInteraction: true
      });
    }

    // Notify the creditor that they recorded a debt
    if (event.creditorId) {
      await this.pushService.sendToUser(event.creditorId, {
        title: 'Debt Recorded Successfully',
        body: `You've recorded a debt of ${event.amount}.`,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        tag: `debt-recorded-${event.debtId}`,
        url: `/debts/${event.debtId}`,
        data: { debtId: event.debtId, type: 'debt_recorded' }
      });
    }
  }

  /**
   * Handle debt.confirmed event
   * Notifies the debt creator when counterparty confirms
   */
  @OnEvent('debt.confirmed')
  @Retryable({ maxAttempts: 3, backoffMs: 1000 })
  async handleDebtConfirmed(event: DebtConfirmedEvent): Promise<void> {
    logger.app('NotificationService: Handling debt.confirmed event', {
      debtId: event.debtId,
      aggregateId: event.aggregateId
    });

    // Notify the user who recorded the debt that it was confirmed
    await this.pushService.sendToUser(event.aggregateId, {
      title: 'Debt Confirmed',
      body: 'Your counterparty has confirmed the debt.',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: `debt-confirmed-${event.debtId}`,
      url: `/debts/${event.debtId}`,
      data: { debtId: event.debtId, type: 'debt_confirmed' }
    });
  }

  /**
   * Handle debt.paid event
   * Notifies both parties when debt is marked as paid
   */
  @OnEvent('debt.paid')
  @Retryable({ maxAttempts: 3, backoffMs: 1000 })
  async handleDebtPaid(event: DebtPaidEvent): Promise<void> {
    logger.app('NotificationService: Handling debt.paid event', {
      debtId: event.debtId,
      aggregateId: event.aggregateId
    });

    // Notify the other party that debt is paid
    await this.pushService.sendToUser(event.aggregateId, {
      title: 'Debt Marked as Paid',
      body: 'A debt has been marked as paid.',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: `debt-paid-${event.debtId}`,
      url: `/debts/${event.debtId}`,
      data: { debtId: event.debtId, type: 'debt_paid' }
    });
  }

  /**
   * Handle debt.cancelled event
   * Notifies debtor when creditor cancels
   */
  @OnEvent('debt.cancelled')
  @Retryable({ maxAttempts: 3, backoffMs: 1000 })
  async handleDebtCancelled(event: DebtCancelledEvent): Promise<void> {
    logger.app('NotificationService: Handling debt.cancelled event', {
      debtId: event.debtId,
      aggregateId: event.aggregateId
    });

    // Notify the other party that debt was cancelled
    await this.pushService.sendToUser(event.aggregateId, {
      title: 'Debt Cancelled',
      body: 'A debt has been cancelled by the counterparty.',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: `debt-cancelled-${event.debtId}`,
      url: `/debts/${event.debtId}`,
      data: { debtId: event.debtId, type: 'debt_cancelled' }
    });
  }

  /**
   * Handle user.registered event
   * Sends welcome notification to new user
   */
  @OnEvent('user.registered')
  @Retryable({ maxAttempts: 3, backoffMs: 1000 })
  async handleUserRegistered(event: UserRegisteredEvent): Promise<void> {
    logger.app('NotificationService: Handling user.registered event', {
      userId: event.userId,
      email: event.email
    });

    // Send welcome notification
    await this.pushService.sendToUser(event.userId, {
      title: 'Welcome to BuddyWallet!',
      body: `Welcome ${event.phoneNumber || 'new user'}! Start tracking your debts easily.`,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: 'welcome',
      url: '/',
      data: { userId: event.userId, type: 'welcome' },
      requireInteraction: false
    });
  }
}
