import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { auth, db } from './src/services/auth';
import { registerForPushNotifications } from './src/services/notifications';
import './src/tasks/locationHeartbeat';
import { checkAndManageContinuous, writeHeartbeatNow } from './src/tasks/locationHeartbeat';
import RootNavigator from './src/navigation/RootNavigator';
import { useAuthStore } from './src/stores/authStore';
import { useSubscriptionStore } from './src/stores/subscriptionStore';

async function setupPushNotifications() {
  const token = await registerForPushNotifications();
  if (token && auth.currentUser) {
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { fcmToken: token });
    } catch {}
  }
}

export default function App() {
  const { currentUser } = useAuthStore();
  const { configure, refreshSubscription } = useSubscriptionStore();

  // On launch
  useEffect(() => {
    setupPushNotifications();
    writeHeartbeatNow();
    checkAndManageContinuous();
  }, []);

  // On login
  useEffect(() => {
    if (currentUser?.uid) {
      configure(currentUser.uid).then(refreshSubscription);
      writeHeartbeatNow();
      checkAndManageContinuous();
    }
  }, [currentUser?.uid]);

  // On app foreground — restart continuous if 2+ hours since last heartbeat
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') { writeHeartbeatNow(); checkAndManageContinuous(); }
    });
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}
