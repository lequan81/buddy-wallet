/// <reference lib="webworker" />

import { initCaching } from './caching';
import { initPushNotifications } from './push-notifications';
import { initLifecycle } from './lifecycle';

declare let self: ServiceWorkerGlobalScope;

// Initialize all service worker modules
initCaching();
initPushNotifications();
initLifecycle();

