import { Elysia } from 'elysia';
import { userRoutes } from './routes';

export const userHandler = {
  register: () => new Elysia().use(userRoutes)
};
