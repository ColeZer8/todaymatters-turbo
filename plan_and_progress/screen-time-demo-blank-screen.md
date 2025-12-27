# Screen Time Demo Screen — Blank Render Fix

- Status: In Progress
- Owner: cole
- Started: 2025-12-23
- Completed: -

## Objective

Fix the `/demo-screen-time` screen rendering as blank on iOS simulator, while keeping the Screen Time demo fully functional and consistent with existing analytics UI patterns.

## Plan

1. Remove any styling/prop patterns that can cause RN/NativeWind edge-case rendering issues (e.g. `contentContainerClassName`, unsupported variants).
2. Add explicit layout styles (e.g. `flex: 1`) to ensure children always render.
3. Harden “safe” iOS-insights wrappers so native errors can’t blank the screen.

## Done Criteria

- Screen Time demo screen visibly renders header/cards/toolbar on iOS simulator.
- Allow + Refresh flows still work (or show correct empty/unauthorized states).
- `pnpm --filter mobile lint` and `pnpm --filter mobile check-types` pass.

## Progress

- 2025-12-23:
  - Fixed Screen Time template layout props to avoid RN/NativeWind edge-cases (`contentContainerClassName`, `disabled:` variant) and ensured `flex: 1` layout.
  - Fixed `ios-insights` autolinking config (`expo-module.config.json`) and hardened “safe” wrappers to never throw when native module is missing.
  - Fixed iOS build failure for the report extension by setting `CODE_SIGN_ALLOW_ENTITLEMENTS_MODIFICATION=YES` for the `IosInsightsReport` target.

## Verification

- `pnpm --filter mobile check-types` ✅
- `pnpm --filter mobile lint` ✅
- `pnpm --filter mobile ios --no-install` ✅ (build + install succeeded)

## Outcomes

- (pending)

## Follow-ups

- If blank screen persists, capture the runtime exception from device logs and patch the exact failing component callsite.


