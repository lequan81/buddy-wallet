import { edenTreaty } from '@elysiajs/eden';
import type { App } from '@repo/api'; 

export const createApi = (fetcher?: typeof fetch, token?: string) => {
    return edenTreaty<App>('http://localhost:3000', {
        fetcher,
        $fetch: {
            headers: {
                // Đính kèm token vào mọi request gửi lên Elysia
                Authorization: token ? `Bearer ${token}` : '',
            }
        }
    });
};