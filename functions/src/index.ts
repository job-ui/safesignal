import { initializeApp } from 'firebase-admin/app';

// Initialise Firebase Admin SDK once for all functions
initializeApp();

// NOTE: Deploy blocked by Artifact Registry repository-level IAM.
// Fix in Cloud Shell then uncomment:
//   gcloud artifacts repositories add-iam-policy-binding gcf-artifacts \
//     --location=europe-west1 --project=safesignal-7d538 \
//     --member="serviceAccount:340802471906@cloudbuild.gserviceaccount.com" \
//     --role="roles/artifactregistry.writer"
export { inactivityChecker } from './inactivityChecker';
export { locationCleanup } from './locationCleanup';
export { locationRequestTimeout } from './locationRequestTimeout';
export { inviteHandler } from './inviteHandler';
export { silentPing } from './silentPing';
