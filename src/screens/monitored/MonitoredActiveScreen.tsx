import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { serverTimestamp } from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import {
  subscribeMonitoredPairs,
  subscribeLocationRequests,
  updateMonitoringPair,
  getUserProfile,
  deleteLastKnownLocationDoc,
} from '../../services/firestore';
import { setLocationSharingPrefs, getLocationSharingPrefs } from '../../services/location';
import {
  getLocationPermissionLevel,
  requestLocationPermissions,
  type LocationPermissionLevel,
} from '../../services/locationPermission';
import { startContinuousLocation } from '../../tasks/locationHeartbeat';
import { startNativeMonitoring } from '../../../modules/location-monitor/src/LocationMonitorModule';
import { useAuthStore } from '../../stores/authStore';
import type { MonitoringPairDocument, LocationRequestDocument } from '../../types/firestore';
import type { MonitoredStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MonitoredStackParamList>;

export default function MonitoredActiveScreen() {
  const { currentUser } = useAuthStore();
  const navigation = useNavigation<Nav>();

  const [pairs, setPairs] = useState<Array<MonitoringPairDocument & { id: string }>>([]);
  const [pendingRequests, setPendingRequests] = useState<
    Array<LocationRequestDocument & { id: string }>
  >([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [locationPermission, setLocationPermission] = useState<LocationPermissionLevel | null>(null);
  const [requestingPermission, setRequestingPermission] = useState(false);

  // Track which pair/request IDs we have already navigated to, to prevent re-navigation
  const navigatedConsent = useRef<Set<string>>(new Set());
  const navigatedRequest = useRef<Set<string>>(new Set());

  // Heartbeat ring animation
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 1.5,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.5,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  // Check location permission level on mount
  useEffect(() => {
    getLocationPermissionLevel().then(setLocationPermission);
  }, []);

  // Subscribe to pairs where this user is the monitored person
  useEffect(() => {
    if (!currentUser?.uid) return;
    return subscribeMonitoredPairs(currentUser.uid, setPairs);
  }, [currentUser?.uid]);

  // Subscribe to pending location requests directed at this user
  useEffect(() => {
    if (!currentUser?.uid) return;
    return subscribeLocationRequests(currentUser.uid, (reqs) => {
      setPendingRequests(reqs.filter((r) => r.status === 'pending'));
    });
  }, [currentUser?.uid]);

  // Auto-navigate to MonitoredConsent when a pending pair is found
  useEffect(() => {
    const pendingPairs = pairs.filter((p) => p.status === 'pending');
    pendingPairs.forEach(async (pair) => {
      if (navigatedConsent.current.has(pair.id)) return;
      navigatedConsent.current.add(pair.id);

      const profile = await getUserProfile(pair.monitorId);
      navigation.navigate('MonitoredConsent', {
        pairId: pair.id,
        monitorName: profile?.name ?? 'Your monitor',
        autoDisclosureAfterH: pair.autoDisclosureAfterH,
      });
    });
  }, [pairs]);

  // Auto-navigate to LocationRequest when a new pending request arrives
  useEffect(() => {
    pendingRequests.forEach((req) => {
      if (navigatedRequest.current.has(req.id)) return;
      navigatedRequest.current.add(req.id);

      navigation.navigate('LocationRequest', { requestId: req.id });
    });
  }, [pendingRequests]);

  const activePairs = pairs.filter((p) => p.status === 'active');

  async function handleEnableBackgroundMonitoring() {
    setRequestingPermission(true);
    try {
      const level = await requestLocationPermissions();
      setLocationPermission(level);
      if (level === 'always') {
        await startContinuousLocation();
        startNativeMonitoring();
      }
    } catch {
      Alert.alert('Error', 'Could not request location permissions.');
    } finally {
      setRequestingPermission(false);
    }
  }

  async function handleAutoDisclosureToggle(pair: MonitoringPairDocument & { id: string }, value: boolean) {
    if (value) {
      // Turning on — show confirmation dialog
      const hours = pair.autoDisclosureAfterH ?? 0;
      Alert.alert(
        'Before you enable auto-disclosure',
        `(a) This stores your approximate location on SafeSignal's servers, updated every 15 minutes while the app is running.\n\n(b) Your location will only ever be shared with your monitor if you don't respond within ${hours} hour${hours !== 1 ? 's' : ''}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'I Agree',
            onPress: async () => {
              setActionLoading(pair.id + '-toggle');
              try {
                await updateMonitoringPair(pair.id, {
                  monitoredConsentedAt: serverTimestamp() as unknown as Timestamp,
                });
                await setLocationSharingPrefs(true, new Date());
              } catch {
                Alert.alert('Error', 'Could not enable auto-disclosure.');
              } finally {
                setActionLoading(null);
              }
            },
          },
        ]
      );
    } else {
      // Turning off — immediate, no dialog required
      setActionLoading(pair.id + '-toggle');
      try {
        await updateMonitoringPair(pair.id, { monitoredConsentedAt: null });

        // Disable global location sharing if no other pairs have consent
        const otherPairsWithConsent = activePairs.filter(
          (p) => p.id !== pair.id && p.monitoredConsentedAt != null
        );
        if (otherPairsWithConsent.length === 0) {
          await setLocationSharingPrefs(false);
          if (currentUser?.uid) {
            await deleteLastKnownLocationDoc(currentUser.uid);
          }
        }
      } catch {
        Alert.alert('Error', 'Could not disable auto-disclosure.');
      } finally {
        setActionLoading(null);
      }
    }
  }

  async function handlePause(pairId: string) {
    setActionLoading(pairId + '-pause');
    try {
      await updateMonitoringPair(pairId, { status: 'paused' });
    } catch {
      Alert.alert('Error', 'Could not pause monitoring.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResume(pairId: string) {
    setActionLoading(pairId + '-resume');
    try {
      await updateMonitoringPair(pairId, { status: 'active' });
    } catch {
      Alert.alert('Error', 'Could not resume monitoring.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRevoke(pair: MonitoringPairDocument & { id: string }) {
    Alert.alert(
      'Revoke access',
      'This will stop your monitor from seeing your heartbeat status. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(pair.id + '-revoke');
            try {
              await updateMonitoringPair(pair.id, { status: 'revoked' });
              // Clean up location sharing if this was the only consented pair
              if (pair.monitoredConsentedAt != null) {
                const remaining = activePairs.filter(
                  (p) => p.id !== pair.id && p.monitoredConsentedAt != null
                );
                if (remaining.length === 0) {
                  await setLocationSharingPrefs(false);
                  if (currentUser?.uid) {
                    await deleteLastKnownLocationDoc(currentUser.uid);
                  }
                }
              }
            } catch {
              Alert.alert('Error', 'Could not revoke access.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  }

  const pausedPairs = pairs.filter((p) => p.status === 'paused');
  const displayPairs = [...activePairs, ...pausedPairs];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.getParent()?.getParent()?.navigate('RoleSelect' as never)}
        >
          <Text style={styles.switchRoleBtn}>← Switch role</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Status</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Heartbeat ring */}
        <View style={styles.ringSection}>
          <View style={styles.ringWrapper}>
            <Animated.View
              style={[
                styles.ringPulse,
                { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
              ]}
            />
            <View style={styles.ringCore}>
              <Text style={styles.ringEmoji}>💚</Text>
              <Text style={styles.ringLabel}>Active</Text>
            </View>
          </View>
          <Text style={styles.ringCaption}>
            Your heartbeat is being sent every 15 minutes
          </Text>
        </View>

        {/* Background monitoring permission banner */}
        {locationPermission !== null && locationPermission !== 'always' && (
          <View style={styles.permissionBanner}>
            <Text style={styles.permissionBannerTitle}>Enable background monitoring</Text>
            <Text style={styles.permissionBannerBody}>
              Allow SafeSignal to use your location in the background to send a heartbeat even when
              the app is closed. No location coordinates are stored — only your last-active time.
            </Text>
            <TouchableOpacity
              style={styles.permissionBannerBtn}
              onPress={handleEnableBackgroundMonitoring}
              disabled={requestingPermission}
            >
              <Text style={styles.permissionBannerBtnText}>
                {requestingPermission ? 'Requesting…' : 'Enable Background Monitoring'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Pending location requests banner */}
        {pendingRequests.length > 0 && (
          <TouchableOpacity
            style={styles.pendingBanner}
            onPress={() => {
              const req = pendingRequests[0];
              navigation.navigate('LocationRequest', { requestId: req.id });
            }}
          >
            <Text style={styles.pendingBannerText}>
              📍 {pendingRequests.length} pending location request
              {pendingRequests.length > 1 ? 's' : ''} — tap to respond
            </Text>
          </TouchableOpacity>
        )}

        {/* Active monitors */}
        {displayPairs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No monitors yet</Text>
            <Text style={styles.emptySubtext}>
              When someone adds you as a contact, you'll see them here.
            </Text>
          </View>
        ) : (
          displayPairs.map((pair) => {
            const autoEnabled = pair.monitoredConsentedAt != null;
            const isPaused = pair.status === 'paused';
            const toggleLoading = actionLoading === pair.id + '-toggle';

            return (
              <View key={pair.id} style={styles.monitorCard}>
                <View style={styles.monitorHeader}>
                  <Text style={styles.monitorEmoji}>{pair.contactEmoji ?? '👁️'}</Text>
                  <View style={styles.monitorInfo}>
                    <Text style={styles.monitorName}>
                      {pair.contactName ?? pair.monitorId}
                    </Text>
                    <View style={[styles.statusPill, isPaused && styles.statusPillPaused]}>
                      <Text style={[styles.statusPillText, isPaused && styles.statusPillTextPaused]}>
                        {isPaused ? 'Paused' : 'Monitoring active'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Auto-disclosure toggle */}
                {pair.autoDisclosureEnabled && pair.autoDisclosureAfterH != null && (
                  <View style={styles.toggleSection}>
                    <View style={styles.toggleLabelGroup}>
                      <Text style={styles.toggleLabel}>
                        Auto-share my location if I don't respond
                      </Text>
                      <Text style={styles.toggleSublabel}>
                        After {pair.autoDisclosureAfterH}h of no response
                      </Text>
                    </View>
                    <Switch
                      value={autoEnabled}
                      onValueChange={(val) => handleAutoDisclosureToggle(pair, val)}
                      disabled={toggleLoading}
                      trackColor={{ false: '#D1D1D6', true: '#4A90D9' }}
                      thumbColor="#fff"
                    />
                  </View>
                )}

                {/* Actions */}
                <View style={styles.actionRow}>
                  {isPaused ? (
                    <TouchableOpacity
                      style={styles.actionBtnSecondary}
                      onPress={() => handleResume(pair.id)}
                      disabled={actionLoading === pair.id + '-resume'}
                    >
                      <Text style={styles.actionBtnSecondaryText}>Resume</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.actionBtnSecondary}
                      onPress={() => handlePause(pair.id)}
                      disabled={actionLoading === pair.id + '-pause'}
                    >
                      <Text style={styles.actionBtnSecondaryText}>Pause</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.actionBtnDanger}
                    onPress={() => handleRevoke(pair)}
                    disabled={actionLoading === pair.id + '-revoke'}
                  >
                    <Text style={styles.actionBtnDangerText}>Revoke Access</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  switchRoleBtn: { fontSize: 14, color: '#4A90D9', fontWeight: '500', minWidth: 90 },
  headerSpacer: { minWidth: 90 },
  title: { flex: 1, fontSize: 22, fontWeight: '700', color: '#1A1A2E', padding: 16, textAlign: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },

  // Heartbeat ring
  ringSection: { alignItems: 'center', paddingVertical: 24 },
  ringWrapper: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  ringPulse: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4CAF50',
  },
  ringCore: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  ringEmoji: { fontSize: 28 },
  ringLabel: { fontSize: 13, color: '#fff', fontWeight: '600', marginTop: 2 },
  ringCaption: { fontSize: 13, color: '#666', textAlign: 'center' },

  // Background permission banner
  permissionBanner: {
    backgroundColor: '#EBF3FD',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#4A90D9',
  },
  permissionBannerTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  permissionBannerBody: { fontSize: 13, color: '#555', lineHeight: 18, marginBottom: 10 },
  permissionBannerBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  permissionBannerBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  // Pending requests banner
  pendingBanner: {
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  pendingBannerText: { fontSize: 14, color: '#E65100', fontWeight: '500' },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 32 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#888', marginBottom: 6 },
  emptySubtext: { fontSize: 13, color: '#aaa', textAlign: 'center' },

  // Monitor card
  monitorCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  monitorHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  monitorEmoji: { fontSize: 28 },
  monitorInfo: { flex: 1, gap: 4 },
  monitorName: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusPillPaused: { backgroundColor: '#FFF3E0' },
  statusPillText: { fontSize: 12, color: '#2E7D32', fontWeight: '500' },
  statusPillTextPaused: { color: '#E65100' },

  // Toggle
  toggleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginBottom: 10,
  },
  toggleLabelGroup: { flex: 1 },
  toggleLabel: { fontSize: 14, color: '#1A1A2E', fontWeight: '500' },
  toggleSublabel: { fontSize: 12, color: '#888', marginTop: 2 },

  // Actions
  actionRow: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 10 },
  actionBtnSecondary: {
    flex: 1,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  actionBtnSecondaryText: { fontSize: 14, color: '#333', fontWeight: '500' },
  actionBtnDanger: {
    flex: 1,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
  },
  actionBtnDangerText: { fontSize: 14, color: '#C62828', fontWeight: '500' },
});
