# Android SMS/Calls Implementation - Quick Start

**Read this first, then dive into full research doc.**

---

## 🚨 CRITICAL ALERT: Google Play Store Risk

**Google Play SEVERELY restricts SMS/Call Log permissions.**

Your app MUST either:
1. Be the default SMS/Phone app (TodayMatters is not), OR
2. Qualify for an "exception" and get manual approval from Google

**TodayMatters likely qualifies for "Device Automation" exception.**

**BUT:** Many developers report rejections even with valid use cases.

**Risk Level:** 40-60% chance of rejection

---

## ✅ Recommended Approach

### Phase 1: SMS Only (Lowest Risk)
- Use `@maniac-tech/react-native-expo-read-sms` (Expo compatible)
- Real-time SMS ingestion into `tm.events` table
- Event type: `sms` (already in your enum)
- 2-3 days implementation

### Phase 2: Google Play Submission
- Fill out Permissions Declaration Form
- Record video demo
- Update privacy policy
- Cross fingers 🤞

### Phase 3: If Approved, Add Call Logs
- Use `react-native-call-log` (requires Expo Config Plugin or ejecting)
- Event type: `phone_call` (already in your enum)

---

## 📦 Installation (SMS)

```bash
npx expo install @maniac-tech/react-native-expo-read-sms
```

Add to `app.json`:
```json
{
  "expo": {
    "plugins": [
      "@maniac-tech/react-native-expo-read-sms"
    ],
    "android": {
      "permissions": ["READ_SMS", "RECEIVE_SMS"]
    }
  }
}
```

---

## 🎯 Implementation Checklist

### Technical:
- [ ] Install SMS library
- [ ] Add permissions to app.json
- [ ] Create permission request UI (explain WHY to user)
- [ ] Create `sms-service.ts` wrapper
- [ ] Create `use-sms-sync.ts` hook
- [ ] Insert events into `tm.events` table
- [ ] Test on physical Android device

### Google Play:
- [ ] Update privacy policy (SMS disclosure)
- [ ] Fill Permissions Declaration Form
- [ ] Record video demo (permission flow + feature)
- [ ] Prepare "Device Automation" justification
- [ ] Have backup plan if rejected

---

## 📊 Event Schema (Already Exists!)

Your `tm.events` table already supports:
- ✅ Event type: `sms`
- ✅ Event type: `phone_call`
- ✅ `sent_at` and `received_at` timestamps
- ✅ `meta` JSON field for raw data

**You just need to insert events with this structure:**

```typescript
{
  user_id: "user_123",
  type: "sms",
  title: "SMS from +1234567890",
  received_at: "2026-02-13T15:30:00Z",
  meta: {
    direction: "inbound",
    phone_number: "+1234567890",
    message_body: "Hello!",
    raw: { /* Android SMS object */ }
  }
}
```

---

## ⚠️ Risks & Mitigation

| Risk | Level | Mitigation |
|------|-------|-----------|
| Google Play rejection | HIGH | Have backup plan (manual entry, integrations) |
| Privacy concerns | MEDIUM | Clear permission flow, data minimization |
| Battery drain | LOW | Event-driven listeners (efficient) |
| Maintenance | MEDIUM | Pin versions, fork if needed |

---

## 🎬 Next Steps

1. **Read full research doc:** `memory/android-sms-calls-research.md`
2. **Make decision:** Is Play Store risk acceptable?
3. **If yes:** Start with Phase 1 (SMS only)
4. **If no:** Explore alternatives (manual entry, IFTTT integration)

---

**Questions? Check the full research doc for detailed implementation examples, code snippets, and 5+ GitHub repos.**

**Timeline:** 1 week to implement + 1 week waiting for Google approval

**Recommended?** YES, but with caution and backup plan.
