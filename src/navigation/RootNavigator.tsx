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
import ContactDetailScreen from '../screens/monitor/ContactDetailScreen';
import AddContactModal from '../screens/monitor/AddContactModal';
import EmergencyModal from '../screens/monitor/EmergencyModal';
import MonitoredActiveScreen from '../screens/monitored/MonitoredActiveScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';

import type { MonitorStackParamList, AppStackParamList, AuthStackParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const MonitorStack = createNativeStackNavigator<MonitorStackParamList>();
const Tab = createBottomTabNavigator();

function MonitorTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Dashboard" component={MonitorDashboardScreen} />
      <Tab.Screen
        name="ActivityLog"
        component={ActivityLogScreen}
        options={{ title: 'Activity' }}
      />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function MonitorNav() {
  return (
    <MonitorStack.Navigator screenOptions={{ headerShown: false }}>
      <MonitorStack.Screen name="MonitorTabs" component={MonitorTabs} />
      <MonitorStack.Screen name="ContactDetail" component={ContactDetailScreen} />
      <MonitorStack.Screen
        name="AddContactModal"
        component={AddContactModal}
        options={{ presentation: 'modal' }}
      />
      <MonitorStack.Screen
        name="EmergencyModal"
        component={EmergencyModal}
        options={{ presentation: 'modal' }}
      />
    </MonitorStack.Navigator>
  );
}

function MonitoredNav() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="MonitoredActive"
        component={MonitoredActiveScreen}
        options={{ title: 'Status' }}
      />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="RoleSelect" component={RoleSelectScreen} />
      <AppStack.Screen name="MonitorNav" component={MonitorNav} />
      <AppStack.Screen name="MonitoredNav" component={MonitoredNav} />
    </AppStack.Navigator>
  );
}

export default function RootNavigator() {
  const { currentUser, isLoading, setUser, clearUser } = useAuthStore();

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
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {currentUser ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
