import type { Component } from 'svelte';

export type ContentType = 'pages' | 'posts' | 'marketing';

export interface ContentMetadata {
	title: string;
	description?: string;
	date?: string;
	author?: string;
	image?: string;
	slug?: string;
	[key: string]: unknown;
}

export interface Content {
	component: Component; // Svelte Component
	metadata: ContentMetadata;
}
