import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { serverTimestamp, type Timestamp } from 'firebase/firestore';
import type { MonitoredStackParamList } from '../../navigation/types';
import { updateMonitoringPair } from '../../services/firestore';
import { setLocationSharingPrefs } from '../../services/location';

type Props = NativeStackScreenProps<MonitoredStackParamList, 'MonitoredConsent'>;

export default function MonitoredConsentScreen({ route }: Props) {
  const { pairId, monitorName, autoDisclosureAfterH } = route.params;
  const navigation = useNavigation();

  const [autoDisclosureEnabled, setAutoDisclosureEnabled] = useState(false);
  const [autoDisclosureConfirmed, setAutoDisclosureConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleToggleAttempt(value: boolean) {
    if (!value) {
      // Turning off is always instant
      setAutoDisclosureEnabled(false);
      setAutoDisclosureConfirmed(false);
      return;
    }

    // Turning on requires explicit confirmation with both required statements
    const hours = autoDisclosureAfterH ?? 0;
    Alert.alert(
      'Before you enable auto-disclosure',
      `(a) This stores your approximate location on SafeSignal's servers, updated every 15 minutes while the app is running.\n\n(b) Your location will only ever be shared with ${monitorName} if you don't respond within ${hours} hour${hours !== 1 ? 's' : ''}.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          // Leave toggle in its current (off) state
        },
        {
          text: 'I Agree',
          onPress: () => {
            setAutoDisclosureEnabled(true);
            setAutoDisclosureConfirmed(true);
          },
        },
      ]
    );
  }

  async function handleApprove() {
    setLoading(true);
    try {
      await updateMonitoringPair(pairId, {
        status: 'active',
        consentAt: serverTimestamp() as unknown as Timestamp,
        ...(autoDisclosureConfirmed && {
          monitoredConsentedAt: serverTimestamp() as unknown as Timestamp,
        }),
      });

      if (autoDisclosureConfirmed) {
        await setLocationSharingPrefs(true, new Date());
      }

      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not save your consent. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDecline() {
    setLoading(true);
    try {
      await updateMonitoringPair(pairId, { status: 'declined' });
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not save your response. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.shield}>🛡️</Text>
          <Text style={styles.title}>
            <Text style={styles.monitorName}>{monitorName}</Text> wants to monitor your wellbeing
          </Text>
          <Text style={styles.subtitle}>
            Review what will be shared before agreeing.
          </Text>
        </View>

        {/* Permission list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What will be shared</Text>

          <View style={styles.permRow}>
            <Text style={styles.permCheck}>✓</Text>
            <Text style={styles.permText}>Whether you've used your phone recently</Text>
          </View>
          <View style={styles.permRow}>
            <Text style={styles.permCheck}>✓</Text>
            <Text style={styles.permText}>
              Your location — only if you approve each request individually
            </Text>
          </View>
          <View style={styles.permRow}>
            <Text style={styles.permCircle}>○</Text>
            <Text style={styles.permTextOptional}>
              📍 Last known location (if you don't respond) — only if you agree below
            </Text>
          </View>
        </View>

        {/* Auto-disclosure opt-in */}
        {autoDisclosureAfterH != null && autoDisclosureAfterH > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Optional: Auto-disclosure</Text>
            <Text style={styles.sectionSubtitle}>
              Auto-share window: {autoDisclosureAfterH}h — set by {monitorName}
            </Text>

            <View style={styles.toggleRow}>
              <View style={styles.toggleLabelGroup}>
                <Text style={styles.toggleLabel}>
                  Auto-share my location if I don't respond to a request
                </Text>
                <Text style={styles.toggleHint}>Off by default. You can change this at any time.</Text>
              </View>
              <Switch
                value={autoDisclosureEnabled}
                onValueChange={handleToggleAttempt}
                trackColor={{ false: '#D1D1D6', true: '#4A90D9' }}
                thumbColor="#fff"
              />
            </View>

            {autoDisclosureEnabled && (
              <View style={styles.consentConfirmed}>
                <Text style={styles.consentConfirmedText}>
                  ✓ You've agreed to auto-disclosure after {autoDisclosureAfterH}h
                </Text>
              </View>
            )}
          </View>
        )}

        {/* What is NOT shared */}
        <View style={styles.notSharedBox}>
          <Text style={styles.notSharedTitle}>SafeSignal never shares</Text>
          <Text style={styles.notSharedItem}>✗ Your live location at any time</Text>
          <Text style={styles.notSharedItem}>✗ Your location history or movement patterns</Text>
          <Text style={styles.notSharedItem}>✗ Any data without your action or consent</Text>
        </View>
      </ScrollView>

      {/* Sticky buttons */}
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
            {loading ? 'Saving…' : 'Accept Monitoring'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  scroll: { padding: 20, paddingBottom: 8 },
  header: { alignItems: 'center', paddingVertical: 24 },
  shield: { fontSize: 52, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', textAlign: 'center', marginBottom: 8 },
  monitorName: { color: '#4A90D9' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center' },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A2E', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: '#666', marginBottom: 12 },
  permRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  permCheck: { fontSize: 15, color: '#4CAF50', fontWeight: '700', width: 20 },
  permCircle: { fontSize: 15, color: '#999', width: 20 },
  permText: { flex: 1, fontSize: 14, color: '#333', lineHeight: 20 },
  permTextOptional: { flex: 1, fontSize: 14, color: '#888', lineHeight: 20 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 4,
  },
  toggleLabelGroup: { flex: 1 },
  toggleLabel: { fontSize: 14, color: '#1A1A2E', fontWeight: '500', lineHeight: 20 },
  toggleHint: { fontSize: 12, color: '#999', marginTop: 2 },
  consentConfirmed: {
    marginTop: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 10,
  },
  consentConfirmedText: { fontSize: 13, color: '#2E7D32', fontWeight: '500' },
  notSharedBox: {
    backgroundColor: '#F3F4FF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  notSharedTitle: { fontSize: 13, fontWeight: '600', color: '#3C4070', marginBottom: 8 },
  notSharedItem: { fontSize: 13, color: '#555', marginBottom: 4, lineHeight: 18 },
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
    backgroundColor: '#4A90D9',
  },
  approveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  disabled: { opacity: 0.5 },
});
