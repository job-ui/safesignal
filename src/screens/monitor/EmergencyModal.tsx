import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MonitorStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { PlanTier } from '../../types/enums';
import { createLocationRequest } from '../../services/firestore';

type Props = NativeStackScreenProps<MonitorStackParamList, 'EmergencyModal'>;
type Nav = NativeStackNavigationProp<MonitorStackParamList>;

const TIMEOUT_OPTIONS = [
  { label: 'Never', hours: 0 },
  { label: '2 hours', hours: 2 },
  { label: '4 hours', hours: 4 },
  { label: '6 hours', hours: 6 },
  { label: '12 hours', hours: 12 },
];

export default function EmergencyModal({ route }: Props) {
  const { monitoredId, contactName } = route.params;
  const { currentUser } = useAuthStore();
  const { plan } = useSubscriptionStore();
  const navigation = useNavigation<Nav>();
  const [message, setMessage] = useState('');
  const [autoTimeoutHours, setAutoTimeoutHours] = useState(0);
  const [loading, setLoading] = useState(false);

  const isFreePlan = plan === PlanTier.Free;

  async function handleSend() {
    if (!currentUser?.uid) return;
    setLoading(true);
    try {
      await createLocationRequest({
        fromUserId: currentUser.uid,
        toUserId: monitoredId,
        message:
          message.trim() ||
          `${currentUser.displayName ?? 'Your contact'} is checking that you're safe.`,
        autoTriggerAfterH: autoTimeoutHours > 0 ? autoTimeoutHours : null,
      });
      Alert.alert(
        'Request sent',
        `${contactName} will receive a notification and can approve or decline the request.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch {
      Alert.alert('Error', 'Could not send request. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Location Request</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.recipient}>
          To: <Text style={styles.recipientName}>{contactName}</Text>
        </Text>

        <Text style={styles.label}>Message (optional)</Text>
        <TextInput
          style={styles.textarea}
          value={message}
          onChangeText={setMessage}
          placeholder={`e.g. Just checking you're safe. Can you share your location?`}
          placeholderTextColor="#aaa"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={styles.label}>Auto-share last location if no response after</Text>

        {isFreePlan ? (
          <View style={styles.lockedBlock}>
            <Text style={styles.lockedIcon}>🔒</Text>
            <Text style={styles.lockedText}>
              Auto-timeout is a Family plan feature. Upgrade to automatically share{' '}
              {contactName}'s last known location if they don't respond.
            </Text>
            <TouchableOpacity
              style={styles.upgradeLink}
              onPress={() => {
                navigation.goBack();
                navigation.navigate('SubscriptionPlans');
              }}
            >
              <Text style={styles.upgradeLinkText}>Upgrade to Family →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.hint}>
              If {contactName} has pre-consented to auto-disclosure, their last known location will be
              shared automatically after this time.
            </Text>
            {TIMEOUT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.hours}
                style={[styles.radioRow, autoTimeoutHours === opt.hours && styles.radioRowActive]}
                onPress={() => setAutoTimeoutHours(opt.hours)}
              >
                <View style={[styles.radio, autoTimeoutHours === opt.hours && styles.radioFilled]} />
                <Text style={styles.radioLabel}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        <TouchableOpacity
          style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={loading}
        >
          <Text style={styles.sendBtnText}>{loading ? 'Sending…' : '📍 Send Request'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E4EE',
    backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A2E' },
  cancel: { fontSize: 16, color: '#666' },
  scroll: { padding: 20 },
  recipient: { fontSize: 15, color: '#666', marginBottom: 20 },
  recipientName: { fontWeight: '700', color: '#1A1A2E' },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 20 },
  hint: { fontSize: 13, color: '#888', marginBottom: 12, lineHeight: 18 },
  textarea: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDE3EE',
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    color: '#1A1A2E',
  },
  lockedBlock: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  lockedIcon: { fontSize: 24 },
  lockedText: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
  upgradeLink: { marginTop: 4 },
  upgradeLinkText: { fontSize: 14, color: '#4A90D9', fontWeight: '600' },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 2,
  },
  radioRowActive: { backgroundColor: '#EBF3FF' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4A90D9',
  },
  radioFilled: { backgroundColor: '#4A90D9' },
  radioLabel: { fontSize: 15, color: '#1A1A2E' },
  sendBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
