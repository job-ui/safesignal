import * as functions from 'firebase-functions/v1';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const locationCleanup = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 120 })
  .firestore.document('location_requests/{reqId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Only act when status transitions to 'approved' or 'resolved'
    const statusChanged = before.status !== after.status;
    const isTerminalStatus = after.status === 'approved' || after.status === 'resolved';

    if (!statusChanged || !isTerminalStatus) return;

    const reqId = context.params.reqId;

    // Wait 60 seconds, then wipe the location field
    await new Promise<void>((resolve) => setTimeout(resolve, 60_000));

    const db = getFirestore();
    await db.doc(`location_requests/${reqId}`).update({
      location: FieldValue.delete(),
    });

    functions.logger.info(`Location cleaned up for request ${reqId}`);
  });
