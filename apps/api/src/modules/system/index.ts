import { Elysia } from 'elysia';
import { systemRoutes } from './routes';

export const systemHandler = {
  register: () => new Elysia().use(systemRoutes)
};
