declare module '~icons/lucide/*' {
	import type { SVGAttributes } from 'svelte/elements';

	const component: import('svelte').Component<SVGAttributes<SVGElement>>;
	export default component;
}
