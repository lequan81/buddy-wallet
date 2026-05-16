import { Elysia } from 'elysia';
import { proofRoutes } from './routes';

export const proofHandler = {
  register: () => new Elysia().use(proofRoutes)
};
