import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './auth';
import type {
  UserDocument,
  MonitoringPairDocument,
  HeartbeatDocument,
  LocationRequestDocument,
} from '../types/firestore';

// ── Monitoring Pairs ──────────────────────────────────────────────────────────

export function subscribeMonitoringPairs(
  monitorId: string,
  callback: (pairs: Array<MonitoringPairDocument & { id: string }>) => void
): Unsubscribe {
  const q = query(
    collection(db, 'monitoring_pairs'),
    where('monitorId', '==', monitorId)
  );
  return onSnapshot(q, (snap) =>
    callback(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as MonitoringPairDocument) }))
    )
  );
}

export async function createMonitoringPair(
  data: Omit<MonitoringPairDocument, 'consentAt' | 'monitoredConsentedAt' | 'sentAlertAt'> &
    Partial<Pick<MonitoringPairDocument, 'consentAt' | 'monitoredConsentedAt' | 'sentAlertAt'>>
): Promise<string> {
  const ref = await addDoc(collection(db, 'monitoring_pairs'), {
    ...data,
    consentAt: null,
    monitoredConsentedAt: null,
    sentAlertAt: null,
  });
  return ref.id;
}

export async function updateMonitoringPair(
  pairId: string,
  data: Partial<MonitoringPairDocument & Record<string, unknown>>
): Promise<void> {
  await updateDoc(doc(db, 'monitoring_pairs', pairId), data as DocumentData);
}

// ── Heartbeats ────────────────────────────────────────────────────────────────

export function subscribeHeartbeat(
  userId: string,
  callback: (heartbeat: HeartbeatDocument | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, 'heartbeats', userId), (snap) =>
    callback(snap.exists() ? (snap.data() as HeartbeatDocument) : null)
  );
}

// ── Location Requests ─────────────────────────────────────────────────────────

export function subscribeLocationRequests(
  toUserId: string,
  callback: (requests: Array<LocationRequestDocument & { id: string }>) => void
): Unsubscribe {
  const q = query(
    collection(db, 'location_requests'),
    where('toUserId', '==', toUserId),
    orderBy('requestedAt', 'desc')
  );
  return onSnapshot(q, (snap) =>
    callback(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as LocationRequestDocument) }))
    )
  );
}

export function subscribeOutgoingLocationRequests(
  fromUserId: string,
  callback: (requests: Array<LocationRequestDocument & { id: string }>) => void
): Unsubscribe {
  const q = query(
    collection(db, 'location_requests'),
    where('fromUserId', '==', fromUserId),
    orderBy('requestedAt', 'desc')
  );
  return onSnapshot(q, (snap) =>
    callback(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as LocationRequestDocument) }))
    )
  );
}

export async function createLocationRequest(
  data: Pick<LocationRequestDocument, 'fromUserId' | 'toUserId' | 'message' | 'autoTriggerAfterH'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'location_requests'), {
    ...data,
    status: 'pending',
    requestedAt: serverTimestamp(),
    respondedAt: null,
    location: null,
    locationType: null,
    autoTriggeredAt: null,
    lastKnownRecordedAt: null,
  });
  return ref.id;
}

export async function updateLocationRequest(
  reqId: string,
  data: Partial<LocationRequestDocument>
): Promise<void> {
  await updateDoc(doc(db, 'location_requests', reqId), data as DocumentData);
}

// ── Monitored Pairs (from the monitored person's perspective) ─────────────────

export function subscribeMonitoredPairs(
  monitoredId: string,
  callback: (pairs: Array<MonitoringPairDocument & { id: string }>) => void
): Unsubscribe {
  const q = query(
    collection(db, 'monitoring_pairs'),
    where('monitoredId', '==', monitoredId)
  );
  return onSnapshot(q, (snap) =>
    callback(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as MonitoringPairDocument) }))
    )
  );
}

export async function deleteMonitoringPair(pairId: string): Promise<void> {
  await deleteDoc(doc(db, 'monitoring_pairs', pairId));
}

// ── Last Known Location ───────────────────────────────────────────────────────

export async function deleteLastKnownLocationDoc(uid: string): Promise<void> {
  await deleteDoc(doc(db, 'last_known_location', uid));
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function getUserProfile(
  uid: string
): Promise<(UserDocument & { id: string }) | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as UserDocument) };
}

export async function updateUserPreferences(
  uid: string,
  prefs: Partial<UserDocument>
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), prefs as DocumentData);
}

export async function getUserByEmail(
  email: string
): Promise<(UserDocument & { id: string }) | null> {
  const q = query(
    collection(db, 'users'),
    where('email', '==', email.toLowerCase().trim())
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as UserDocument) };
}

/**
 * Called once when a user signs up. Finds any monitoring_pairs where
 * invitedEmail matches and populates monitoredId so the consent flow
 * triggers automatically.
 */
export async function claimPendingInvites(uid: string, email: string): Promise<void> {
  const q = query(
    collection(db, 'monitoring_pairs'),
    where('invitedEmail', '==', email.toLowerCase().trim()),
    where('monitoredId', '==', '')
  );
  const snap = await getDocs(q);
  const updates = snap.docs.map((d) =>
    updateDoc(d.ref, { monitoredId: uid, invitedEmail: null })
  );
  await Promise.all(updates);
}
