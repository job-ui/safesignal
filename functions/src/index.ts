import { initializeApp } from 'firebase-admin/app';

// Initialise Firebase Admin SDK once for all functions
initializeApp();

// Functions written but pending deployment — Artifact Registry permissions issue on new GCP account.
// Uncomment these exports once GCP permissions are resolved (Phase 6).
// export { inactivityChecker } from './inactivityChecker';
// export { locationCleanup } from './locationCleanup';
// export { locationRequestTimeout } from './locationRequestTimeout';
// export { inviteHandler } from './inviteHandler';
