import { Dialog as DialogPrimitive } from 'bits-ui';

import DialogContent from './dialog-content.svelte';
import DialogPortal from './custom-portal.svelte';
import DialogOverlay from './dialog-overlay.svelte';
import DialogHeader from './dialog-header.svelte';
import DialogFooter from './dialog-footer.svelte';
import DialogTitle from './dialog-title.svelte';
import DialogDescription from './dialog-description.svelte';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

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
