# SMS Implementation Code Summary

## File Structure

```
apps/mobile/
├── src/
│   ├── lib/
│   │   ├── android/
│   │   │   └── sms-service.ts          ← NEW: SMS permissions & listener
│   │   └── supabase/
│   │       └── hooks/
│   │           ├── use-sms-sync.ts     ← NEW: Auto-sync hook
│   │           └── index.ts            ← MODIFIED: Export SMS hook
│   └── app/
│       └── _layout.tsx                  ← MODIFIED: Enable SMS sync
├── app.config.js                        ← MODIFIED: Add SMS permissions
└── package.json                         ← MODIFIED: Add SMS library
```

---

## Code Files

### 1. SMS Service (`src/lib/android/sms-service.ts`)

```typescript
import { 
  startReadSMS, 
  checkIfHasSMSPermission, 
  requestReadSMSPermission 
} from "@maniac-tech/react-native-expo-read-sms";

export async function requestSMSPermissions(): Promise<boolean>
export async function checkSMSPermissions(): Promise<boolean>
export function startSMSListener(
  onMessage: (phoneNumber: string, body: string) => void,
  onError: (error: any) => void
): void
```

**Purpose**: Wrapper around native SMS library
- Simplifies permission checks
- Provides clean callback interface
- Includes console logging for debugging

---

### 2. SMS Sync Hook (`src/lib/supabase/hooks/use-sms-sync.ts`)

```typescript
export function useSMSSync(): void

async function insertSMSEvent(data: {
  userId: string;
  phoneNumber: string;
  body: string;
  timestamp: string;
}): Promise<void>
```

**Purpose**: React hook that auto-syncs SMS to Supabase
- Platform detection (Android only)
- Auth checking
- Permission verification
- Automatic listener startup
- Event insertion to `tm.events`

**Behavior**:
- Runs on component mount (useEffect)
- Only activates if: Android + Authenticated + Permissions granted
- Logs all actions for debugging
- Gracefully handles errors

---

### 3. App Configuration (`app.config.js`)

**Added to `android.permissions` array**:
```javascript
'android.permission.READ_SMS',
'android.permission.RECEIVE_SMS',
```

---

### 4. App Layout (`src/app/_layout.tsx`)

**Added import**:
```typescript
import { useSMSSync } from "@/lib/supabase/hooks";
```

**Added hook call** (in component body):
```typescript
useSMSSync(); // Android-only: start SMS listener when authenticated
```

---

## Data Flow

```
1. User receives SMS on Android device
   ↓
2. Android OS fires SMS broadcast
   ↓
3. @maniac-tech/react-native-expo-read-sms captures it
   ↓
4. sms-service.ts onMessage callback fired
   ↓
5. use-sms-sync.ts insertSMSEvent() called
   ↓
6. Supabase client inserts to tm.events table
   ↓
7. Event appears in database
```

---

## Permission Flow

```
App Startup
   ↓
useSMSSync() runs (useEffect)
   ↓
Check Platform.OS === 'android' ✓
   ↓
Check userId exists ✓
   ↓
Call checkSMSPermissions()
   ↓
   ├─ Granted → Start SMS listener
   └─ Denied  → Log message, exit
```

**Permission Request**: Not automatic - user must grant from Settings screen (to be built)

---

## Event Schema

**Table**: `tm.events`

**SMS Event Row**:
```typescript
{
  id: UUID (auto-generated)
  user_id: UUID (foreign key to users table)
  type: 'sms'
  title: string (e.g., "SMS from +15551234567")
  received_at: timestamp (ISO 8601)
  meta: {
    direction: 'inbound'
    phone_number: string (e.g., "+15551234567")
    message_body: string (full SMS text)
    raw: {
      date: number (Unix timestamp ms)
    }
  }
  created_at: timestamp (auto-generated)
  updated_at: timestamp (auto-generated)
}
```

---

## Console Logging

**Startup logs**:
```
[SMS Sync] Initializing SMS sync for user: abc123...
[SMS Sync] SMS permissions granted - starting listener
[SMS Sync] SMS listener started successfully
```

**Per-SMS logs**:
```
[SMS Service] Received SMS from: +15551234567
[SMS Sync] New SMS received from: +15551234567
[SMS Sync] Inserting SMS event: { phone: '+15551234567', bodyLength: 42, timestamp: '2026-02-13T21:30:00Z' }
[SMS Sync] ✅ SMS event inserted successfully: +15551234567
```

**Error logs**:
```
[SMS Service] Error receiving SMS: <error details>
[SMS Sync] SMS listener error: <error details>
[SMS Sync] Failed to insert SMS event: <error details>
```

---

## Dependencies

**New**:
- `@maniac-tech/react-native-expo-read-sms@9.0.2-alpha`

**Used**:
- `react-native` (Platform API)
- `react` (useEffect hook)
- `@supabase/supabase-js` (database client)
- `@/stores` (auth store for user ID)

---

## Testing Commands

**Rebuild native Android code**:
```bash
cd apps/mobile
npx expo prebuild --clean --platform android
```

**Check permissions in manifest**:
```bash
grep "SMS" android/app/src/main/AndroidManifest.xml
```

**Check TypeScript compilation**:
```bash
npx tsc --noEmit --project tsconfig.json
```

---

## Platform Support

| Platform | Support | Reason |
|----------|---------|--------|
| Android | ✅ Yes | Native SMS API available |
| iOS | ❌ No | Apple restricts SMS access |
| Web | ❌ No | Browser SMS API limited |

---

## Security Notes

1. **Permissions**: User must explicitly grant SMS permissions
2. **Data Storage**: SMS content stored in Supabase (ensure RLS policies)
3. **Encryption**: Use Supabase's built-in encryption at rest
4. **Privacy**: Users can revoke permissions anytime from Android settings
5. **Compliance**: Ensure GDPR/privacy policy covers SMS data collection

---

*Implementation Date: February 13, 2026*
*Ready for device testing*
