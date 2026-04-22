import * as functions from 'firebase-functions/v1';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Called directly by native Swift module when significant location
// change or visit fires — no JS bridge, works even when app terminated
export const heartbeatHTTP = functions
  .region('europe-west1')
  .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }
    const { uid, source } = req.body as { uid?: string; source?: string };
    if (!uid || typeof uid !== 'string') { res.status(400).send('Missing uid'); return; }
    try {
      await getFirestore().doc(`heartbeats/${uid}`).set({
        lastSeen: FieldValue.serverTimestamp(),
        appVersion: '1.0.0',
        source: source ?? 'native',
      }, { merge: true });
      res.status(200).json({ ok: true });
    } catch {
      res.status(500).send('Error');
    }
  });
