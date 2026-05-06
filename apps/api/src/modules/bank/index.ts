import { Elysia } from 'elysia';
import { bankRoutes } from './routes';

export const bankHandler = {
  register: () => new Elysia().use(bankRoutes)
};
