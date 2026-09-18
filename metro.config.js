const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add modern module extensions so R3F native dependencies resolve correctly
config.resolver.sourceExts.push('cjs', 'mjs');

module.exports = config;