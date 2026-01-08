# Insights (Cross-platform wrapper)

This directory provides a **platform-agnostic** API over:
- iOS: `@/lib/ios-insights` → local Expo module `ios-insights`
- Android: `@/lib/android-insights` → local Expo module `android-insights`

Rules:
- iOS behavior remains unchanged; Android is added in parallel.
- Pages may call `@/lib/insights` to avoid platform conditionals in screens.


