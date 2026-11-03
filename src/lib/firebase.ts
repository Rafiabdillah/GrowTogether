import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signOut,
  deleteUser,
  connectAuthEmulator,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
  doc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(app, {
    // Optional fields such as completedAt are undefined; Firestore rejects those by default.
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  }, firebaseConfig.firestoreDatabaseId);
} catch {
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreInstance;
export const auth = getAuth(app);

// Local verification mode: point Auth and Firestore at the emulator so two
// browser sessions can be paired for real without touching the live project.
// VITE_FIREBASE_EMULATOR is never set in a production build.
if (import.meta.env.VITE_FIREBASE_EMULATOR === '1') {
  const host = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1';
  connectAuthEmulator(auth, `http://${host}:9199`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8899);
}

// A device no longer needs an account to participate: Firebase gives every
// install its own uid, and the room code is what binds that uid to a shared room.
// An already-signed-in account (for example a Google session from an older build)
// is kept, so nobody is locked out of their existing room by this change.
export async function ensureAnonymousSession(): Promise<User> {
  if (auth.currentUser) return auth.currentUser;
  const result = await signInAnonymously(auth);
  return result.user;
}

export async function retryAnonymousSession(): Promise<User> {
  await signOut(auth);
  return ensureAnonymousSession();
}

// Move this device to a different room: drop the identity, get a fresh one.
// The old uid keeps its membership until the partner removes it, so shared
// room data is never destroyed by switching.
export async function resetDeviceIdentity(): Promise<User> {
  const user = auth.currentUser;
  if (user?.isAnonymous) {
    await deleteUser(user).catch(() => undefined);
  } else {
    await signOut(auth);
  }
  return ensureAnonymousSession();
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validation connection test on initial boot
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline, using persistent local cache.');
    }
  }
}
testFirestoreConnection();
