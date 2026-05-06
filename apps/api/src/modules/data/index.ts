import { Elysia } from 'elysia';
import { dataRoutes } from './routes';

export const dataHandler = {
  register: () => new Elysia().use(dataRoutes)
};
