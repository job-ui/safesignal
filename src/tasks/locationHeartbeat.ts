import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/auth';
import { UID_KEY, LAST_HEARTBEAT_KEY, recordHeartbeatTime, getLastHeartbeatTime } from './heartbeat';
import { LOCATION_HEARTBEAT_TASK } from '../constants/tasks';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Rate limit: never write more than once per 10 minutes from continuous location
const MIN_WRITE_INTERVAL_MS = 10 * 60 * 1000;
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

// Continuous location task — runs permanently, rate-limited to one write per 10 minutes
const MOVEMENT_DISTANCE_THRESHOLD = 30; // metres — above WiFi noise floor
const MOVEMENT_SPEED_THRESHOLD = 0.3;   // m/s — very slow walking pace
let lastKnownLat: number | null = null;
let lastKnownLon: number | null = null;

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
TaskManager.defineTask(LOCATION_HEARTBEAT_TASK, async (body: any) => {
  if (body?.error) return;

  const locations = body?.data?.locations;
  if (!locations || locations.length === 0) return;

  const location = locations[0];
  const { latitude, longitude, speed, accuracy } = location.coords;

  // Ignore very poor accuracy fixes (likely indoor WiFi noise)
  if (accuracy > 200) return;

  // Check if person is genuinely moving
  const isMovingBySpeed = speed !== null && speed > MOVEMENT_SPEED_THRESHOLD;

  // Check distance from last known position
  let isMovingByDistance = false;
  if (lastKnownLat !== null && lastKnownLon !== null) {
    const distance = haversineDistance(lastKnownLat, lastKnownLon, latitude, longitude);
    isMovingByDistance = distance > MOVEMENT_DISTANCE_THRESHOLD;
  } else {
    // First fix — always write
    isMovingByDistance = true;
  }

  if (isMovingBySpeed || isMovingByDistance) {
    lastKnownLat = latitude;
    lastKnownLon = longitude;
    await writeHeartbeat('continuous');
  }
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

// Called on app foreground and on login — always starts continuous location
export async function checkAndManageContinuous(): Promise<void> {
  const { status } = await Location.getBackgroundPermissionsAsync();
  if (status !== 'granted') return;
  await startContinuousLocation();
}

export async function isLocationRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_HEARTBEAT_TASK);
  } catch { return false; }
}
