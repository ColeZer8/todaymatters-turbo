// Custom Jest config for Expo SDK 54 + RN 0.81.
//
// RN 0.81 ships `react-native/jest/setup.js` as ESM.
// The upstream `react-native/jest-preset` includes it in `setupFiles`, which
// causes Jest to crash in our environment. We derive from `jest-expo` and
// remove that setup file.

const expoPreset = require('jest-expo/jest-preset');

const setupFiles = Array.isArray(expoPreset.setupFiles) ? expoPreset.setupFiles : [];

module.exports = {
  ...expoPreset,
  setupFiles: [
    '<rootDir>/jest.setup.js',
    ...setupFiles.filter((file) => !String(file).includes('react-native/jest/setup.js')),
  ],
  moduleNameMapper: {
    ...(expoPreset.moduleNameMapper || {}),
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
