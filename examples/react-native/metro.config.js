const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Path to the SDK package
const sdkPath = path.resolve(__dirname, '../..');

// Path to the monorepo root (for resolving shared dependencies)
const monorepoRoot = path.resolve(__dirname, '../../../..');

// Watch the parent SDK package for changes
config.watchFolders = [sdkPath, monorepoRoot];

// Configure resolver to find modules from multiple locations
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(sdkPath, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// For web, prioritize browser field; for native, prioritize react-native
config.resolver.resolverMainFields = ['browser', 'main', 'module'];

// Ensure we can resolve the SDK package
config.resolver.extraNodeModules = {
  '@utxos/sdk': sdkPath,
};

// Enable package exports resolution
config.resolver.unstable_enablePackageExports = true;

// For web builds, use 'browser' condition to get the browser bundle
// For native builds, use 'react-native' condition
config.resolver.unstable_conditionNames = ['browser', 'import', 'require', 'default'];

// Don't resolve symlinks (important for linked packages)
config.resolver.disableHierarchicalLookup = false;

// Add source extensions that Metro should handle
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs', 'mjs'];

module.exports = config;
