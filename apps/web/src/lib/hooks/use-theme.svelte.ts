// src/lib/theme.svelte.ts
import { browser } from '$app/environment';
import type { Theme } from '$lib/types/app';

// Shared state - dùng chung cho toàn bộ app
let currentTheme = $state<Theme>(
    (browser && document.documentElement.classList.contains('dark')) ? 'dark' : 'light'
);

export function useTheme() {
    // Tự động đồng bộ hóa class "dark" và Cookie khi currentTheme thay đổi
    $effect(() => {
        if (!browser) return;

        const isDark = currentTheme === 'dark';
        
        // 1. Đồng bộ DOM
        document.documentElement.classList.toggle('dark', isDark);
        
        // 2. Đồng bộ Cookie (chỉ cần 1 dòng, không cần microtask)
        document.cookie = `site-theme=${currentTheme};path=/;max-age=31536000;SameSite=Lax`;
    });

    return {
        // Getter để giữ tính reactive
        get current() { return currentTheme; },
        get isDark() { return currentTheme === 'dark'; },
        
        toggle: () => {
            currentTheme = currentTheme === 'light' ? 'dark' : 'light';
        },
        
        set: (theme: Theme) => {
            currentTheme = theme;
        }
    };
}