import { Elysia, t } from 'elysia';
import { db, users, eq } from '@repo/db';
import { accessControlPlugin } from '@plugins/access-control';

export const usersController = new Elysia({ prefix: '/users' })
  .use(accessControlPlugin)
  .get('/', async ({ user, set }) => {
    if (user?.role !== 'admin') {
      set.status = 403;
      return { success: false, message: 'Forbidden' };
    }
    const allUsers = await db.select().from(users).all();
    return { success: true, users: allUsers.map(({ password, ...u }) => u) };
  })
  .get(
    '/:id',
    async ({ params: { id }, set }) => {
      const user = await db.select().from(users).where(eq(users.id, id)).get();

      if (!user) {
        set.status = 404;
        return { success: false, message: 'User not found' };
      }

      // Hide sensitive data
      const { password, ...safeUser } = user;
      return { success: true, user: safeUser };
    },
    {
      params: t.Object({
        id: t.String()
      }),
      // Verify relationship: either Admin, Self, or Related by Debt
      ensureRelatedUser: 'id'
    }
  )
  .patch(
    '/:id/status',
    async ({ params: { id }, user, set }) => {
      // Admin only
      if (user?.role !== 'admin') {
        set.status = 403;
        return { success: false, message: 'Forbidden' };
      }

      // Get current user
      const targetUser = await db.select().from(users).where(eq(users.id, id)).get();
      if (!targetUser) {
        set.status = 404;
        return { success: false, message: 'User not found' };
      }

      // Toggle status
      const newStatus = !targetUser.isActive;
      await db
        .update(users)
        .set({ isActive: newStatus, updatedAt: new Date() })
        .where(eq(users.id, id));

      return { success: true, isActive: newStatus };
    },
    {
      params: t.Object({
        id: t.String()
      })
    }
  );
