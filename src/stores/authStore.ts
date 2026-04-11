import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from 'firebase/auth';

interface AuthState {
  currentUser: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: null,
      isLoading: true,
      setUser: (user) => set({ currentUser: user, isLoading: false }),
      clearUser: () => set({ currentUser: null, isLoading: false }),
      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the uid — the full User object is not serialisable
      partialize: (state) => ({
        currentUser: state.currentUser
          ? { uid: state.currentUser.uid, email: state.currentUser.email, displayName: state.currentUser.displayName }
          : null,
      }),
    }
  )
);
