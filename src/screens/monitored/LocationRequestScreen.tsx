import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { onSnapshot, doc, serverTimestamp } from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import { db } from '../../services/auth';
import { updateLocationRequest, getUserProfile } from '../../services/firestore';
import { requestLocationPermission, getCurrentLocation } from '../../services/location';
import type { LocationRequestDocument } from '../../types/firestore';
import { RequestStatus, LocationType } from '../../types/enums';
import type { MonitoredStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MonitoredStackParamList, 'LocationRequest'>;

function formatCountdown(requestedAtMs: number, autoTriggerAfterH: number): string {
  const autoTriggerMs = requestedAtMs + autoTriggerAfterH * 3_600_000;
  const remaining = autoTriggerMs - Date.now();
  if (remaining <= 0) return 'Overdue — auto-sharing now';
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function LocationRequestScreen({ route }: Props) {
  const { requestId } = route.params;
  const navigation = useNavigation();

  const [request, setRequest] = useState<LocationRequestDocument | null>(null);
  const [monitorName, setMonitorName] = useState('Your monitor');
  const [countdown, setCountdown] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const fetchedMonitorName = useRef(false);

  // Subscribe to the request document
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'location_requests', requestId), (snap) => {
      if (!snap.exists()) {
        navigation.goBack();
        return;
      }
      const data = snap.data() as LocationRequestDocument;
      setRequest(data);

      // Fetch monitor name once
      if (!fetchedMonitorName.current && data.fromUserId) {
        fetchedMonitorName.current = true;
        getUserProfile(data.fromUserId).then((profile) => {
          if (profile?.name) setMonitorName(profile.name);
        });
      }

      // If request was resolved externally (auto-triggered), close the screen
      if (
        data.status === RequestStatus.AutoResolved ||
        data.status === RequestStatus.Resolved
      ) {
        navigation.goBack();
      }
    });
    return unsub;
  }, [requestId]);

  // Countdown timer
  useEffect(() => {
    if (!request?.autoTriggerAfterH || !request?.requestedAt) return;
    const requestedAtMs = request.requestedAt.toMillis();
    const autoH = request.autoTriggerAfterH;

    const tick = () => setCountdown(formatCountdown(requestedAtMs, autoH));
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, [request?.autoTriggerAfterH, request?.requestedAt]);

  async function handleApprove() {
    setLoading(true);
    setLocationDenied(false);
    try {
      const granted = await requestLocationPermission();
      if (!granted) {
        setLocationDenied(true);
        setLoading(false);
        return;
      }
      const geoPoint = await getCurrentLocation();
      await updateLocationRequest(requestId, {
        status: RequestStatus.Approved,
        location: geoPoint,
        locationType: geoPoint ? LocationType.Live : LocationType.Unavailable,
        respondedAt: serverTimestamp() as unknown as Timestamp,
      });
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not share your location. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDecline() {
    setLoading(true);
    try {
      await updateLocationRequest(requestId, {
        status: RequestStatus.Declined,
        respondedAt: serverTimestamp() as unknown as Timestamp,
      });
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not save your response. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!request) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingState}>
          <Text style={styles.loadingText}>Loading request…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasAutoTimeout = (request.autoTriggerAfterH ?? 0) > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.iconRow}>
          <Text style={styles.icon}>📍</Text>
        </View>
        <Text style={styles.title}>Location Request</Text>
        <Text style={styles.from}>from <Text style={styles.monitorName}>{monitorName}</Text></Text>

        {/* Message */}
        {request.message ? (
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>"{request.message}"</Text>
          </View>
        ) : null}

        {/* Countdown */}
        {hasAutoTimeout && countdown ? (
          <View style={styles.countdownBox}>
            <Text style={styles.countdownIcon}>🕐</Text>
            <Text style={styles.countdownText}>
              Auto-sharing in{' '}
              <Text style={styles.countdownTime}>{countdown}</Text>
              {' '}if you don't respond
            </Text>
          </View>
        ) : null}

        {/* Location denied warning */}
        {locationDenied && (
          <View style={styles.deniedBox}>
            <Text style={styles.deniedText}>
              Your location services appear to be off. You can still decline this request.
            </Text>
          </View>
        )}

        {/* Privacy reminder */}
        <View style={styles.privacyNote}>
          <Text style={styles.privacyText}>
            Your location will only be shared if you tap Approve. It is deleted from SafeSignal's
            servers 60 seconds after being viewed.
          </Text>
        </View>
      </View>

      {/* Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.declineBtn, loading && styles.disabled]}
          onPress={handleDecline}
          disabled={loading}
        >
          <Text style={styles.declineBtnText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.approveBtn, loading && styles.disabled]}
          onPress={handleApprove}
          disabled={loading}
        >
          <Text style={styles.approveBtnText}>
            {loading ? 'Sharing…' : '📍 Share My Location'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 15, color: '#888' },
  content: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  iconRow: { marginBottom: 8 },
  icon: { fontSize: 56 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  from: { fontSize: 15, color: '#666', marginBottom: 24 },
  monitorName: { fontWeight: '700', color: '#1A1A2E' },
  messageBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    width: '100%',
    borderLeftWidth: 3,
    borderLeftColor: '#4A90D9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  messageText: { fontSize: 15, color: '#333', fontStyle: 'italic', lineHeight: 22 },
  countdownBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    width: '100%',
  },
  countdownIcon: { fontSize: 18 },
  countdownText: { flex: 1, fontSize: 14, color: '#795548', lineHeight: 20 },
  countdownTime: { fontWeight: '700', color: '#E65100' },
  deniedBox: {
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    width: '100%',
  },
  deniedText: { fontSize: 14, color: '#E65100', lineHeight: 20 },
  privacyNote: {
    backgroundColor: '#F0F4FF',
    borderRadius: 10,
    padding: 12,
    width: '100%',
    marginTop: 8,
  },
  privacyText: { fontSize: 13, color: '#3C4070', lineHeight: 18, textAlign: 'center' },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E8E8F0',
  },
  declineBtn: {
    flex: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  declineBtnText: { fontSize: 15, fontWeight: '600', color: '#666' },
  approveBtn: {
    flex: 2,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#4CAF50',
  },
  approveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  disabled: { opacity: 0.5 },
});
