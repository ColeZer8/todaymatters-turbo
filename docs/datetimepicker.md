# React Native DateTimePicker

- **Package**: `@react-native-community/datetimepicker`
- **Docs**: https://github.com/react-native-datetimepicker/datetimepicker

## Platform Differences

### iOS
- Uses inline spinner picker (`display="spinner"`)
- Picker is embedded within our custom modal
- User scrolls to select time, then taps "Confirm"
- `themeVariant="light"` for consistent styling

### Android
- Shows as a **native modal dialog** (not inline)
- When `visible=true`, the native picker dialog opens automatically
- Dialog has built-in "Confirm" and "Cancel" buttons
- Picker auto-closes after user action
- `event.type === 'set'` when confirmed, `event.type === 'dismissed'` when cancelled

## Configuration

### app.json Plugin (Android Styling)
The Android time picker is styled via the Expo config plugin in `app.json`:

```json
[
  "@react-native-community/datetimepicker",
  {
    "android": {
      "timePicker": {
        "background": { "light": "#ffffff", "dark": "#1e293b" },
        "headerBackground": { "light": "#f8fafc", "dark": "#0f172a" },
        "numbersBackgroundColor": { "light": "#f1f5f9", "dark": "#334155" },
        "numbersSelectorColor": { "light": "#2563EB", "dark": "#3b82f6" },
        "numbersTextColor": { "light": "#0f172a", "dark": "#f1f5f9" }
      }
    }
  }
]
```

**Note**: After changing Android styling, run `npx expo prebuild --platform android` to regenerate native code.

## Usage Example

```tsx
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

// iOS: inline picker
<DateTimePicker
  value={selectedTime}
  mode="time"
  display="spinner"
  onChange={handleChange}
  minuteInterval={5}
  themeVariant="light"
/>

// Android: native dialog with custom button labels
<DateTimePicker
  value={initialTime}
  mode="time"
  display="spinner"
  onChange={handleAndroidChange}
  minuteInterval={5}
  positiveButton={{ label: 'Confirm', textColor: '#2563EB' }}
  negativeButton={{ label: 'Cancel', textColor: '#64748b' }}
/>
```

## Key Props

| Prop | iOS | Android | Description |
|------|-----|---------|-------------|
| `mode` | ✅ | ✅ | `"time"` or `"date"` |
| `display` | ✅ | ✅ | `"spinner"`, `"default"`, `"clock"` |
| `minuteInterval` | ✅ | ✅ | 1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30 |
| `themeVariant` | ✅ | ❌ | `"light"` or `"dark"` |
| `positiveButton` | ❌ | ✅ | `{ label: string, textColor: string }` |
| `negativeButton` | ❌ | ✅ | `{ label: string, textColor: string }` |

## Native Module Linking

Both iOS and Android use auto-linking:
- **iOS**: `pod install` links `RNDateTimePicker`
- **Android**: Gradle auto-linking via `autolinkLibrariesWithApp()`

After adding the package, rebuild native apps:
```bash
# iOS
cd ios && pod install && cd ..
npx expo run:ios

# Android
npx expo prebuild --platform android
npx expo run:android
```
