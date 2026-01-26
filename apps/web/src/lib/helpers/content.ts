import { error } from '@sveltejs/kit';
import type { Component } from 'svelte';
import type { Content, ContentMetadata, ContentType } from '../types/content';

/**
 * Get a single content file by slug and type.
 * @param type The type of content folder (e.g., 'pages', 'posts')
 * @param slug The filename without extension
 */
export async function getContent(type: ContentType, slug: string): Promise<Content> {
	// Define expected structure for mdsvex modules
	type GlobImport = { default: Component; metadata: unknown };
	let modules: Record<string, () => Promise<GlobImport>>;

	// Mapping types to glob imports (static analysis requires string literals)
	switch (type) {
		case 'pages':
			modules = import.meta.glob('/src/contents/pages/*.md') as Record<
				string,
				() => Promise<GlobImport>
			>;
			break;
		case 'posts':
			modules = import.meta.glob('/src/contents/posts/*.md') as Record<
				string,
				() => Promise<GlobImport>
			>;
			break;
		case 'marketing':
			modules = import.meta.glob('/src/contents/marketing/*.md') as Record<
				string,
				() => Promise<GlobImport>
			>;
			break;
		default:
			throw error(500, { code: 500, message: `Unknown content type: ${type}` });
	}

	const path = `/src/contents/${type}/${slug}.md`;
	const resolver = modules[path];

	if (!resolver) {
		throw error(404, { code: 404, message: `Content not found: ${path}` });
	}

	const file = await resolver();

	return {
		component: file.default as Component,
		metadata: file.metadata as ContentMetadata
	};
}

/**
 * Get all content metadata for a specific type (e.g. list of blog posts)
 */
export async function getContents(type: ContentType): Promise<ContentMetadata[]> {
	type GlobImport = { default: Component; metadata: unknown };
	let modules: Record<string, () => Promise<GlobImport>>;

	switch (type) {
		case 'pages':
			modules = import.meta.glob('/src/contents/pages/*.md') as Record<
				string,
				() => Promise<GlobImport>
			>;
			break;
		case 'posts':
			modules = import.meta.glob('/src/contents/posts/*.md') as Record<
				string,
				() => Promise<GlobImport>
			>;
			break;
		case 'marketing':
			modules = import.meta.glob('/src/contents/marketing/*.md') as Record<
				string,
				() => Promise<GlobImport>
			>;
			break;
		default:
			return [];
	}

	const contents: ContentMetadata[] = [];

	for (const path in modules) {
		const resolver = modules[path];
		const file = await resolver();
		// Add slug to metadata derived from filename
		const slug = path.split('/').pop()?.replace('.md', '');
		const metadata = file.metadata as ContentMetadata;
		contents.push({
			...metadata,
			slug
		});
	}

	return contents;
}
