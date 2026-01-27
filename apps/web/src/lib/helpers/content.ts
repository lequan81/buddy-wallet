import { error } from '@sveltejs/kit';
import type { Component } from 'svelte';
import type { Content, ContentMetadata, ContentType } from '../types/content';

// Pre-import all markdown files with eager loading so mdsvex processes them
const marketingModules = import.meta.glob('/src/contents/marketing/*.md', { eager: true }) as Record<
	string,
	{ default: Component; metadata: ContentMetadata }
>;
const pagesModules = import.meta.glob('/src/contents/pages/*.md', { eager: true }) as Record<
	string,
	{ default: Component; metadata: ContentMetadata }
>;
const postsModules = import.meta.glob('/src/contents/posts/*.md', { eager: true }) as Record<
	string,
	{ default: Component; metadata: ContentMetadata }
>;

/**
 * Get a single content file by slug and type.
 * @param type The type of content folder (e.g., 'pages', 'posts')
 * @param slug The filename without extension
 */
export async function getContent(type: ContentType, slug: string): Promise<Content> {
	let modules: Record<string, { default: Component; metadata: ContentMetadata }>;

	switch (type) {
		case 'pages':
			modules = pagesModules;
			break;
		case 'posts':
			modules = postsModules;
			break;
		case 'marketing':
			modules = marketingModules;
			break;
		default:
			throw error(500, { code: 500, message: `Unknown content type: ${type}` });
	}

	const path = `/src/contents/${type}/${slug}.md`;
	const file = modules[path];

	if (!file) {
		throw error(404, { code: 404, message: `Content not found: ${path}` });
	}

	return {
		component: file.default,
		metadata: file.metadata
	};
}

/**
 * Get all content metadata for a specific type (e.g. list of blog posts)
 */
export async function getContents(type: ContentType): Promise<ContentMetadata[]> {
	let modules: Record<string, { default: Component; metadata: ContentMetadata }>;

	switch (type) {
		case 'pages':
			modules = pagesModules;
			break;
		case 'posts':
			modules = postsModules;
			break;
		case 'marketing':
			modules = marketingModules;
			break;
		default:
			return [];
	}

	const contents: ContentMetadata[] = [];

	for (const path in modules) {
		const file = modules[path];
		// Add slug to metadata derived from filename
		const slug = path.split('/').pop()?.replace('.md', '');
		contents.push({
			...file.metadata,
			slug
		});
	}

	return contents;
}
