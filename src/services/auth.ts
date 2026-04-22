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
import {
  getFirestore,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storeUidNative, clearUidNative } from '../../modules/location-monitor/src/LocationMonitorModule';
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
    email: email.toLowerCase().trim(),
    fcmToken: null,
    subscriptionTier: PlanTier.Free,
    createdAt: serverTimestamp(),
  });

  // Link any pending monitoring pairs that were sent to this email before the user joined.
  // Implemented inline here to avoid a circular import with firestore.ts.
  const inviteQ = query(
    collection(db, 'monitoring_pairs'),
    where('invitedEmail', '==', email.toLowerCase().trim()),
    where('monitoredId', '==', '')
  );
  const inviteSnap = await getDocs(inviteQ);
  await Promise.all(
    inviteSnap.docs.map((d) => updateDoc(d.ref, { monitoredId: credential.user.uid, invitedEmail: null }))
  );

  await AsyncStorage.setItem(UID_STORAGE_KEY, credential.user.uid);
  storeUidNative(credential.user.uid);
  return credential.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  await AsyncStorage.setItem(UID_STORAGE_KEY, credential.user.uid);
  storeUidNative(credential.user.uid);
  return credential.user;
}

export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(UID_STORAGE_KEY);
  clearUidNative();
  await firebaseSignOut(auth);
}

export function onAuthStateChanged(callback: NextOrObserver<User>): () => void {
  return firebaseOnAuthStateChanged(auth, async (user) => {
    if (user) {
      await AsyncStorage.setItem(UID_STORAGE_KEY, user.uid);
      storeUidNative(user.uid);
    }
    if (typeof callback === 'function') callback(user);
  });
}
