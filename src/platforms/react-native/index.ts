export { cryptoAdapter } from './crypto.native';
export { storageAdapter } from './storage.native';
export { linkingAdapter } from './linking.native';
export { encodingAdapter } from './encoding.native';

import type { PlatformAdapters } from '../../adapters/types';
import { cryptoAdapter } from './crypto.native';
import { storageAdapter } from './storage.native';
import { linkingAdapter } from './linking.native';
import { encodingAdapter } from './encoding.native';

export const reactNativeAdapters: PlatformAdapters = {
  crypto: cryptoAdapter,
  storage: storageAdapter,
  linking: linkingAdapter,
  encoding: encodingAdapter,
};
