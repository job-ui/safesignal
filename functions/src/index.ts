import { initializeApp } from 'firebase-admin/app';

// Initialise Firebase Admin SDK once for all functions
initializeApp();

export { inactivityChecker } from './inactivityChecker';
export { locationCleanup } from './locationCleanup';
export { locationRequestTimeout } from './locationRequestTimeout';
export { inviteHandler } from './inviteHandler';
export { heartbeatHTTP } from './heartbeatHTTP';
