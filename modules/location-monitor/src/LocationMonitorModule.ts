import { requireNativeModule } from 'expo';

let LocationMonitorNative: any = null;
try {
  LocationMonitorNative = requireNativeModule('LocationMonitor');
} catch (e) {
  console.warn('[LocationMonitor] Native module not available:', e);
}

export function startNativeMonitoring(): boolean {
  if (!LocationMonitorNative) return false;
  try { return LocationMonitorNative.startNativeMonitoring(); } catch { return false; }
}

export function stopNativeMonitoring(): void {
  if (!LocationMonitorNative) return;
  try { LocationMonitorNative.stopNativeMonitoring(); } catch {}
}

export function storeUidNative(uid: string): void {
  if (!LocationMonitorNative) return;
  try { LocationMonitorNative.storeUid(uid); } catch {}
}

export function clearUidNative(): void {
  if (!LocationMonitorNative) return;
  try { LocationMonitorNative.clearUid(); } catch {}
}
