import {
	Dialog,
	DialogTrigger,
	DialogClose,
	DialogTitle,
	DialogDescription,
	DialogHeader,
	DialogFooter,
	DialogOverlay
	// We don't export Portal because we use custom one internally
} from '@repo/ui/components/ui/dialog';

import DialogContent from './dialog-content.svelte';
import DialogPortal from './custom-portal.svelte';

export {
	Dialog,
	DialogTrigger,
	DialogClose,
	DialogTitle,
	DialogDescription,
	DialogHeader,
	DialogFooter,
	DialogOverlay,
	DialogContent,
	DialogPortal,
	// Aliases
	Dialog as Root,
	DialogTrigger as Trigger,
	DialogClose as Close,
	DialogTitle as Title,
	DialogDescription as Description,
	DialogHeader as Header,
	DialogFooter as Footer,
	DialogOverlay as Overlay,
	DialogContent as Content,
	DialogPortal as Portal
};
