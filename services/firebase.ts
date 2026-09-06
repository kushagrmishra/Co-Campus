import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence, signInAnonymously, Auth, User } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}

let auth: Auth | null = null;
try {
    if (Platform.OS === 'web') {
        auth = getAuth(app);
    } else {
        // For React Native / iOS, initializeAuth MUST be called first to register the component
        try {
            auth = initializeAuth(app, {
                persistence: getReactNativePersistence(AsyncStorage),
            });
        } catch (initErr) {
            // If already initialized (e.g. Fast Refresh in development)
            try {
                auth = getAuth(app);
            } catch {
                auth = null;
            }
        }
    }
} catch (err) {
    console.warn('Firebase Auth could not be initialized:', err);
    auth = null;
}

let db: Firestore | null = null;
try {
    db = getFirestore(app);
} catch (err) {
    console.warn('Firebase Firestore could not be initialized:', err);
    db = null;
}

export { auth, db };

export async function ensureAnonymousAuth(): Promise<User | null> {
    try {
        if (!auth) {
            return null;
        }
        if (auth.currentUser) {
            return auth.currentUser;
        }
        const userCred = await signInAnonymously(auth);
        return userCred.user;
    } catch (err) {
        console.warn('Firebase anonymous auth not available (falling back to local storage):', err);
        return null;
    }
}
