import Purchases from 'react-native-purchases';
import type { PurchasesPackage } from 'react-native-purchases';
import { PlanTier } from '../types/enums';

const REVENUECAT_IOS_KEY = 'test_vtvglOnkQCkvTBxFaJmLzuCZQjD';

export async function configurePurchases(userId: string): Promise<void> {
  Purchases.configure({ apiKey: REVENUECAT_IOS_KEY });
  await Purchases.logIn(userId);
}

export async function getOfferings() {
  return Purchases.getOfferings();
}

export async function purchasePlan(packageToBuy: PurchasesPackage) {
  return Purchases.purchasePackage(packageToBuy);
}

export async function restorePurchases() {
  return Purchases.restorePurchases();
}

export async function getCurrentPlan(): Promise<PlanTier> {
  try {
    const info = await Purchases.getCustomerInfo();
    const active = info.entitlements.active;
    if (active['pro']) return PlanTier.Pro;
    if (active['family']) return PlanTier.Family;
    return PlanTier.Free;
  } catch {
    return PlanTier.Free;
  }
}
