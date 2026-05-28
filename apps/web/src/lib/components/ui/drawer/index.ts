import { Dialog as DialogPrimitive } from 'bits-ui';
import Content from './drawer-content.svelte';
import Header from '../dialog/dialog-header.svelte';
import Footer from '../dialog/dialog-footer.svelte';
import Title from '../dialog/dialog-title.svelte';
import Description from '../dialog/dialog-description.svelte';

const Root = DialogPrimitive.Root;
const Trigger = DialogPrimitive.Trigger;
const Close = DialogPrimitive.Close;

export {
	Root,
	Trigger,
	Close,
	Content,
	Header,
	Footer,
	Title,
	Description,
	//
	Root as Drawer,
	Trigger as DrawerTrigger,
	Close as DrawerClose,
	Content as DrawerContent,
	Header as DrawerHeader,
	Footer as DrawerFooter,
	Title as DrawerTitle,
	Description as DrawerDescription
};
