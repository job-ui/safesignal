import * as functions from 'firebase-functions/v1';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import cors = require('cors');

const corsHandler = cors({ origin: true });
const HEARTBEAT_SECRET = 'ss-heartbeat-2026';

// Called directly by native Swift module when significant location
// change or visit fires — no JS bridge, works even when app terminated
export const heartbeatHTTP = functions
  .region('europe-west1')
  .runWith({ invoker: 'public' })
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.headers['x-safesignal-secret'] !== HEARTBEAT_SECRET) {
        res.status(403).send('Forbidden');
        return;
      }
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
  });
