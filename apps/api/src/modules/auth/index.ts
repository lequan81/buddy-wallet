import { Elysia } from 'elysia';
import { authRoutes } from './routes';

export const authHandler = {
  register: () => new Elysia().use(authRoutes)
};
