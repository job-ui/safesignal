import * as Location from 'expo-location';

export type LocationPermissionLevel = 'always' | 'foreground-only' | 'denied';

/**
 * iOS two-step permission flow:
 * 1. Request foreground ("When In Use") — shows the standard prompt.
 * 2. If granted, request background ("Always") — shows the upgrade prompt.
 *
 * Returns 'always' only when the user has granted both.
 */
export async function requestLocationPermissions(): Promise<LocationPermissionLevel> {
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') return 'denied';

  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  return bgStatus === 'granted' ? 'always' : 'foreground-only';
}

export async function getLocationPermissionLevel(): Promise<LocationPermissionLevel> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'denied';

  const bg = await Location.getBackgroundPermissionsAsync();
  return bg.status === 'granted' ? 'always' : 'foreground-only';
}
