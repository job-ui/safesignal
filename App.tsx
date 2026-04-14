import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import { doc, updateDoc } from 'firebase/firestore';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { auth, db } from './src/services/auth';
import { registerForPushNotifications, getFCMToken } from './src/services/notifications';
import { HEARTBEAT_TASK } from './src/constants/tasks';
import { writeHeartbeatNow } from './src/tasks/heartbeat';
// Import task definition so it is registered before BackgroundFetch.registerTaskAsync
import './src/tasks/heartbeat';
import RootNavigator from './src/navigation/RootNavigator';
import { useAuthStore } from './src/stores/authStore';
import { useSubscriptionStore } from './src/stores/subscriptionStore';

async function registerHeartbeatTask() {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    const isAvailable = status === BackgroundFetch.BackgroundFetchStatus.Available;
    if (!isAvailable) return;

    await BackgroundFetch.registerTaskAsync(HEARTBEAT_TASK, {
      minimumInterval: 900, // 15 minutes
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch {
    // Task may already be registered
  }
}

async function setupPushNotifications() {
  await registerForPushNotifications();
  const token = await getFCMToken();
  if (token && auth.currentUser) {
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { fcmToken: token });
    } catch {
      // User doc may not exist yet; auth.ts writes it on sign-up
    }
  }
}

export default function App() {
  const { currentUser } = useAuthStore();
  const { configure, refreshSubscription } = useSubscriptionStore();

  useEffect(() => {
    registerHeartbeatTask();
    setupPushNotifications();
    // Write heartbeat immediately when app becomes active
    writeHeartbeatNow();
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        writeHeartbeatNow();
      }
    });
    return () => subscription.remove();
  }, []);

  // Re-run push notification setup when user logs in
  useEffect(() => {
    if (currentUser) {
      setupPushNotifications();
    }
  }, [currentUser?.uid]);

  // Configure RevenueCat whenever a user logs in
  useEffect(() => {
    if (currentUser?.uid) {
      configure(currentUser.uid).then(refreshSubscription);
    }
  }, [currentUser?.uid]);

  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}
