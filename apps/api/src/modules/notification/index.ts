import { Elysia } from 'elysia';
import { notificationRoutes } from './routes';

export const notificationHandler = {
  register: () => new Elysia().use(notificationRoutes)
};
