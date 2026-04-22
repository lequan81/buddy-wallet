import 'reflect-metadata';

export function OnEvent(eventName: string) {
  return function (target: any, propertyKey: string) {
    const existing = Reflect.getMetadata('eventListeners', target.constructor) || [];
    existing.push({ event: eventName, handler: propertyKey });
    Reflect.defineMetadata('eventListeners', existing, target.constructor);
  };
}

