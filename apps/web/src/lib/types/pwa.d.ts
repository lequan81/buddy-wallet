/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/info" />

// PWA Assets Generator types
// @see https://vite-pwa-org.netlify.app/assets-generator/
declare module 'virtual:pwa-assets/head' {
	export interface PWAAssetHead {
		links: Array<{
			id?: string;
			rel: string;
			href: string;
			media?: string;
			sizes?: string;
			type?: string;
		}>;
	}
	export const pwaAssetsHead: PWAAssetHead;
}

declare module 'virtual:pwa-assets/icons' {
	export interface PWAAssetIcon {
		src: string;
		sizes: string;
		type: string;
		purpose?: string;
	}
	export const pwaAssetsIcons: PWAAssetIcon[];
}

declare module 'virtual:pwa-info' {
	export interface PwaInfo {
		pwaInDevEnvironment: boolean;
		webManifest: {
			href: string;
			useCredentials: boolean;
			linkTag: string;
		};
		registerSW: {
			inline: boolean;
			inlinePath: string;
			registerPath: string;
			scope: string;
			type: string;
		};
	}
	const pwaInfo: PwaInfo | undefined;
	export { pwaInfo };
}
