import * as functions from 'firebase-functions/v1';
import { getFirestore } from 'firebase-admin/firestore';

interface ExpoMessage {
  to: string;
  _contentAvailable: boolean;
  data: Record<string, string>;
  priority: string;
}

interface ExpoPushResponse {
  data: Array<{ status: string; message?: string }>;
}

export const heartbeatPinger = functions
  .region('europe-west1')
  .pubsub.schedule('every 15 minutes')
  .onRun(async () => {
    const db = getFirestore();

    // Find all active monitoring pairs to know who needs pinging
    const pairsSnap = await db.collection('monitoring_pairs')
      .where('status', '==', 'active')
      .get();

    if (pairsSnap.empty) {
      functions.logger.info('No active monitoring pairs — nothing to ping');
      return;
    }

    // Get unique monitored user IDs (the people being watched)
    const monitoredIds = [
      ...new Set(
        pairsSnap.docs
          .map(d => d.data().monitoredId as string)
          .filter(Boolean)
      ),
    ];

    functions.logger.info(`Pinging ${monitoredIds.length} monitored user(s)`);

    // Fetch their push tokens from the users collection
    const userSnaps = await Promise.all(
      monitoredIds.map(uid => db.doc(`users/${uid}`).get())
    );

    // Build silent push messages — one per device with a valid token
    const messages: ExpoMessage[] = userSnaps
      .filter(snap => snap.exists && snap.data()?.fcmToken)
      .map(snap => ({
        to: snap.data()!.fcmToken as string,
        _contentAvailable: true,   // Makes this a silent push — user sees nothing
        data: { type: 'heartbeat_ping' },
        priority: 'high',
      }));

    if (messages.length === 0) {
      functions.logger.warn('No push tokens found — users need to open the app once first');
      return;
    }

    // Send via Expo Push API (handles APNs delivery to iOS)
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json() as ExpoPushResponse;
    functions.logger.info(`Silent ping sent to ${messages.length} device(s)`, result);
  });
