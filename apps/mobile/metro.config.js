const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// In this monorepo we have multiple React versions (Next.js uses React 18, Expo uses React 19).
// Metro must consistently resolve React + Expo Router from *this* app's node_modules to avoid
// context/provider mismatches like:
// "useLinkPreviewContext must be used within a LinkPreviewContextProvider"
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Force singletons for packages that must never be duplicated at runtime.
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-dom": path.resolve(projectRoot, "node_modules/react-dom"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
  expo: path.resolve(projectRoot, "node_modules/expo"),
  "expo-router": path.resolve(projectRoot, "node_modules/expo-router"),
  semver: path.resolve(projectRoot, "node_modules/semver"),
};

module.exports = withNativeWind(config, { input: "./src/global.css" });
