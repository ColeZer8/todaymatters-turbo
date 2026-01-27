# HealthKit — iOS Integration Notes (TodayMatters)

This doc records the **official** HealthKit integration approach we use in the Expo app, mirroring the process we used for Screen Time:

- Native functionality implemented as a **local Expo module** (`apps/mobile/modules/ios-insights`)
- JS wrappers under `apps/mobile/src/lib/ios-insights`
- UI driven from pages (screens), with templates remaining presentational

## Official references (source of truth)

- HealthKit overview: `https://developer.apple.com/documentation/healthkit`
- `HKHealthStore` (entry point): `https://developer.apple.com/documentation/healthkit/hkhealthstore`
- Request authorization: `https://developer.apple.com/documentation/healthkit/hkhealthstore/1614153-requestauthorization`
- Query predicate helper: `HKQuery.predicateForSamples(...)`: `https://developer.apple.com/documentation/healthkit/hkquery`
- Cumulative sums / averages: `HKStatisticsQuery`: `https://developer.apple.com/documentation/healthkit/hkstatisticsquery`
- Read samples: `HKSampleQuery`: `https://developer.apple.com/documentation/healthkit/hksamplequery`
- Sleep category type: `HKCategoryTypeIdentifier.sleepAnalysis`: `https://developer.apple.com/documentation/healthkit/hkcategorytypeidentifier/1615742-sleepanalysis`
- Workouts: `HKWorkout`: `https://developer.apple.com/documentation/healthkit/hkworkout`

Expo:

- Expo Modules API (get started): `https://docs.expo.dev/modules/get-started/`
- Module config (`expo-module.config.json`): `https://docs.expo.dev/modules/module-config/`

## What “pull all the health information” means in practice

HealthKit contains many thousands of possible signals across devices and apps. Apple expects apps to request access to **specific types** that match the product’s purpose; there’s no single “give me everything” permission.

In TodayMatters we request and read a **core set** that covers most wellbeing use cases:

- Steps (`HKQuantityTypeIdentifier.stepCount`) — cumulative sum
- Active energy (`HKQuantityTypeIdentifier.activeEnergyBurned`) — cumulative sum
- Distance walking/running (`HKQuantityTypeIdentifier.distanceWalkingRunning`) — cumulative sum
- Heart rate (`HKQuantityTypeIdentifier.heartRate`) — discrete average
- Resting heart rate (`HKQuantityTypeIdentifier.restingHeartRate`) — discrete average
- HRV SDNN (`HKQuantityTypeIdentifier.heartRateVariabilitySDNN`) — discrete average
- Sleep (`HKCategoryTypeIdentifier.sleepAnalysis`) — sum of “asleep” category durations
- Workouts (`HKWorkoutType.workoutType()`) — count + total duration

## Simulator notes

The simulator often has **no Health data** unless you add it in the Health app manually. On a real device, values should populate once the user has Health data recorded.
