/**
 * Event Service Provider
 *
 * Auto-discovers and registers event listeners marked with @OnEvent decorator.
 * Enables decoupled communication between services.
 */

import { container } from 'tsyringe';
import 'reflect-metadata';

/**
 * Domain event interface
 */
export interface DomainEvent {
  type: string;
  timestamp: Date;
  aggregateId?: string;
  [key: string]: any;
}

/**
 * Event listener callback
 */
export type EventListener<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void> | void;

/**
 * Simple in-memory event bus
 * For microservices, replace with Redis, RabbitMQ, or SQS
 */
export class EventBus {
  private listeners: Map<string, EventListener[]> = new Map();

  /**
   * Register event listener
   */
  on<T extends DomainEvent>(eventType: string, listener: EventListener<T>): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);
  }

  /**
   * Unregister event listener
   */
  off<T extends DomainEvent>(eventType: string, listener: EventListener<T>): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all listeners
   */
  async emit<T extends DomainEvent>(event: T): Promise<void> {
    const listeners = this.listeners.get(event.type) || [];

    // Fire and forget, but catch errors to prevent one listener failure from blocking others
    await Promise.allSettled(
      listeners.map((listener) =>
        Promise.resolve().then(() => listener(event))
      )
    );
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear();
  }
}

/**
 * Event Service Provider
 * Registers event bus and auto-discovers @OnEvent listeners
 */
export class EventServiceProvider {
  /**
   * Register event bus as singleton
   */
  register(): void {
    container.register('EventBus', {
      useValue: new EventBus()
    });
  }

  /**
   * Boot: Auto-discover and register @OnEvent listeners
   */
  async boot(): Promise<void> {
    const eventBus = container.resolve<EventBus>('EventBus');

    // Listeners will be registered when services are instantiated
    // via the @OnEvent decorator and resolved by the container

    // Example: If NotificationService has @OnEvent('debt.created'),
    // it gets automatically registered when resolved from container
  }
}

/**
 * Domain events
 */
export class DebtCreatedEvent implements DomainEvent {
  type = 'debt.created';
  timestamp = new Date();

  constructor(
    public aggregateId: string,
    public debtId: string,
    public creditorId: string,
    public debtorId: string,
    public amount: number
  ) {}
}

export class DebtConfirmedEvent implements DomainEvent {
  type = 'debt.confirmed';
  timestamp = new Date();

  constructor(
    public aggregateId: string,
    public debtId: string
  ) {}
}

export class DebtPaidEvent implements DomainEvent {
  type = 'debt.paid';
  timestamp = new Date();

  constructor(
    public aggregateId: string,
    public debtId: string
  ) {}
}

export class DebtCancelledEvent implements DomainEvent {
  type = 'debt.cancelled';
  timestamp = new Date();

  constructor(
    public aggregateId: string,
    public debtId: string
  ) {}
}

export class UserRegisteredEvent implements DomainEvent {
  type = 'user.registered';
  timestamp = new Date();

  constructor(
    public aggregateId: string,
    public userId: string,
    public email: string,
    public phoneNumber: string
  ) {}
}
