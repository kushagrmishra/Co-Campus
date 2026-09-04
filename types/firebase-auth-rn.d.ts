import '@firebase/auth';

declare module 'firebase/auth' {
    import { Persistence } from '@firebase/auth';
    import { ReactNativeAsyncStorage } from '@firebase/auth/src/model/public_types';

    /**
     * Returns a persistence object that wraps AsyncStorage and can be used
     * in the persistence dependency field in initializeAuth.
     */
    export function getReactNativePersistence(
        storage: ReactNativeAsyncStorage
    ): Persistence;
}

declare module '@firebase/auth' {
    import { ReactNativeAsyncStorage } from '@firebase/auth/src/model/public_types';

    export function getReactNativePersistence(
        storage: ReactNativeAsyncStorage
    ): Persistence;
}
