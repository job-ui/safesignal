import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

export const inviteHandler = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const { monitorId, monitoredDisplayName, thresholdHours, autoDisclosureAfterH } =
    req.body as {
      monitorId?: string;
      monitoredDisplayName?: string;
      thresholdHours?: number;
      autoDisclosureAfterH?: number;
    };

  if (!monitorId || !monitoredDisplayName) {
    res.status(400).json({ error: 'monitorId and monitoredDisplayName are required.' });
    return;
  }

  const db = getFirestore();

  try {
    const pairRef = await db.collection('monitoring_pairs').add({
      monitorId,
      monitoredId: '',
      status: 'pending',
      threshold_hours: thresholdHours ?? 24,
      autoDisclosureEnabled: (autoDisclosureAfterH ?? 0) > 0,
      autoDisclosureAfterH: autoDisclosureAfterH ?? null,
      consentAt: null,
      monitoredConsentedAt: null,
      sentAlertAt: null,
      contactName: monitoredDisplayName,
      createdAt: FieldValue.serverTimestamp(),
    });

    const pairId = pairRef.id;
    const deepLink = `safesignal://consent?pairId=${pairId}`;

    logger.info(`Created invite pair ${pairId} for monitor ${monitorId}`);
    res.status(200).json({ pairId, deepLink });
  } catch (err) {
    logger.error('inviteHandler error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});
