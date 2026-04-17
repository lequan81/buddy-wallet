/**
 * API Routes Definition
 *
 * Centralized route registration for all API endpoints.
 * Follows RESTful conventions and groups by resource.
 */

import { Elysia } from 'elysia';
import { container } from 'tsyringe';

// Controllers
import {
  AuthController,
  DebtController,
  ExportController,
  ImportController,
  PublicController,
  UserController,
  PushController,
  BankController,
  StorageController,
  ActivityController,
  TracesController,
  SystemController
} from '@/app/Http/Controllers';

/**
 * Register all API routes
 */
export function registerApiRoutes(app: Elysia): Elysia {
  // Resolve DI-based controllers
  const authController = container.resolve(AuthController);
  const debtController = container.resolve(DebtController);
  const exportController = container.resolve(ExportController);
  const importController = container.resolve(ImportController);
  const publicController = container.resolve(PublicController);
  const userController = container.resolve(UserController);
  const pushController = container.resolve(PushController);
  const bankController = container.resolve(BankController);
  const storageController = container.resolve(StorageController);
  const systemController = container.resolve(SystemController);

  // Use instance-based controllers
  const activityController = ActivityController;
  const tracesController = TracesController;

  /**
   * V1 API Routes
   * Requires session-based authentication for protected routes
   */
  return app.group('/v1', (api) =>
    api
      // Public routes (no auth required)
      .use(publicController.register(new Elysia()))
      .use(authController.register(new Elysia())) // login, register, logout

      // Protected routes (auth required)
      .guard(
        {
          beforeHandle: ({ user, set }) => {
            if (!user) {
              set.status = 401;
              return { error: 'Unauthorized' };
            }
          }
        },
        (api) =>
          api
            // User management
            .use(userController.register(new Elysia()))

            // Debt management
            .use(debtController.register(new Elysia()))

            // Import/Export
            .use(importController.register(new Elysia()))
            .use(exportController.register(new Elysia()))

            // Push notifications
            .use(pushController.register(new Elysia()))

            // Bank/Payment
            .use(bankController.register(new Elysia()))

            // File storage/upload
            .use(storageController.register(new Elysia()))

            // Activity logging
            .use(activityController)

            // System traces
            .use(tracesController)
      )
  );
}
