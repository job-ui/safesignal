import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';

// Initialise Firebase Admin SDK once for all functions
initializeApp();

// Apply global options to all v2 functions
setGlobalOptions({
  maxInstances: 10,
  region: 'europe-west1',
});

export { inactivityChecker } from './inactivityChecker';
export { locationCleanup } from './locationCleanup';
export { locationRequestTimeout } from './locationRequestTimeout';
export { inviteHandler } from './inviteHandler';
