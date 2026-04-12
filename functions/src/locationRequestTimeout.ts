import * as functions from 'firebase-functions/v1';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import type {
  LocationRequestDocument,
  MonitoringPairDocument,
  LastKnownLocationDocument,
  UserDocument,
} from './types';

export const locationRequestTimeout = functions
  .region('europe-west1')
  .pubsub.schedule('every 30 minutes')
  .onRun(async () => {
    const db = getFirestore();
    const now = Date.now();

    // Query pending requests that have an auto-trigger time set
    const requestsSnap = await db.collection('location_requests')
      .where('status', '==', 'pending')
      .where('autoTriggerAfterH', '>', 0)
      .get();

    if (requestsSnap.empty) return;

    const tasks = requestsSnap.docs.map(async (reqDoc) => {
      const req = reqDoc.data() as LocationRequestDocument;
      const { fromUserId, toUserId, autoTriggerAfterH, requestedAt } = req;

      if (!autoTriggerAfterH || !requestedAt) return;

      const hoursWaiting = (now - requestedAt.toMillis()) / 3_600_000;
      if (hoursWaiting < autoTriggerAfterH) return;

      // Verify an active monitoring pair with consent exists
      const pairsSnap = await db.collection('monitoring_pairs')
        .where('monitorId', '==', fromUserId)
        .where('monitoredId', '==', toUserId)
        .limit(1)
        .get();

      if (pairsSnap.empty) {
        functions.logger.warn(`No monitoring pair found for request ${reqDoc.id}`);
        return;
      }

      const pair = pairsSnap.docs[0].data() as MonitoringPairDocument;

      if (!pair.monitoredConsentedAt) {
        // Monitored person never consented to auto-disclosure — resolve as unavailable
        await reqDoc.ref.update({
          status: 'auto_resolved',
          locationType: 'unavailable',
          autoTriggeredAt: FieldValue.serverTimestamp(),
        });
        functions.logger.info(`Request ${reqDoc.id} auto-resolved — no consent`);
        await sendTimeoutFCM(
          db,
          fromUserId,
          pair.contactName ?? 'Your contact',
          null,
          reqDoc.id
        );
        return;
      }

      const contactName = pair.contactName ?? 'Your contact';

      // Check if last_known_location exists for the monitored person
      const locSnap = await db.doc(`last_known_location/${toUserId}`).get();

      const batch = db.batch();

      if (locSnap.exists) {
        const locData = locSnap.data() as LastKnownLocationDocument;
        const locationAgeH = (now - locData.recordedAt.toMillis()) / 3_600_000;
        const locationAgeRounded = Math.round(locationAgeH);

        batch.update(reqDoc.ref, {
          status: 'auto_resolved',
          location: locData.location,
          locationType: 'last_seen',
          autoTriggeredAt: FieldValue.serverTimestamp(),
          lastKnownRecordedAt: locData.recordedAt,
        });

        await batch.commit();

        await sendTimeoutFCM(db, fromUserId, contactName, locationAgeRounded, reqDoc.id);
        functions.logger.info(`Request ${reqDoc.id} auto-resolved with last_known_location`);
      } else {
        batch.update(reqDoc.ref, {
          status: 'auto_resolved',
          locationType: 'unavailable',
          autoTriggeredAt: FieldValue.serverTimestamp(),
        });

        await batch.commit();

        await sendTimeoutFCM(db, fromUserId, contactName, null, reqDoc.id);
        functions.logger.info(`Request ${reqDoc.id} auto-resolved — no location available`);
      }
    });

    await Promise.allSettled(tasks);
  });

async function sendTimeoutFCM(
  db: FirebaseFirestore.Firestore,
  monitorId: string,
  contactName: string,
  locationAgeH: number | null,
  reqId: string
): Promise<void> {
  const monitorSnap = await db.doc(`users/${monitorId}`).get();
  if (!monitorSnap.exists) return;

  const monitor = monitorSnap.data() as UserDocument;
  if (!monitor.fcmToken) {
    functions.logger.warn(`No FCM token for monitor ${monitorId} — cannot notify about request ${reqId}`);
    return;
  }

  let title: string;
  let body: string;

  if (locationAgeH !== null) {
    title = `${contactName}'s location has been auto-shared`;
    body = `Last known location from ${locationAgeH} hour${locationAgeH !== 1 ? 's' : ''} ago has been shared.`;
  } else {
    title = `Auto-disclosure triggered for ${contactName}`;
    body = `No location is available — location services may be disabled on their phone.`;
  }

  await getMessaging().send({
    token: monitor.fcmToken,
    notification: { title, body },
    data: { type: 'auto_disclosure', requestId: reqId },
  });
}
