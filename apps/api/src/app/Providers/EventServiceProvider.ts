/**
 * Event Service Provider
 *
 * Auto-discovers and registers event listeners marked with @OnEvent decorator.
 * Enables decoupled communication between services.
 */

import { container } from 'tsyringe';
import 'reflect-metadata';
import { logger } from '@repo/logger';

/**
 * Domain event interface
 */
export interface DomainEvent {
  type: string;
  timestamp: Date;
  aggregateId?: string;
}

/**
 * Event listener callback - uses contravariant typing for event parameter
 */
export type EventListener<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void> | void;

type AnyEventListener = (event: DomainEvent) => Promise<void> | void;

/**
 * Simple in-memory event bus
 * For microservices, replace with Redis, RabbitMQ, or SQS
 */
export class EventBus {
  private listeners: Map<string, AnyEventListener[]> = new Map();

  /**
   * Register event listener
   */
  on(eventType: string, listener: AnyEventListener): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);
  }

  /**
   * Unregister event listener
   */
  off(eventType: string, listener: AnyEventListener): void {
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

    // Services to scan for @OnEvent decorators
    const servicesToScan = [
      'NotificationService'
    ];

    for (const serviceName of servicesToScan) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const service = container.resolve<Record<string, (event: DomainEvent) => Promise<void> | void>>(serviceName as any);
        const constructor = service.constructor;

        // Get event listeners metadata from @OnEvent decorator
        const listeners = Reflect.getMetadata('eventListeners', constructor) as Array<{ event: string; handler: string }> | undefined;

        if (listeners && Array.isArray(listeners)) {
          for (const listener of listeners) {
            // Bind the handler to the service instance and register with event bus
            const boundHandler = service[listener.handler].bind(service) as AnyEventListener;
            eventBus.on(listener.event, boundHandler);
            logger.app(`Registered event listener: ${constructor.name}.${listener.handler} for '${listener.event}'`);
          }
        }
      } catch (error) {
        // Service might not be registered, skip
        logger.debug(`Could not scan service ${serviceName} for event listeners`, { error: String(error) });
      }
    }
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

