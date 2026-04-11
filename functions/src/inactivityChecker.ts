import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import * as logger from 'firebase-functions/logger';
import type { MonitoringPairDocument, HeartbeatDocument, UserDocument } from './types';

export const inactivityChecker = onSchedule('every 15 minutes', async () => {
  const db = getFirestore();
  const now = Date.now();

  const pairsSnap = await db.collection('monitoring_pairs')
    .where('status', '==', 'active')
    .get();

  const tasks = pairsSnap.docs.map(async (pairDoc) => {
    const pair = pairDoc.data() as MonitoringPairDocument;
    const { monitorId, monitoredId, threshold_hours, contactName, sentAlertAt } = pair;

    if (!monitoredId) return; // Pair not yet accepted

    // Read heartbeat
    const heartbeatSnap = await db.doc(`heartbeats/${monitoredId}`).get();
    if (!heartbeatSnap.exists) return;

    const heartbeat = heartbeatSnap.data() as HeartbeatDocument;
    const lastSeenMs = heartbeat.lastSeen?.toMillis() ?? 0;
    const hoursAgo = (now - lastSeenMs) / 3_600_000;

    if (hoursAgo < threshold_hours) return;

    // Avoid repeat alerts within threshold_hours / 2
    if (sentAlertAt) {
      const hoursSinceSent = (now - sentAlertAt.toMillis()) / 3_600_000;
      if (hoursSinceSent < threshold_hours / 2) return;
    }

    // Get monitor's FCM token
    const monitorSnap = await db.doc(`users/${monitorId}`).get();
    if (!monitorSnap.exists) return;

    const monitor = monitorSnap.data() as UserDocument;
    if (!monitor.fcmToken) {
      logger.warn(`No FCM token for monitor ${monitorId}`);
      return;
    }

    const name = contactName ?? 'Your contact';
    const hoursRounded = Math.round(hoursAgo);

    try {
      await getMessaging().send({
        token: monitor.fcmToken,
        notification: {
          title: `${name} has been inactive for ${hoursRounded} hour${hoursRounded !== 1 ? 's' : ''}`,
          body: 'Tap to check in or send a location request',
        },
        data: { type: 'inactivity', pairId: pairDoc.id },
      });

      await pairDoc.ref.update({ sentAlertAt: FieldValue.serverTimestamp() });
      logger.info(`Inactivity alert sent for pair ${pairDoc.id} (${hoursRounded}h)`);
    } catch (err) {
      logger.error(`Failed to send inactivity FCM for pair ${pairDoc.id}:`, err);
    }
  });

  await Promise.allSettled(tasks);
});
