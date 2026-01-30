import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/index.native.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  external: [
    // React Native dependencies - only available in RN environment
    'react-native',
    'react-native-quick-crypto',
    '@react-native-async-storage/async-storage',
    'react-native-inappbrowser-reborn',
  ],
  // Don't bundle peer dependencies
  skipNodeModulesBundle: false,
});
