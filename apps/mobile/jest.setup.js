// Minimal Jest setup for Expo/React Native.
// We intentionally avoid importing `react-native/jest/setup.js` because it is ESM
// in RN 0.81+ and will crash under our current Jest preset.

global.IS_REACT_ACT_ENVIRONMENT = true;

// Define `__DEV__` before importing RN modules.
global.__DEV__ = true;

// Some React Native internals expect this to exist in Jest.
global.__fbBatchedBridgeConfig = global.__fbBatchedBridgeConfig || {};

// Basic RAF polyfill for components using animations.
global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// Some libs check for `window`.
// eslint-disable-next-line no-global-assign
global.window = global;

// Provide dummy Supabase env vars so modules can import in Jest.
process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';

// -----------------------------------------------------------------------------
// Common RN/Expo mocks to avoid native module crashes in Jest
// -----------------------------------------------------------------------------

// react-native-url-polyfill touches native Platform constants on import; tests don't need it.
jest.mock('react-native-url-polyfill/auto', () => ({}));

// expo-constants pulls in expo-modules-core native shims; tests don't need real values.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}));

// Auth helpers import Expo modules that rely on native bindings; mock them for unit tests.
jest.mock('expo-linking', () => ({
  __esModule: true,
  createURL: () => '',
  parse: () => ({}),
  getInitialURL: async () => null,
  addEventListener: () => ({ remove: () => {} }),
}));

jest.mock('expo-auth-session', () => ({
  __esModule: true,
  makeRedirectUri: () => '',
}));

jest.mock('expo-auth-session/build/QueryParams', () => ({
  __esModule: true,
  getQueryParams: () => ({}),
}));

jest.mock('expo-web-browser', () => ({
  __esModule: true,
  maybeCompleteAuthSession: () => {},
}));

// TurboModuleRegistry: prevent crashes when RN/Expo tries to access native-only modules.
jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => {
  const modules = {
    // Used by Expo when resolving bundle URL in native runtime.
    SourceCode: {
      getConstants: () => ({ scriptURL: '' }),
    },
    // Used by RN Dimensions/PixelRatio/StyleSheet initialization.
    DeviceInfo: {
      getConstants: () => ({
        Dimensions: {
          window: { width: 390, height: 844, scale: 3, fontScale: 3 },
          screen: { width: 390, height: 844, scale: 3, fontScale: 3 },
          windowPhysicalPixels: { width: 1170, height: 2532, scale: 3, fontScale: 3, densityDpi: 460 },
          screenPhysicalPixels: { width: 1170, height: 2532, scale: 3, fontScale: 3, densityDpi: 460 },
        },
      }),
    },
    UIManager: {
      getConstants: () => ({}),
      createView: () => {},
      updateView: () => {},
      dispatchViewManagerCommand: () => {},
      setJSResponder: () => {},
      clearJSResponder: () => {},
    },
    PlatformConstants: {
      getConstants: () => ({
        isTesting: true,
        isDisableAnimations: true,
        reactNativeVersion: { major: 0, minor: 81, patch: 4, prerelease: null },
        forceTouchAvailable: false,
        osVersion: '0',
        systemName: 'iOS',
        interfaceIdiom: 'phone',
      }),
    },
  };

  return {
    getEnforcing: (name) => modules[name] ?? {},
    get: (name) => modules[name] ?? null,
  };
});

// React Native NativeModules: provide a minimal mock that `jest-expo` can extend.
jest.mock('react-native/Libraries/BatchedBridge/NativeModules', () => {
  const mockNativeModules = {
    UIManager: {},
    NativeUnimoduleProxy: {
      viewManagersMetadata: {},
    },
    Linking: {},
  };
  return { __esModule: true, default: mockNativeModules };
});

// lucide-react-native depends on react-native-svg (native-ish); use manual mock.
jest.mock('lucide-react-native');

// AsyncStorage: use official Jest mock (prevents NativeModules access).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Reanimated: use official mock.
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
global.__reanimatedWorkletInit = () => {};

// Gesture handler setup (safe no-op if not installed in test env).
try {
  require('react-native-gesture-handler/jestSetup');
} catch {
  // ignore
}



