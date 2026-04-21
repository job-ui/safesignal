import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/auth';
import { LOCATION_HEARTBEAT_TASK } from '../constants/tasks';

const LAST_WRITE_KEY = 'safesignal_location_hb_last_write';
const MIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Task definition must happen at module scope so it is registered before any
// call to Location.startLocationUpdatesAsync.
TaskManager.defineTask(LOCATION_HEARTBEAT_TASK, async () => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // Rate-limit: skip if last write was less than 5 minutes ago
    const lastWrite = await AsyncStorage.getItem(LAST_WRITE_KEY);
    if (lastWrite) {
      const elapsed = Date.now() - parseInt(lastWrite, 10);
      if (elapsed < MIN_INTERVAL_MS) return;
    }

    // Write heartbeat only — NO coordinates stored
    await setDoc(
      doc(db, 'heartbeats', uid),
      { lastSeen: serverTimestamp(), appVersion: 'bg-location' },
      { merge: true }
    );

    await AsyncStorage.setItem(LAST_WRITE_KEY, Date.now().toString());
  } catch {
    // Silently fail — background tasks must not throw
  }
});

export async function isLocationHeartbeatRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_HEARTBEAT_TASK);
  } catch {
    return false;
  }
}

export async function startLocationHeartbeat(): Promise<void> {
  if (await isLocationHeartbeatRunning()) return;

  await Location.startLocationUpdatesAsync(LOCATION_HEARTBEAT_TASK, {
    accuracy: Location.Accuracy.Low,
    distanceInterval: 10,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.Other,
  });
}

export async function stopLocationHeartbeat(): Promise<void> {
  if (!(await isLocationHeartbeatRunning())) return;
  await Location.stopLocationUpdatesAsync(LOCATION_HEARTBEAT_TASK);
}
