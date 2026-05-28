import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';

import AlertDialogContent from './alert-dialog-content.svelte';
import AlertDialogPortal from './alert-dialog-portal.svelte';
import AlertDialogOverlay from './alert-dialog-overlay.svelte';
import AlertDialogHeader from './alert-dialog-header.svelte';
import AlertDialogFooter from './alert-dialog-footer.svelte';
import AlertDialogTitle from './alert-dialog-title.svelte';
import AlertDialogDescription from './alert-dialog-description.svelte';
import AlertDialogAction from './alert-dialog-action.svelte';
import AlertDialogCancel from './alert-dialog-cancel.svelte';

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

export {
	AlertDialog,
	AlertDialogTrigger,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogHeader,
	AlertDialogFooter,
	AlertDialogOverlay,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogPortal,
	// Aliases
	AlertDialog as Root,
	AlertDialogTrigger as Trigger,
	AlertDialogTitle as Title,
	AlertDialogDescription as Description,
	AlertDialogHeader as Header,
	AlertDialogFooter as Footer,
	AlertDialogOverlay as Overlay,
	AlertDialogAction as Action,
	AlertDialogCancel as Cancel,
	AlertDialogContent as Content,
	AlertDialogPortal as Portal
};
