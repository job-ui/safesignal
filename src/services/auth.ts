import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  updateProfile,
  User,
  NextOrObserver,
} from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebaseConfig from '../constants/firebaseConfig';
import { PlanTier } from '../types/enums';

const UID_STORAGE_KEY = 'safesignal_uid';

// Initialise Firebase app (guard against re-init in hot reload)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);

// Auth functions

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName });

  // Write user document to Firestore
  await setDoc(doc(db, 'users', credential.user.uid), {
    name: displayName,
    fcmToken: null,
    subscriptionTier: PlanTier.Free,
    createdAt: serverTimestamp(),
  });

  await AsyncStorage.setItem(UID_STORAGE_KEY, credential.user.uid);
  return credential.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  await AsyncStorage.setItem(UID_STORAGE_KEY, credential.user.uid);
  return credential.user;
}

export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(UID_STORAGE_KEY);
  await firebaseSignOut(auth);
}

export function onAuthStateChanged(callback: NextOrObserver<User>): () => void {
  return firebaseOnAuthStateChanged(auth, async (user) => {
    if (user) {
      await AsyncStorage.setItem(UID_STORAGE_KEY, user.uid);
    }
    if (typeof callback === 'function') callback(user);
  });
}
