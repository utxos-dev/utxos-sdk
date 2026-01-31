/**
 * React Native Storage Adapter
 * Uses @react-native-async-storage/async-storage
 */

import type { StorageAdapter } from '../../adapters/types';

// Lazy load AsyncStorage to avoid errors if not installed
let AsyncStorage: any = null;
function getAsyncStorage() {
  if (!AsyncStorage) {
    try {
      AsyncStorage = require('@react-native-async-storage/async-storage').default;
    } catch {
      throw new Error(
        '@utxos/sdk: @react-native-async-storage/async-storage is required for React Native. ' +
          'Install it with: npm install @react-native-async-storage/async-storage'
      );
    }
  }
  return AsyncStorage;
}

export const storageAdapter: StorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    return getAsyncStorage().getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    await getAsyncStorage().setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    await getAsyncStorage().removeItem(key);
  },

  async clear(): Promise<void> {
    await getAsyncStorage().clear();
  },
};
