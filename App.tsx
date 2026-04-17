import React, { useEffect } from 'react';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import { doc, updateDoc } from 'firebase/firestore';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { auth, db } from './src/services/auth';
import { registerForPushNotifications } from './src/services/notifications';
import { HEARTBEAT_TASK, BACKGROUND_NOTIFICATION_TASK } from './src/tasks/heartbeat';
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

async function registerBackgroundNotificationTask() {
  try {
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
  } catch {
    // Task may already be registered
  }
}

// Save the push token now that we know the user is logged in
async function savePushToken(uid: string) {
  const token = await registerForPushNotifications();
  if (token) {
    try {
      await updateDoc(doc(db, 'users', uid), { fcmToken: token });
    } catch {
      // User doc may not exist yet
    }
  }
}

export default function App() {
  const { currentUser } = useAuthStore();
  const { configure, refreshSubscription } = useSubscriptionStore();

  // Register background tasks once on app start
  useEffect(() => {
    registerHeartbeatTask();
    registerBackgroundNotificationTask();
  }, []);

  // Save push token and configure RevenueCat whenever a user logs in
  // This runs AFTER we know the user is logged in — fixing the null token bug
  useEffect(() => {
    if (currentUser?.uid) {
      savePushToken(currentUser.uid);
      configure(currentUser.uid).then(refreshSubscription);
    }
  }, [currentUser?.uid]);

  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}
