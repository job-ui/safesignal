import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GeoPoint } from 'firebase/firestore';

const PREFS_KEY = 'safesignal_prefs';

interface LocationPrefs {
  shareLastKnownLocation: boolean;
  lastKnownLocationConsentedAt: string | null;
}

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentLocation(): Promise<GeoPoint | null> {
  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return new GeoPoint(pos.coords.latitude, pos.coords.longitude);
  } catch {
    return null;
  }
}

export async function getLastKnownLocation(
  maxAgeMs: number,
  requiredAccuracyM: number
): Promise<GeoPoint | null> {
  try {
    const pos = await Location.getLastKnownPositionAsync({
      maxAge: maxAgeMs,
      requiredAccuracy: requiredAccuracyM,
    });
    if (!pos) return null;
    return new GeoPoint(pos.coords.latitude, pos.coords.longitude);
  } catch {
    return null;
  }
}

export async function setLocationSharingPrefs(
  enabled: boolean,
  consentedAt?: Date
): Promise<void> {
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  const existing: Partial<LocationPrefs> = raw ? JSON.parse(raw) : {};
  const updated: LocationPrefs = {
    shareLastKnownLocation: enabled,
    lastKnownLocationConsentedAt:
      enabled && consentedAt
        ? consentedAt.toISOString()
        : (existing.lastKnownLocationConsentedAt ?? null),
  };
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(updated));
}

export async function getLocationSharingPrefs(): Promise<LocationPrefs> {
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  if (!raw) return { shareLastKnownLocation: false, lastKnownLocationConsentedAt: null };
  return JSON.parse(raw) as LocationPrefs;
}
