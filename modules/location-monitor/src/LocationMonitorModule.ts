import { requireNativeModule } from 'expo';

const LocationMonitorNative = requireNativeModule('LocationMonitor');

export function startNativeMonitoring(): boolean {
  return LocationMonitorNative.startNativeMonitoring();
}

export function stopNativeMonitoring(): void {
  LocationMonitorNative.stopNativeMonitoring();
}

export function storeUidNative(uid: string): void {
  LocationMonitorNative.storeUid(uid);
}

export function clearUidNative(): void {
  LocationMonitorNative.clearUid();
}
