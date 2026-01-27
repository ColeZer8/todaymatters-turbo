# Native Modules Guide for TodayMatters Mobile App

## Overview

This document outlines when and how to use native modules in the TodayMatters Expo app. Since we're using Expo's managed workflow, most native functionality is available through Expo APIs. Custom native modules are only needed for platform-specific features not covered by Expo.

## When to Use Native Modules

### ✅ Use Expo APIs (Recommended)

Most functionality is available through Expo packages:

- **Authentication**: `expo-auth-session`, `expo-web-browser`
- **Deep Linking**: `expo-linking`
- **Storage**: `@react-native-async-storage/async-storage`, `expo-secure-store`
- **Notifications**: `expo-notifications`
- **File System**: `expo-file-system`
- **Camera**: `expo-camera`
- **Location**: `expo-location`
- **Biometrics**: `expo-local-authentication`

### ⚠️ Custom Native Modules Needed When

1. **Platform-specific APIs** not available in Expo
2. **Performance-critical** operations requiring native code
3. **Third-party SDKs** that require native integration
4. **Custom native UI** components

## Expo Managed Workflow vs Bare Workflow

### Current Setup: Managed Workflow

- **No native directories** (`ios/`, `android/`) in source control
- Native code generated via `expo prebuild` or `eas build`
- Use Expo Config Plugins to customize native configuration
- Easier to maintain and update

### When to Switch to Bare Workflow

Only if you need:

- Direct access to native code for debugging
- Custom native modules not available as Expo modules
- Complex native integrations

**Note**: You can use `npx expo prebuild` to generate native directories temporarily without switching to bare workflow.

## Creating Custom Native Modules

### Option 1: Expo Module Template (Recommended)

For new native modules:

```bash
npx create-expo-module my-native-module
cd my-native-module
```

This creates a module with:

- TypeScript definitions
- iOS (Swift) implementation
- Android (Kotlin) implementation
- Example app

### Option 2: Expo Config Plugin

For configuring existing native modules:

```typescript
// app.json or app.config.js
{
  "plugins": [
    [
      "expo-build-properties",
      {
        "ios": {
          "deploymentTarget": "13.0"
        },
        "android": {
          "minSdkVersion": 23
        }
      }
    ]
  ]
}
```

## Supabase Native Integration

### Deep Linking (No Custom Native Code Needed)

Supabase OAuth uses Expo's deep linking:

- Configured in `app.json` with `scheme: "todaymatters"`
- Handled by `expo-linking` and `expo-auth-session`
- See `src/lib/supabase/auth.ts` for implementation

### Background Tasks (If Needed)

For background sync or token refresh:

- Use `expo-task-manager` and `expo-background-fetch`
- No custom native code required

### Push Notifications (If Needed)

For Supabase real-time notifications:

- Use `expo-notifications`
- Configure in Supabase dashboard
- No custom native code required

## Native Code Structure (When Generated)

If you run `npx expo prebuild`, you'll see:

```
apps/mobile/
├── ios/              # Generated iOS project
│   ├── TodayMatters/
│   │   ├── AppDelegate.swift
│   │   └── Info.plist
│   └── Podfile
└── android/          # Generated Android project
    ├── app/
    │   └── src/
    │       └── main/
    │           ├── MainActivity.kt
    │           └── AndroidManifest.xml
    └── build.gradle
```

**Important**: These directories are generated and should be in `.gitignore` for managed workflow.

## Adding Native Dependencies

### Using Expo Install

```bash
npx expo install <package-name>
```

This ensures compatibility with your Expo SDK version.

### Using Config Plugins

For packages requiring native configuration:

```typescript
// app.config.js
import { withAndroidManifest } from "@expo/config-plugins";

export default {
  plugins: [
    [
      "expo-build-properties",
      {
        android: {
          // Native Android config
        },
      },
    ],
  ],
};
```

## Testing Native Modules

### Development

1. **Expo Go**: Test most Expo APIs without native build
2. **Development Build**: `npx expo run:ios` or `npx expo run:android`
   - Generates native directories temporarily
   - Allows testing custom native code

### Production

1. **EAS Build**: `eas build --platform ios/android`
   - Builds native apps in the cloud
   - Handles all native dependencies

## Common Native Module Patterns

### iOS (Swift)

```swift
import ExpoModulesCore

public class MyNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MyNativeModule")

    Function("doSomething") { (param: String) -> String in
      return "Native result: \(param)"
    }
  }
}
```

### Android (Kotlin)

```kotlin
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MyNativeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MyNativeModule")

    Function("doSomething") { param: String ->
      "Native result: $param"
    }
  }
}
```

## Best Practices

1. **Prefer Expo APIs**: Always check if Expo provides the functionality
2. **Document Native Requirements**: Update this doc when adding native modules
3. **Test on Both Platforms**: iOS and Android implementations may differ
4. **Version Compatibility**: Ensure native modules work with your Expo SDK version
5. **Type Safety**: Use TypeScript definitions for all native modules

## Troubleshooting

### Native Module Not Found

- Ensure package is installed: `pnpm install`
- Clear cache: `npx expo start -c`
- Rebuild native: `npx expo prebuild --clean`

### Build Errors

- Check Expo SDK compatibility
- Verify native dependencies are compatible
- Review EAS build logs for specific errors

## Resources

- [Expo Modules API](https://docs.expo.dev/modules/overview/)
- [Creating Expo Modules](https://docs.expo.dev/modules/create-module/)
- [Config Plugins](https://docs.expo.dev/config-plugins/introduction/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
