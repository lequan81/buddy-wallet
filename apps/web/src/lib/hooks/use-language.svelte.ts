// src/lib/hooks/use-language.svelte.ts
import { SvelteMap } from 'svelte/reactivity';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { browser } from '$app/environment';
import {
	getLocale,
	setLocale,
	locales,
	overwriteGetLocale,
	localizeHref,
	type Locale
} from '$lib/paraglide/runtime';

// 1. Singleton State: Đảm bảo toàn bộ app dùng chung một nguồn sự thật
let currentLocaleState = $state<Locale>(getLocale());

// Đồng bộ hóa Paraglide với Svelte 5 Rune
overwriteGetLocale(() => currentLocaleState);

// 2. Cache cho Intl.DisplayNames: Tránh khởi tạo lại vật lý trên chip yếu
const labelCache = new SvelteMap<string, string>();

export function useLanguage() {
	return {
		get all() {
			return locales;
		},
		get current() {
			return currentLocaleState;
		},

		/**
		 * Lấy nhãn ngôn ngữ với cơ chế Cache
		 */
		getLabel(lang: string) {
			if (labelCache.has(lang)) return labelCache.get(lang);

			try {
				// Chỉ khởi tạo Intl khi thực sự cần và lưu vào bộ nhớ
				const displayNames = new Intl.DisplayNames([lang], { type: 'language' });
				const label = displayNames.of(lang) || lang;
				labelCache.set(lang, label);
				return label;
			} catch (_) {
				return lang.toUpperCase();
			}
		},

		/**
		 * Chuyển đổi ngôn ngữ mượt mà (Soft Navigation)
		 */
		async set(lang: string) {
			const nextLocale = lang as Locale;
			if (nextLocale === currentLocaleState || !browser) return;

			// 1. Tính toán URL mới trước
			const nextHref = localizeHref(page.url.pathname, { locale: nextLocale });

			// 2. Cập nhật đồng thời: State UI, Paraglide Runtime và Cookie
			// Việc gom nhóm này giúp giảm thiểu số lần Re-render
			currentLocaleState = nextLocale;
			await setLocale(nextLocale, { reload: false });

			document.cookie = `PARAGLIDE_LOCALE=${nextLocale};path=/;max-age=31536000;SameSite=Lax`;

			// 3. Chuyển hướng không reload (UX như Native App)
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			return goto(nextHref, {
				replaceState: true,
				noScroll: true,
				keepFocus: true,
				invalidateAll: true // Đảm bảo dữ liệu từ server (load functions) được fetch lại theo ngôn ngữ mới
			});
		}
	};
}
