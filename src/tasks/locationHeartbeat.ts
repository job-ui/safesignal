import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/auth';
import { UID_KEY, LAST_HEARTBEAT_KEY, recordHeartbeatTime, getLastHeartbeatTime } from './heartbeat';
import { LOCATION_HEARTBEAT_TASK } from '../constants/tasks';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Two hours — if no heartbeat in this window, continuous location kicks in
const CONTINUOUS_TRIGGER_MS = 2 * 60 * 60 * 1000;
// Rate limit: never write more than once per 30 minutes from continuous location
const MIN_WRITE_INTERVAL_MS = 30 * 60 * 1000;
let lastWriteAt = 0;

// Called by both continuous location task AND native Swift module
export async function writeHeartbeat(source: string = 'location'): Promise<void> {
  const uid = await AsyncStorage.getItem(UID_KEY);
  if (!uid) return;
  const now = Date.now();
  if (now - lastWriteAt < MIN_WRITE_INTERVAL_MS) return;
  lastWriteAt = now;
  await setDoc(
    doc(db, 'heartbeats', uid),
    { lastSeen: serverTimestamp(), appVersion: '1.0.0', source },
    { merge: true }
  );
  await recordHeartbeatTime();
  // After writing heartbeat, stop continuous location — native monitors take over
  await stopContinuousLocation();
}

// Bypasses the 30-min rate limit — for explicit foreground/launch writes
// But skips if a heartbeat was written very recently (e.g. by native monitoring)
export async function writeHeartbeatNow(): Promise<void> {
  const uid = await AsyncStorage.getItem(UID_KEY);
  if (!uid) return;
  // Don't overwrite a very recent heartbeat from native monitoring
  const lastHeartbeat = await getLastHeartbeatTime();
  if (Date.now() - lastHeartbeat < 5 * 60 * 1000) return; // skip if written in last 5 min
  try {
    await setDoc(
      doc(db, 'heartbeats', uid),
      { lastSeen: serverTimestamp(), appVersion: '1.0.0', source: 'foreground' },
      { merge: true }
    );
    await recordHeartbeatTime();
    lastWriteAt = Date.now();
  } catch (e) {
    console.warn('[Heartbeat] Foreground write error:', e);
  }
}

// Continuous location task — fallback only, stops itself after writing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
TaskManager.defineTask(LOCATION_HEARTBEAT_TASK, async (body: any) => {
  if (body?.error) return;
  await writeHeartbeat('continuous');
});

export async function startContinuousLocation(): Promise<boolean> {
  try {
    const { status } = await Location.getBackgroundPermissionsAsync();
    if (status !== 'granted') return false;
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_HEARTBEAT_TASK);
    if (isRunning) return true;
    await Location.startLocationUpdatesAsync(LOCATION_HEARTBEAT_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 0,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Other,
    });
    return true;
  } catch (e) {
    console.warn('[LocationHeartbeat] Failed to start continuous:', e);
    return false;
  }
}

export async function stopContinuousLocation(): Promise<void> {
  try {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_HEARTBEAT_TASK);
    if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_HEARTBEAT_TASK);
  } catch {}
}

// Called on app foreground and on login — starts continuous only if needed
export async function checkAndManageContinuous(): Promise<void> {
  const { status } = await Location.getBackgroundPermissionsAsync();
  if (status !== 'granted') return;
  const lastHeartbeat = await getLastHeartbeatTime();
  const twoHoursAgo = Date.now() - CONTINUOUS_TRIGGER_MS;
  if (lastHeartbeat < twoHoursAgo) {
    // No heartbeat in 2+ hours — start continuous location as fallback
    await startContinuousLocation();
  }
  // If heartbeat is recent, continuous stays off — native monitors handle it
}

export async function isLocationRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_HEARTBEAT_TASK);
  } catch { return false; }
}
