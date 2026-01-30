export { encodingAdapter } from './encoding.browser';
export { storageAdapter } from './storage.browser';
export { linkingAdapter } from './linking.browser';
export { cryptoAdapter } from './crypto.browser';

import type { PlatformAdapters } from '../../adapters/types';
import { cryptoAdapter } from './crypto.browser';
import { storageAdapter } from './storage.browser';
import { linkingAdapter } from './linking.browser';
import { encodingAdapter } from './encoding.browser';

export const browserAdapters: PlatformAdapters = {
  crypto: cryptoAdapter,
  storage: storageAdapter,
  linking: linkingAdapter,
  encoding: encodingAdapter,
};
