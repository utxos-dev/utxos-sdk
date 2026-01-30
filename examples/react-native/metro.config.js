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

// Handle the react-native conditional export
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Ensure we can resolve the SDK package
config.resolver.extraNodeModules = {
  '@utxos/sdk': sdkPath,
};

// Don't resolve symlinks (important for linked packages)
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
