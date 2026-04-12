#!/bin/bash
# SafeSignal — Firebase Functions IAM permission fixer
# Run this in Google Cloud Shell: bash fix-permissions.sh

set -e

PROJECT_ID="safesignal-7d538"
PROJECT_NUMBER="340802471906"

# Service accounts
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
EVENTARC_SA="service-${PROJECT_NUMBER}@gcp-sa-eventarc.iam.gserviceaccount.com"
PUBSUB_SA="service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com"
GCF_SA="service-${PROJECT_NUMBER}@gcf-admin-robot.iam.gserviceaccount.com"

echo "====================================================="
echo " SafeSignal — Firebase Functions IAM Permission Fix"
echo " Project: ${PROJECT_ID} (${PROJECT_NUMBER})"
echo "====================================================="
echo ""

# ── Cloud Build SA ────────────────────────────────────────
echo "[1/9] cloudbuild.builds.builder → Cloud Build SA"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/cloudbuild.builds.builder" \
  --condition=None

echo "[2/9] logging.logWriter → Cloud Build SA"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/logging.logWriter" \
  --condition=None

echo "[3/9] storage.objectViewer → Cloud Build SA"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/storage.objectViewer" \
  --condition=None

echo "[4/9] artifactregistry.writer → Cloud Build SA"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/artifactregistry.writer" \
  --condition=None

# ── Compute SA (function runtime) ────────────────────────
echo "[5/9] storage.objectViewer → Compute SA"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/storage.objectViewer" \
  --condition=None

echo "[6/9] run.invoker → Compute SA"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/run.invoker" \
  --condition=None

echo "[7/9] eventarc.eventReceiver → Compute SA"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/eventarc.eventReceiver" \
  --condition=None

# ── Eventarc SA ───────────────────────────────────────────
echo "[8/9] eventarc.serviceAgent → Eventarc SA"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${EVENTARC_SA}" \
  --role="roles/eventarc.serviceAgent" \
  --condition=None

# ── Pub/Sub SA ────────────────────────────────────────────
echo "[9/9] iam.serviceAccountTokenCreator → Pub/Sub SA"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PUBSUB_SA}" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --condition=None

# ── GCF admin robot (bonus — often needed for v1) ─────────
echo "[+]  cloudfunctions.serviceAgent → GCF admin robot SA"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${GCF_SA}" \
  --role="roles/cloudfunctions.serviceAgent" \
  --condition=None

# ── Storage bucket (explicit bucket-level grant for gcf-sources) ──
echo "[+]  storage.objectViewer on gcf-sources bucket → Cloud Build SA"
gcloud storage buckets add-iam-policy-binding \
  "gs://gcf-sources-${PROJECT_NUMBER}-europe-west1" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/storage.objectViewer" 2>/dev/null \
  || echo "     (bucket may not exist yet — skipping, project-level grant covers it)"

echo ""
echo "====================================================="
echo " All permissions applied."
echo " Now run: firebase deploy --only functions"
echo "====================================================="
