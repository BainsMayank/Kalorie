const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Bundle Drizzle's .sql migration files with the app.
config.resolver.sourceExts.push('sql');

// Bundle foods.db (the read-only food database) as an asset the app copies on first launch.
config.resolver.assetExts.push('db');

module.exports = config;
