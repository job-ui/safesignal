import { create } from 'zustand';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { PlanTier } from '../types/enums';

const REVENUECAT_IOS_KEY = 'test_vtvglOnkQCkvTBxFaJmLzuCZQjD';

interface SubscriptionState {
  plan: PlanTier;
  isActive: boolean;
  isLoading: boolean;
  configure: (userId: string) => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  plan: PlanTier.Free,
  isActive: false,
  isLoading: false,

  configure: async (userId: string) => {
    try {
      Purchases.setLogLevel(LOG_LEVEL.ERROR);
      Purchases.configure({ apiKey: REVENUECAT_IOS_KEY });
      await Purchases.logIn(userId);
    } catch {
      // RevenueCat not critical for core functionality
    }
  },

  refreshSubscription: async () => {
    set({ isLoading: true });
    try {
      const info = await Purchases.getCustomerInfo();
      const active = info.entitlements.active;
      let plan: PlanTier = PlanTier.Free;
      if (active['pro']) {
        plan = PlanTier.Pro;
      } else if (active['family']) {
        plan = PlanTier.Family;
      }
      set({ plan, isActive: plan !== PlanTier.Free, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },
}));
