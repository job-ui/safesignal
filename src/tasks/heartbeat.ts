import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, serverTimestamp, GeoPoint } from 'firebase/firestore';
import Constants from 'expo-constants';
import { db } from '../services/auth';
import { HEARTBEAT_TASK } from '../constants/tasks';

const UID_KEY = 'safesignal_uid';
const PREFS_KEY = 'safesignal_prefs';

// Called by auth service to persist the UID for background access
export async function storeUidForBackground(uid: string): Promise<void> {
  await AsyncStorage.setItem(UID_KEY, uid);
}

export async function clearUidFromBackground(): Promise<void> {
  await AsyncStorage.removeItem(UID_KEY);
}

TaskManager.defineTask(HEARTBEAT_TASK, async () => {
  try {
    const uid = await AsyncStorage.getItem(UID_KEY);
    if (!uid) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const appVersion = Constants.expoConfig?.version ?? '1.0.0';

    // Write heartbeat
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

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});
