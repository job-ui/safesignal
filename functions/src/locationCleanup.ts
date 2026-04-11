import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

export const locationCleanup = onDocumentUpdated(
  { document: 'location_requests/{reqId}', timeoutSeconds: 120 },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    // Only act when status transitions to 'approved' or 'resolved'
    const statusChanged = before.status !== after.status;
    const isTerminalStatus = after.status === 'approved' || after.status === 'resolved';

    if (!statusChanged || !isTerminalStatus) return;

    const reqId = event.params.reqId;

    // Wait 60 seconds, then wipe the location field
    await new Promise<void>((resolve) => setTimeout(resolve, 60_000));

    const db = getFirestore();
    await db.doc(`location_requests/${reqId}`).update({
      location: FieldValue.delete(),
    });

    logger.info(`Location cleaned up for request ${reqId}`);
  }
);
