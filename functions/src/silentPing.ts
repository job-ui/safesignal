import * as functions from 'firebase-functions/v1';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

export const silentPing = functions
  .region('europe-west1')
  .pubsub.schedule('every 30 minutes')
  .onRun(async () => {
    const db = getFirestore();

    // Get all unique monitored user IDs from active pairs
    const pairsSnap = await db.collection('monitoring_pairs')
      .where('status', '==', 'active')
      .get();

    const monitoredIds = new Set<string>();
    pairsSnap.docs.forEach(doc => {
      const { monitoredId } = doc.data();
      if (monitoredId) monitoredIds.add(monitoredId);
    });

    if (monitoredIds.size === 0) return;

    // Send silent push to each monitored person
    const tasks = Array.from(monitoredIds).map(async (uid) => {
      const userSnap = await db.doc(`users/${uid}`).get();
      if (!userSnap.exists) return;
      const { fcmToken } = userSnap.data()!;
      if (!fcmToken) return;

      try {
        await getMessaging().send({
          token: fcmToken,
          data: { type: 'silent_ping' },
          apns: {
            headers: {
              'apns-push-type': 'background',
              'apns-priority': '5',
            },
            payload: {
              aps: {
                'content-available': 1,
              },
            },
          },
        });
        functions.logger.info(`Silent ping sent to ${uid}`);
      } catch (err) {
        functions.logger.warn(`Silent ping failed for ${uid}:`, err);
      }
    });

    await Promise.allSettled(tasks);
  });
