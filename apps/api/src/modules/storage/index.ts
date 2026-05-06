import { Elysia } from 'elysia';
import { storageRoutes } from './routes';

export const storageHandler = {
  register: () => new Elysia().use(storageRoutes)
};
