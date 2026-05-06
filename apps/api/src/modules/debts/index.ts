import { Elysia } from 'elysia';
import { debtRoutes } from './routes';

export const debtsHandler = {
  register: () => new Elysia().use(debtRoutes)
};
