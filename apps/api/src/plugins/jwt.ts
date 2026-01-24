import { Elysia, t, type Static } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { bearer } from '@elysiajs/bearer';
import { db, users, eq } from '@repo/db';
import { configs } from '../configs';

/**
 * 1. Define the structure of our JWT Payload
 * Tách riêng để các file khác có thể import và ép kiểu dữ liệu
 */
export const jwtPayloadSchema = t.Object({
  id: t.String({ description: 'User unique identifier from Database' }),
  iat: t.Optional(t.Number()), // Issued at
  exp: t.Optional(t.Number()) // Expiration time
});

// Tạo type từ Schema để dùng trong TypeScript
export type JWTPayload = Static<typeof jwtPayloadSchema>;

/**
 * 2. JWT Security Provider Plugin
 * Cấu hình chi tiết Secret và Schema
 */
export const jwtPlugin = new Elysia({ name: 'JWT_Plugin' })
  .use(
    jwt({
      name: 'jwt', // Helper name in context (e.g., context.jwt)
      secret: configs.JWT_SECRET || 'ZaXIyUxCQqhgfKFcmLB6GTJ27PvdserD',
      schema: jwtPayloadSchema,
      exp: '7d' // Thời gian hết hạn token (ví dụ 7 ngày)
    })
  )
  .use(bearer())
  .derive(
    async ({
      jwt,
      bearer,
      cookie: { session }
    }): Promise<{ user: typeof users.$inferSelect | null }> => {
      // 1. Prioritize Bearer Token (API/Server-to-Server)
      let token = bearer;

      // 2. Fallback to Session Cookie (Browser)
      if (!token && session && session.value) {
        token = String(session.value);
      }

      // Debug logging
      console.error(
        `[JWT-PLUGIN] Checking auth. Bearer: ${!!bearer}, Session: ${!!(session && session.value)}`
      );
      if (!token) console.error('[JWT-PLUGIN] No token found in request');
      else console.error(`[JWT-PLUGIN] Token found (len=${token.length}), verifying...`);

      if (!token) return { user: null };

      const payload = await jwt.verify(token);
      if (!payload) return { user: null };

      const user = db.select().from(users).where(eq(users.id, payload.id)).get();

      return { user: user || null };
    }
  );
