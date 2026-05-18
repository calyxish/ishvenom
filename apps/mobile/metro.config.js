const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

if (!config.resolver.assetExts.includes('tflite')) {
  config.resolver.assetExts.push('tflite');
}
// SVG treated as a binary asset so expo-image can decode it at runtime
// (expo-image v3 includes SVG decoders for iOS and Android)
if (!config.resolver.assetExts.includes('svg')) {
  config.resolver.assetExts.push('svg');
}

// 1. Watch the entire monorepo so workspace packages (e.g. @ishvenom/shared-types)
//    are picked up by Metro's file watcher.
config.watchFolders = [workspaceRoot];

// 2. Tell Metro where to look for packages: local node_modules first, then root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. pnpm puts packages in a virtual store accessed via symlinks.
//    Enabling symlink support lets Metro follow those links correctly.
//    We do NOT disable package exports — Expo SDK 54 packages need them.
config.resolver.unstable_enableSymlinks = true;

// 4. Force a single copy of React to avoid the "multiple React copies" error
//    that can occur when the pnpm virtual store has more than one copy.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  'react-dom': path.resolve(projectRoot, 'node_modules/react-dom'),
};

module.exports = config;
