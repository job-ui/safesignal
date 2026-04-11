import { create } from 'zustand';
import type { LocationRequestDocument, MonitoringPairDocument } from '../types/firestore';

interface MonitoredState {
  pendingRequests: Array<LocationRequestDocument & { id: string }>;
  activeMonitors: Array<MonitoringPairDocument & { id: string }>;
  shareLastKnownLocation: boolean;
  setPendingRequests: (requests: Array<LocationRequestDocument & { id: string }>) => void;
  setActiveMonitors: (monitors: Array<MonitoringPairDocument & { id: string }>) => void;
  setSharePreference: (value: boolean) => void;
}

export const useMonitoredStore = create<MonitoredState>((set) => ({
  pendingRequests: [],
  activeMonitors: [],
  shareLastKnownLocation: false,
  setPendingRequests: (pendingRequests) => set({ pendingRequests }),
  setActiveMonitors: (activeMonitors) => set({ activeMonitors }),
  setSharePreference: (shareLastKnownLocation) => set({ shareLastKnownLocation }),
}));
