import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { onAuthStateChanged } from '../services/auth';
import { useAuthStore } from '../stores/authStore';

import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import RoleSelectScreen from '../screens/RoleSelectScreen';
import MonitorDashboardScreen from '../screens/monitor/MonitorDashboardScreen';
import ActivityLogScreen from '../screens/monitor/ActivityLogScreen';
import MonitoredActiveScreen from '../screens/monitored/MonitoredActiveScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MonitorNav() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Dashboard" component={MonitorDashboardScreen} />
      <Tab.Screen name="ActivityLog" component={ActivityLogScreen} options={{ title: 'Activity' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function MonitoredNav() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="MonitoredActive" component={MonitoredActiveScreen} options={{ title: 'Status' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
      <Stack.Screen name="MonitorNav" component={MonitorNav} />
      <Stack.Screen name="MonitoredNav" component={MonitoredNav} />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const { currentUser, isLoading, setUser, clearUser, setLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged((user) => {
      if (user) {
        setUser(user);
      } else {
        clearUser();
      }
    });
    return unsubscribe;
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {currentUser ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
