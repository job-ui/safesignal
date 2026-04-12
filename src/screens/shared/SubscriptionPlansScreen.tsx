import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { PurchasesPackage, PurchasesOfferings } from 'react-native-purchases';
import { getOfferings, purchasePlan, restorePurchases } from '../../services/subscriptions';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { PlanTier } from '../../types/enums';

const PLAN_FEATURES = {
  free: [
    'Monitor up to 2 people',
    '24h inactivity threshold',
    'Basic push alerts',
    'Location requests (approve/decline)',
  ],
  family: [
    'Monitor up to 10 people',
    'Custom inactivity thresholds',
    'Location history (7 days)',
    'Auto-disclosure (up to 6h timeout)',
    'Priority notifications',
  ],
  pro: [
    'Unlimited contacts',
    'Custom inactivity thresholds',
    'Full location history',
    'Auto-disclosure (2h–24h configurable)',
    'Priority notifications',
    'Early access to new features',
  ],
};

interface PlanCardProps {
  title: string;
  price: string;
  features: string[];
  isPopular?: boolean;
  isLocked?: boolean;
  isCurrent?: boolean;
  onPress: () => void;
  loading?: boolean;
}

function PlanCard({
  title,
  price,
  features,
  isPopular,
  isLocked,
  isCurrent,
  onPress,
  loading,
}: PlanCardProps) {
  return (
    <View style={[styles.card, isPopular && styles.popularCard, isCurrent && styles.currentCard]}>
      {isPopular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularBadgeText}>Most Popular</Text>
        </View>
      )}
      {isCurrent && (
        <View style={styles.currentBadge}>
          <Text style={styles.currentBadgeText}>Current Plan</Text>
        </View>
      )}

      <Text style={styles.planTitle}>{title}</Text>
      <Text style={styles.planPrice}>{price}</Text>

      <View style={styles.featureList}>
        {features.map((f) => (
          <View key={f} style={styles.featureRow}>
            <Text style={styles.featureCheck}>✓</Text>
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
        {isLocked && (
          <View style={styles.featureRow}>
            <Text style={styles.featureLock}>🔒</Text>
            <Text style={[styles.featureText, styles.lockedText]}>
              Auto-disclosure — upgrade to unlock
            </Text>
          </View>
        )}
      </View>

      {!isCurrent && (
        <TouchableOpacity
          style={[styles.planBtn, isPopular && styles.popularBtn]}
          onPress={onPress}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={isPopular ? '#fff' : '#4A90D9'} />
          ) : (
            <Text style={[styles.planBtnText, isPopular && styles.popularBtnText]}>
              {price === 'Free' ? 'Current Plan' : `Choose ${title}`}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function SubscriptionPlansScreen() {
  const navigation = useNavigation();
  const { plan: currentPlan, refreshSubscription } = useSubscriptionStore();
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    getOfferings()
      .then(setOfferings)
      .catch(() => {/* Use fallback prices */})
      .finally(() => setLoadingOfferings(false));
  }, []);

  function findPackage(identifier: string): PurchasesPackage | null {
    if (!offerings?.current) return null;
    return offerings.current.availablePackages.find(
      (p) => p.product.identifier === identifier
    ) ?? null;
  }

  function getPrice(identifier: string, fallback: string): string {
    const pkg = findPackage(identifier);
    return pkg?.product.priceString ?? fallback;
  }

  async function handlePurchase(identifier: string, label: string) {
    const pkg = findPackage(identifier);
    if (!pkg) {
      Alert.alert(
        'Not available',
        `${label} is not yet available in the store. Please check back soon.`
      );
      return;
    }
    setPurchasingId(identifier);
    try {
      await purchasePlan(pkg);
      await refreshSubscription();
      Alert.alert('Subscribed!', `You're now on the ${label} plan.`, [
        { text: 'Great!', onPress: () => navigation.goBack() },
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Purchase could not be completed.';
      if (!message.includes('cancelled')) {
        Alert.alert('Purchase failed', message);
      }
    } finally {
      setPurchasingId(null);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      await restorePurchases();
      await refreshSubscription();
      Alert.alert('Restored', 'Your purchases have been restored.');
    } catch {
      Alert.alert('Error', 'Could not restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose a Plan</Text>
        <View style={{ width: 32 }} />
      </View>

      {loadingOfferings ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#4A90D9" />
          <Text style={styles.loadingText}>Loading plans…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.tagline}>
            SafeSignal works best when everyone stays connected
          </Text>

          {/* Free */}
          <PlanCard
            title="Free"
            price="Free"
            features={PLAN_FEATURES.free}
            isLocked
            isCurrent={currentPlan === PlanTier.Free}
            onPress={() => {}}
          />

          {/* Family */}
          <PlanCard
            title="Family"
            price={getPrice('safesignal_family_monthly', '$3.99/mo')}
            features={PLAN_FEATURES.family}
            isPopular
            isCurrent={currentPlan === PlanTier.Family}
            loading={purchasingId === 'safesignal_family_monthly'}
            onPress={() => handlePurchase('safesignal_family_monthly', 'Family')}
          />

          {/* Pro */}
          <PlanCard
            title="Pro"
            price={getPrice('safesignal_pro_monthly', '$7.99/mo')}
            features={PLAN_FEATURES.pro}
            isCurrent={currentPlan === PlanTier.Pro}
            loading={purchasingId === 'safesignal_pro_monthly'}
            onPress={() => handlePurchase('safesignal_pro_monthly', 'Pro')}
          />

          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestore}
            disabled={restoring}
          >
            <Text style={styles.restoreBtnText}>
              {restoring ? 'Restoring…' : 'Restore Purchases'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.legalText}>
            Subscriptions renew automatically. Cancel anytime in your Apple ID settings.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E4EE',
    backgroundColor: '#fff',
  },
  closeBtn: { fontSize: 18, color: '#666', width: 32, textAlign: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A2E' },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 15, color: '#888' },
  scroll: { padding: 16, paddingBottom: 32, gap: 16 },
  tagline: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E0E4EE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  popularCard: {
    borderColor: '#4A90D9',
    borderWidth: 2,
  },
  currentCard: {
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  popularBadge: {
    backgroundColor: '#4A90D9',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  popularBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  currentBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  currentBadgeText: { color: '#2E7D32', fontSize: 12, fontWeight: '700' },
  planTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  planPrice: { fontSize: 16, color: '#4A90D9', fontWeight: '600', marginBottom: 16 },
  featureList: { gap: 8, marginBottom: 20 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  featureCheck: { color: '#4CAF50', fontSize: 14, fontWeight: '700', width: 16 },
  featureLock: { fontSize: 14, width: 16 },
  featureText: { flex: 1, fontSize: 14, color: '#333', lineHeight: 20 },
  lockedText: { color: '#999' },
  planBtn: {
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#4A90D9',
  },
  popularBtn: { backgroundColor: '#4A90D9', borderColor: '#4A90D9' },
  planBtnText: { fontSize: 15, fontWeight: '700', color: '#4A90D9' },
  popularBtnText: { color: '#fff' },
  restoreBtn: { alignItems: 'center', paddingVertical: 12 },
  restoreBtnText: { fontSize: 14, color: '#4A90D9', textDecorationLine: 'underline' },
  legalText: {
    fontSize: 12,
    color: '#aaa',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
});
