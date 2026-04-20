import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, serverTimestamp, GeoPoint } from 'firebase/firestore';
import Constants from 'expo-constants';
import { db } from '../services/auth';
import { HEARTBEAT_TASK } from '../constants/tasks';
export { HEARTBEAT_TASK };

const UID_KEY = 'safesignal_uid';
const PREFS_KEY = 'safesignal_prefs';

// The name for the background notification task
export const BACKGROUND_NOTIFICATION_TASK = 'SAFESIGNAL_BACKGROUND_NOTIFICATION';

// Called by auth service to persist the UID for background access
export async function storeUidForBackground(uid: string): Promise<void> {
  await AsyncStorage.setItem(UID_KEY, uid);
}

export async function clearUidFromBackground(): Promise<void> {
  await AsyncStorage.removeItem(UID_KEY);
}

// Shared heartbeat write logic — used by both tasks below and by foreground AppState listener
export async function writeHeartbeat(): Promise<void> {
  const uid = await AsyncStorage.getItem(UID_KEY);
  if (!uid) return;

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  // Write heartbeat timestamp
  await setDoc(
    doc(db, 'heartbeats', uid),
    { lastSeen: serverTimestamp(), appVersion },
    { merge: true }
  );

  // Optionally write last known location if user consented
  const prefsRaw = await AsyncStorage.getItem(PREFS_KEY);
  if (prefsRaw) {
    const prefs: { shareLastKnownLocation?: boolean; lastKnownLocationConsentedAt?: string } =
      JSON.parse(prefsRaw);

    if (prefs.shareLastKnownLocation && prefs.lastKnownLocationConsentedAt) {
      const position = await Location.getLastKnownPositionAsync({
        maxAge: 3600000,
        requiredAccuracy: 500,
      });

      if (position) {
        await setDoc(doc(db, 'last_known_location', uid), {
          userId: uid,
          location: new GeoPoint(position.coords.latitude, position.coords.longitude),
          recordedAt: serverTimestamp(),
          accuracy: position.coords.accuracy ?? 0,
          consentedAt: new Date(prefs.lastKnownLocationConsentedAt),
        });
      }
    }
  }
}

// ── Task 1: Background Fetch (iOS runs this occasionally on its own schedule) ──
TaskManager.defineTask(HEARTBEAT_TASK, async () => {
  try {
    await writeHeartbeat();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ── Task 2: Background Notification (runs when our server sends a silent ping) ──
// This is the reliable one — our Cloud Function wakes the phone every 15 minutes
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async () => {
  try {
    await writeHeartbeat();
  } catch {
    // Silent fail — must not crash in background
  }
});
