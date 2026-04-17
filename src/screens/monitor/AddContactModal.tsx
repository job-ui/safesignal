import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../stores/authStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import {
  createMonitoringPair,
  getUserByEmail,
  subscribeMonitoringPairs,
} from '../../services/firestore';
import type { MonitorStackParamList } from '../../navigation/types';
import { PlanTier } from '../../types/enums';

const RELATIONSHIPS = ['Partner', 'Parent', 'Child', 'Sibling', 'Friend', 'Other'];
const EMOJIS = ['👤', '❤️', '👨', '👩', '👦', '👧', '👴', '👵', '🧑', '🤝'];

const FREE_CONTACT_LIMIT = 2;
const APP_STORE_LINK = 'https://apps.apple.com/app/id6762097155';

function buildInviteMessage(senderName: string, pairId?: string): string {
  const base =
    `${senderName} is inviting you to SafeSignal — a privacy-first app that checks you're safe without tracking your location. Download here: ${APP_STORE_LINK}`;
  if (pairId) {
    return `${base}\n\nAlready have the app? Tap to connect: safesignal://consent?pairId=${pairId}`;
  }
  return base;
}

type Nav = NativeStackNavigationProp<MonitorStackParamList>;

export default function AddContactModal() {
  const { currentUser } = useAuthStore();
  const { plan } = useSubscriptionStore();
  const navigation = useNavigation<Nav>();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState(RELATIONSHIPS[0]);
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [loading, setLoading] = useState(false);
  const [contactCount, setContactCount] = useState<number | null>(null);

  useEffect(() => {
    if (!currentUser?.uid) return;
    return subscribeMonitoringPairs(currentUser.uid, (pairs) => {
      const active = pairs.filter((p) => p.status === 'active' || p.status === 'pending');
      setContactCount(active.length);
    });
  }, [currentUser?.uid]);

  const isAtFreeLimit = plan === PlanTier.Free && contactCount !== null && contactCount >= FREE_CONTACT_LIMIT;

  // Creates the Firestore pair and returns a share message.
  // Returns null if the contact was already on SafeSignal (alert shown inline).
  async function createPairAndBuildMessage(): Promise<string | null> {
    if (!currentUser?.uid) return null;
    if (!displayName.trim()) {
      Alert.alert('Name required', 'Please enter a display name for this contact.');
      return null;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const senderName = currentUser.displayName ?? 'Someone';

    // Look up whether this person already has a SafeSignal account
    const existingUser = trimmedEmail ? await getUserByEmail(trimmedEmail) : null;

    if (existingUser) {
      // Connected immediately — the monitored person will see the consent
      // screen next time they open the app
      await createMonitoringPair({
        monitorId: currentUser.uid,
        monitoredId: existingUser.id,
        status: 'pending',
        threshold_hours: 24,
        autoDisclosureEnabled: false,
        autoDisclosureAfterH: null,
        contactName: displayName.trim(),
        contactEmoji: emoji,
        contactRelationship: relationship,
      });

      Alert.alert(
        'Request sent',
        `${displayName.trim()} is already on SafeSignal. They'll see your monitoring request the next time they open the app.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      return null;
    }

    // Person not on SafeSignal yet — create a pending pair keyed by
    // invitedEmail so it can be matched when they sign up
    const pairId = await createMonitoringPair({
      monitorId: currentUser.uid,
      monitoredId: '',
      status: 'pending',
      threshold_hours: 24,
      autoDisclosureEnabled: false,
      autoDisclosureAfterH: null,
      contactName: displayName.trim(),
      contactEmoji: emoji,
      contactRelationship: relationship,
      ...(trimmedEmail ? { invitedEmail: trimmedEmail } : {}),
    });

    return buildInviteMessage(senderName, pairId);
  }

  async function handleSendInvite() {
    setLoading(true);
    try {
      const message = await createPairAndBuildMessage();
      if (!message) return;
      await Share.share({ message, title: 'Join me on SafeSignal' });
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not create contact. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleShareViaSMS() {
    setLoading(true);
    try {
      const message = await createPairAndBuildMessage();
      if (!message) return;
      await Linking.openURL(`sms:?body=${encodeURIComponent(message)}`);
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not open Messages. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleShareViaWhatsApp() {
    setLoading(true);
    try {
      const message = await createPairAndBuildMessage();
      if (!message) return;
      const supported = await Linking.canOpenURL('whatsapp://send');
      if (!supported) {
        Alert.alert('WhatsApp not installed', 'Please install WhatsApp or use another share option.');
        return;
      }
      await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`);
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not open WhatsApp. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleShareViaEmail() {
    setLoading(true);
    try {
      const message = await createPairAndBuildMessage();
      if (!message) return;
      const subject = encodeURIComponent('Join me on SafeSignal');
      await Linking.openURL(`mailto:?subject=${subject}&body=${encodeURIComponent(message)}`);
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not open Mail. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Loading state while counting contacts
  if (contactCount === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Contact</Text>
          <View style={{ width: 80 }} />
        </View>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#4A90D9" />
        </View>
      </SafeAreaView>
    );
  }

  // Free plan limit gate
  if (isAtFreeLimit) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Contact</Text>
          <View style={{ width: 80 }} />
        </View>
        <View style={styles.gateContainer}>
          <Text style={styles.gateIcon}>🔒</Text>
          <Text style={styles.gateTitle}>Free plan limit reached</Text>
          <Text style={styles.gateSubtitle}>
            You're monitoring {contactCount} of {FREE_CONTACT_LIMIT} contacts on the Free plan.
            Upgrade to Family to monitor up to 10 people.
          </Text>
          <TouchableOpacity
            style={styles.upgradeBtn}
            onPress={() => {
              navigation.goBack();
              navigation.navigate('SubscriptionPlans');
            }}
          >
            <Text style={styles.upgradeBtnText}>Upgrade to Family — $3.99/mo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Contact</Text>
        <TouchableOpacity onPress={handleSendInvite} disabled={loading}>
          <Text style={[styles.sendText, loading && styles.disabled]}>
            {loading ? 'Sending…' : 'Send Invite'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Display name</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="e.g. Mum, Dad, Alex"
          placeholderTextColor="#aaa"
          autoFocus
        />

        <Text style={styles.label}>Their email address</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="optional — connects instantly if they're already on SafeSignal"
          placeholderTextColor="#aaa"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <Text style={styles.label}>Relationship</Text>
        <View style={styles.chipRow}>
          {RELATIONSHIPS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.chip, relationship === r && styles.chipActive]}
              onPress={() => setRelationship(r)}
            >
              <Text style={[styles.chipText, relationship === r && styles.chipTextActive]}>
                {r}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Choose an emoji</Text>
        <View style={styles.emojiRow}>
          {EMOJIS.map((e) => (
            <TouchableOpacity
              key={e}
              style={[styles.emojiBtn, emoji === e && styles.emojiBtnActive]}
              onPress={() => setEmoji(e)}
            >
              <Text style={styles.emojiText}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How invites work</Text>
          <Text style={styles.infoText}>
            If your contact already has SafeSignal, they'll see your request immediately.{'\n\n'}
            If not, they'll receive a message to download the app. When they sign up with the
            same email address, you'll be connected automatically.{'\n\n'}
            Their location is never shared unless they explicitly approve each request.
          </Text>
        </View>

        <Text style={styles.shareLabel}>Share via</Text>
        <View style={styles.shareRow}>
          <TouchableOpacity
            style={[styles.shareBtn, styles.shareBtnSMS]}
            onPress={handleShareViaSMS}
            disabled={loading}
          >
            <Text style={styles.shareBtnIcon}>💬</Text>
            <Text style={styles.shareBtnText}>SMS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.shareBtn, styles.shareBtnWhatsApp]}
            onPress={handleShareViaWhatsApp}
            disabled={loading}
          >
            <Text style={styles.shareBtnIcon}>📱</Text>
            <Text style={styles.shareBtnText}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.shareBtn, styles.shareBtnEmail]}
            onPress={handleShareViaEmail}
            disabled={loading}
          >
            <Text style={styles.shareBtnIcon}>✉️</Text>
            <Text style={styles.shareBtnText}>Email</Text>
          </TouchableOpacity>
        </View>
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
  sendText: { fontSize: 16, color: '#4A90D9', fontWeight: '600' },
  disabled: { opacity: 0.4 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  gateIcon: { fontSize: 48, marginBottom: 8 },
  gateTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', textAlign: 'center' },
  gateSubtitle: { fontSize: 15, color: '#555', textAlign: 'center', lineHeight: 22 },
  upgradeBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
  },
  upgradeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  scroll: { padding: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 20, marginBottom: 10 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDE3EE',
    padding: 12,
    fontSize: 16,
    color: '#1A1A2E',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EBEBF0',
  },
  chipActive: { backgroundColor: '#4A90D9' },
  chipText: { fontSize: 14, color: '#333' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emojiBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EBEBF0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBtnActive: { backgroundColor: '#4A90D9' },
  emojiText: { fontSize: 22 },
  infoBox: {
    marginTop: 30,
    backgroundColor: '#EBF3FF',
    borderRadius: 10,
    padding: 14,
  },
  infoTitle: { fontSize: 14, fontWeight: '600', color: '#1A4C8B', marginBottom: 6 },
  infoText: { fontSize: 13, color: '#1A4C8B', lineHeight: 19 },
  shareLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 24,
    marginBottom: 12,
  },
  shareRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 32,
  },
  shareBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 4,
  },
  shareBtnSMS: { backgroundColor: '#34C759' },
  shareBtnWhatsApp: { backgroundColor: '#25D366' },
  shareBtnEmail: { backgroundColor: '#4A90D9' },
  shareBtnIcon: { fontSize: 20 },
  shareBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
});
