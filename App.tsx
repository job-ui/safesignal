import React, { useEffect } from 'react';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import { doc, updateDoc } from 'firebase/firestore';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { auth, db } from './src/services/auth';
import { registerForPushNotifications } from './src/services/notifications';
import { HEARTBEAT_TASK } from './src/constants/tasks';
// Import task definition so it is registered before BackgroundFetch.registerTaskAsync
import './src/tasks/heartbeat';
import RootNavigator from './src/navigation/RootNavigator';

async function registerHeartbeatTask() {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    const isAvailable = status === BackgroundFetch.BackgroundFetchStatus.Available;
    if (!isAvailable) return;

    await BackgroundFetch.registerTaskAsync(HEARTBEAT_TASK, {
      minimumInterval: 60, // 60s for testing; change to 900 before TestFlight
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch {
    // Task may already be registered
  }
}

async function setupPushNotifications() {
  const token = await registerForPushNotifications();
  if (token && auth.currentUser) {
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { fcmToken: token });
    } catch {
      // User doc may not exist yet; auth.ts writes it on sign-up
    }
  }
}

export default function App() {
  useEffect(() => {
    registerHeartbeatTask();
    setupPushNotifications();
  }, []);

  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}
