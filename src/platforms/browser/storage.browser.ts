/**
 * Browser Storage Adapter
 * Wraps localStorage with async interface for cross-platform consistency
 */

import type { StorageAdapter } from '../../adapters/types';

export const storageAdapter: StorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn('@utxos/sdk: localStorage.getItem failed:', error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('@utxos/sdk: localStorage.setItem failed:', error);
      throw new Error(`Failed to save to storage: ${error}`);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('@utxos/sdk: localStorage.removeItem failed:', error);
    }
  },

  async clear(): Promise<void> {
    try {
      localStorage.clear();
    } catch (error) {
      console.warn('@utxos/sdk: localStorage.clear failed:', error);
    }
  },
};
