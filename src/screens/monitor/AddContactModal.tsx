import React, { useState } from 'react';
import {
  Alert,
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
import { useAuthStore } from '../../stores/authStore';
import { createMonitoringPair } from '../../services/firestore';

const RELATIONSHIPS = ['Partner', 'Parent', 'Child', 'Sibling', 'Friend', 'Other'];
const EMOJIS = ['👤', '❤️', '👨', '👩', '👦', '👧', '👴', '👵', '🧑', '🤝'];

export default function AddContactModal() {
  const { currentUser } = useAuthStore();
  const navigation = useNavigation();
  const [displayName, setDisplayName] = useState('');
  const [relationship, setRelationship] = useState(RELATIONSHIPS[0]);
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [loading, setLoading] = useState(false);

  async function handleSendInvite() {
    if (!currentUser?.uid) return;
    if (!displayName.trim()) {
      Alert.alert('Name required', 'Please enter a display name for this contact.');
      return;
    }

    setLoading(true);
    try {
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
      });

      const deepLink = `safesignal://consent?pairId=${pairId}`;
      await Share.share({
        message:
          `${currentUser.displayName ?? 'Someone'} wants to monitor your wellbeing with SafeSignal.\n\nAccept their request: ${deepLink}`,
        title: 'SafeSignal Invite',
      });
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not create contact. Please try again.');
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
            We generate a unique invite link. When your contact taps it and creates an account,
            they can review exactly what will be shared and choose to accept or decline.
            Their location is never shared unless they explicitly approve each request.
          </Text>
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
});
