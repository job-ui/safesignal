import * as functions from 'firebase-functions/v1';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { MonitoringPairDocument, HeartbeatDocument, UserDocument } from './types';

export const inactivityChecker = functions
  .region('europe-west1')
  .pubsub.schedule('every 15 minutes')
  .onRun(async () => {
    const db = getFirestore();
    const now = Date.now();

    const pairsSnap = await db.collection('monitoring_pairs')
      .where('status', '==', 'active')
      .get();

    const tasks = pairsSnap.docs.map(async (pairDoc) => {
      const pair = pairDoc.data() as MonitoringPairDocument;
      const { monitorId, monitoredId, threshold_hours, contactName, sentAlertAt } = pair;
      const effectiveThreshold = threshold_hours ?? 12;

      if (!monitoredId) return; // Pair not yet accepted

      // Read heartbeat
      const heartbeatSnap = await db.doc(`heartbeats/${monitoredId}`).get();
      if (!heartbeatSnap.exists) return;

      const heartbeat = heartbeatSnap.data() as HeartbeatDocument;
      const lastSeenMs = heartbeat.lastSeen?.toMillis() ?? 0;
      const hoursAgo = (now - lastSeenMs) / 3_600_000;

      if (hoursAgo < effectiveThreshold) return;

      // Avoid repeat alerts within threshold_hours / 2
      if (sentAlertAt) {
        const hoursSinceSent = (now - sentAlertAt.toMillis()) / 3_600_000;
        if (hoursSinceSent < effectiveThreshold / 2) return;
      }

      // Get monitor's FCM token
      const monitorSnap = await db.doc(`users/${monitorId}`).get();
      if (!monitorSnap.exists) return;

      const monitor = monitorSnap.data() as UserDocument;
      if (!monitor.fcmToken) {
        functions.logger.warn(`No FCM token for monitor ${monitorId}`);
        return;
      }

      // Get monitor's local hour using their timezone
      const timezone = monitor.timezone ?? 'UTC';
      const localHour = parseInt(
        new Date().toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false })
      );

      // Quiet hours: no notifications between 11pm and 7am local time
      if (localHour >= 23 || localHour < 7) return;

      // 7am reset: if it's between 7:00-7:14am local time, clear sentAlertAt so
      // the threshold starts counting fresh from this morning
      if (localHour === 7) {
        if (sentAlertAt) {
          const sentDate = new Date(sentAlertAt.toMillis());
          const sentLocalDay = sentDate.toLocaleDateString('en-US', { timeZone: timezone });
          const todayLocal = new Date().toLocaleDateString('en-US', { timeZone: timezone });
          if (sentLocalDay !== todayLocal) {
            await pairDoc.ref.update({ sentAlertAt: null });
            return; // Skip this run, will check again in 15 min
          }
        }
      }

      const name = contactName ?? 'Your contact';
      const hoursRounded = Math.round(hoursAgo);

      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            to: monitor.fcmToken,
            title: `${name} has been inactive for ${hoursRounded} hour${hoursRounded !== 1 ? 's' : ''}`,
            body: 'Tap to check in or send a location request',
            data: { type: 'inactivity', pairId: pairDoc.id },
            sound: 'default',
            priority: 'high',
          }),
        });

        const result = await response.json();
        functions.logger.info(`Expo push result for pair ${pairDoc.id}:`, JSON.stringify(result));

        await pairDoc.ref.update({ sentAlertAt: FieldValue.serverTimestamp() });
        functions.logger.info(`Inactivity alert sent for pair ${pairDoc.id} (${hoursRounded}h)`);
      } catch (err) {
        functions.logger.error(`Failed to send push for pair ${pairDoc.id}:`, err);
      }
    });

    await Promise.allSettled(tasks);
  });
