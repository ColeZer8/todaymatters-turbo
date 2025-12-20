// Jest-expo preset references `react-native/jest/setup.js`.
// RN 0.81 ships this file as ESM, which breaks our Jest runtime.
// We map it here (via moduleNameMapper) to a CommonJS-compatible setup.

require('./jest.setup');



