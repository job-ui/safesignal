import { requireNativeModule } from 'expo-modules-core';
import type { EventSubscription } from 'expo-modules-core';

// requireNativeModule returns `any` without a generic — addListener is available at runtime
// because every native Expo module is an EventEmitter (SDK 52+).
const UnlockDetector = requireNativeModule('UnlockDetector');

export function addUnlockListener(listener: () => void): EventSubscription {
  return UnlockDetector.addListener('onUnlock', listener);
}
