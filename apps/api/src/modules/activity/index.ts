import { Elysia } from 'elysia';
import { activityRoutes } from './routes';

export const activityHandler = {
  register: () => new Elysia().use(activityRoutes)
};
