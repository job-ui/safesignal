import AsyncStorage from '@react-native-async-storage/async-storage';

export const UID_KEY = 'safesignal_uid';
export const LAST_HEARTBEAT_KEY = 'safesignal_last_heartbeat';

export async function storeUidForBackground(uid: string): Promise<void> {
  await AsyncStorage.setItem(UID_KEY, uid);
}

export async function clearUidFromBackground(): Promise<void> {
  await AsyncStorage.removeItem(UID_KEY);
  await AsyncStorage.removeItem(LAST_HEARTBEAT_KEY);
}

export async function recordHeartbeatTime(): Promise<void> {
  await AsyncStorage.setItem(LAST_HEARTBEAT_KEY, Date.now().toString());
}

export async function getLastHeartbeatTime(): Promise<number> {
  const val = await AsyncStorage.getItem(LAST_HEARTBEAT_KEY);
  return val ? parseInt(val, 10) : 0;
}
