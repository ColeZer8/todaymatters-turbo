import ExpoModulesCore
import Foundation
import HealthKit
import SwiftUI
import UIKit

// Screen Time APIs (iOS 15+)
import DeviceActivity
import FamilyControls
import ManagedSettings

public class IosInsightsModule: Module {
  private let healthStore = HKHealthStore()
  private let appGroupId = "group.com.todaymatters.mobile"
  private let screenTimeSummaryKeyPrefix = "iosInsights.screenTime.summary.latest"
  private let screenTimeGeneratedAtKeyPrefix = "iosInsights.screenTime.summary.generatedAtIso"
  private let screenTimeGeneratedAtLegacyKey = "iosInsights.screenTime.summary.generatedAtIso"

  public func definition() -> ModuleDefinition {
    Name("IosInsights")

    // MARK: - HealthKit

    AsyncFunction("isHealthDataAvailable") { () -> Bool in
      return HKHealthStore.isHealthDataAvailable()
    }

    AsyncFunction("requestHealthAuthorization") { (promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.resolve(false)
        return
      }

      var readTypes = Set<HKObjectType>()
      if let stepCount = HKObjectType.quantityType(forIdentifier: .stepCount) {
        readTypes.insert(stepCount)
      }
      if let heartRate = HKObjectType.quantityType(forIdentifier: .heartRate) {
        readTypes.insert(heartRate)
      }
      if let restingHeartRate = HKObjectType.quantityType(forIdentifier: .restingHeartRate) {
        readTypes.insert(restingHeartRate)
      }
      if let hrv = HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN) {
        readTypes.insert(hrv)
      }
      if let sleepAnalysis = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
        readTypes.insert(sleepAnalysis)
      }
      if let activeEnergy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) {
        readTypes.insert(activeEnergy)
      }
      if let distance = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning) {
        readTypes.insert(distance)
      }
      readTypes.insert(HKObjectType.workoutType())
      readTypes.insert(HKObjectType.activitySummaryType())

      healthStore.requestAuthorization(toShare: [], read: readTypes) { success, error in
        if let error {
          promise.reject("ERR_HEALTH_AUTH", error.localizedDescription)
          return
        }
        promise.resolve(success)
      }
    }

    AsyncFunction("getHealthAuthorizationStatus") { () -> String in
      return self.healthAuthorizationStatusString()
    }

    AsyncFunction("getTodayActivityRingsSummaryJson") { (promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.reject("ERR_HEALTH_UNAVAILABLE", "Health data not available on this device.")
        return
      }

      fetchTodayActivityRingsSummary { summary, error in
        if let error {
          promise.reject("ERR_HEALTH_QUERY", error)
          return
        }
        guard let summary else {
          promise.resolve(nil)
          return
        }

        do {
          let data = try JSONEncoder().encode(summary)
          let json = String(data: data, encoding: .utf8)
          promise.resolve(json)
        } catch {
          promise.reject("ERR_HEALTH_ENCODE", error.localizedDescription)
        }
      }
    }

    AsyncFunction("getLatestWorkoutSummaryJson") { (options: [String: Any], promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.reject("ERR_HEALTH_UNAVAILABLE", "Health data not available on this device.")
        return
      }

      guard let startMs = options["startDateMs"] as? Double,
            let endMs = options["endDateMs"] as? Double else {
        promise.reject("ERR_INVALID_ARGS", "Expected { startDateMs: number, endDateMs: number }.")
        return
      }

      let startDate = Date(timeIntervalSince1970: startMs / 1000.0)
      let endDate = Date(timeIntervalSince1970: endMs / 1000.0)

      fetchLatestWorkoutSummary(startDate: startDate, endDate: endDate) { summary, error in
        if let error {
          promise.reject("ERR_HEALTH_QUERY", error)
          return
        }
        guard let summary else {
          promise.resolve(nil)
          return
        }

        do {
          let data = try JSONEncoder().encode(summary)
          let json = String(data: data, encoding: .utf8)
          promise.resolve(json)
        } catch {
          promise.reject("ERR_HEALTH_ENCODE", error.localizedDescription)
        }
      }
    }

    AsyncFunction("getHealthSummaryJson") { (options: [String: Any], promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.reject("ERR_HEALTH_UNAVAILABLE", "Health data not available on this device.")
        return
      }

      guard let startMs = options["startDateMs"] as? Double,
            let endMs = options["endDateMs"] as? Double else {
        promise.reject("ERR_INVALID_ARGS", "Expected { startDateMs: number, endDateMs: number }.")
        return
      }

      let startDate = Date(timeIntervalSince1970: startMs / 1000.0)
      let endDate = Date(timeIntervalSince1970: endMs / 1000.0)

      let group = DispatchGroup()
      var errors: [String] = []

      var steps: Double?
      var activeEnergyKcal: Double?
      var distanceMeters: Double?
      var heartRateAvgBpm: Double?
      var restingHeartRateAvgBpm: Double?
      var hrvAvgSeconds: Double?
      var sleepSeconds: Double?
      var workoutsCount: Int?
      var workoutsDurationSeconds: Double?

      group.enter()
      fetchCumulativeSum(
        identifier: .stepCount,
        unit: HKUnit.count(),
        startDate: startDate,
        endDate: endDate
      ) { value, error in
        if let error { errors.append(error) }
        steps = value
        group.leave()
      }

      group.enter()
      fetchCumulativeSum(
        identifier: .activeEnergyBurned,
        unit: HKUnit.kilocalorie(),
        startDate: startDate,
        endDate: endDate
      ) { value, error in
        if let error { errors.append(error) }
        activeEnergyKcal = value
        group.leave()
      }

      group.enter()
      fetchCumulativeSum(
        identifier: .distanceWalkingRunning,
        unit: HKUnit.meter(),
        startDate: startDate,
        endDate: endDate
      ) { value, error in
        if let error { errors.append(error) }
        distanceMeters = value
        group.leave()
      }

      let bpmUnit = HKUnit.count().unitDivided(by: HKUnit.minute())

      group.enter()
      fetchDiscreteAverage(
        identifier: .heartRate,
        unit: bpmUnit,
        startDate: startDate,
        endDate: endDate
      ) { value, error in
        if let error { errors.append(error) }
        heartRateAvgBpm = value
        group.leave()
      }

      group.enter()
      fetchDiscreteAverage(
        identifier: .restingHeartRate,
        unit: bpmUnit,
        startDate: startDate,
        endDate: endDate
      ) { value, error in
        if let error { errors.append(error) }
        restingHeartRateAvgBpm = value
        group.leave()
      }

      group.enter()
      fetchDiscreteAverage(
        identifier: .heartRateVariabilitySDNN,
        unit: HKUnit.second(),
        startDate: startDate,
        endDate: endDate
      ) { value, error in
        if let error { errors.append(error) }
        hrvAvgSeconds = value
        group.leave()
      }

      group.enter()
      fetchSleepSeconds(startDate: startDate, endDate: endDate) { value, error in
        if let error { errors.append(error) }
        sleepSeconds = value
        group.leave()
      }

      group.enter()
      fetchWorkouts(startDate: startDate, endDate: endDate) { count, duration, error in
        if let error { errors.append(error) }
        workoutsCount = count
        workoutsDurationSeconds = duration
        group.leave()
      }

      group.notify(queue: .main) {
        let summary = HealthSummary(
          generatedAtIso: Iso8601.withFractionalSeconds(Date()),
          startIso: Iso8601.withFractionalSeconds(startDate),
          endIso: Iso8601.withFractionalSeconds(endDate),
          steps: steps,
          activeEnergyKcal: activeEnergyKcal,
          distanceWalkingRunningMeters: distanceMeters,
          heartRateAvgBpm: heartRateAvgBpm,
          restingHeartRateAvgBpm: restingHeartRateAvgBpm,
          hrvSdnnAvgSeconds: hrvAvgSeconds,
          sleepAsleepSeconds: sleepSeconds,
          workoutsCount: workoutsCount,
          workoutsDurationSeconds: workoutsDurationSeconds,
          errors: errors.isEmpty ? nil : errors
        )

        do {
          let data = try JSONEncoder().encode(summary)
          let json = String(data: data, encoding: .utf8)
          promise.resolve(json)
        } catch {
          promise.reject("ERR_HEALTH_ENCODE", error.localizedDescription)
        }
      }
    }

    AsyncFunction("getStepCountSum") { (options: [String: Any], promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.reject("ERR_HEALTH_UNAVAILABLE", "Health data not available on this device.")
        return
      }

      guard let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
        promise.reject("ERR_HEALTH_UNSUPPORTED", "Step count is not supported on this device.")
        return
      }

      guard let startMs = options["startDateMs"] as? Double,
            let endMs = options["endDateMs"] as? Double else {
        promise.reject("ERR_INVALID_ARGS", "Expected { startDateMs: number, endDateMs: number }.")
        return
      }

      let startDate = Date(timeIntervalSince1970: startMs / 1000.0)
      let endDate = Date(timeIntervalSince1970: endMs / 1000.0)

      let predicate = HKQuery.predicateForSamples(
        withStart: startDate,
        end: endDate,
        options: .strictStartDate
      )

      let query = HKStatisticsQuery(
        quantityType: stepType,
        quantitySamplePredicate: predicate,
        options: .cumulativeSum
      ) { _, statistics, error in
        if let error {
          promise.reject("ERR_HEALTH_QUERY", error.localizedDescription)
          return
        }

        let count = statistics?.sumQuantity()?.doubleValue(for: HKUnit.count()) ?? 0
        promise.resolve(count)
      }

      healthStore.execute(query)
    }

    // MARK: - Screen Time (FamilyControls)

    AsyncFunction("getScreenTimeAuthorizationStatus") { () -> String in
      return self.screenTimeAuthorizationStatusString()
    }

    AsyncFunction("requestScreenTimeAuthorization") { (promise: Promise) in
      if #available(iOS 16.0, *) {
        Task {
          do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            promise.resolve(self.screenTimeAuthorizationStatusString())
          } catch {
            promise.reject("ERR_SCREEN_TIME_AUTH", error.localizedDescription)
          }
        }
      } else {
        AuthorizationCenter.shared.requestAuthorization { result in
          switch result {
          case .success:
            promise.resolve(self.screenTimeAuthorizationStatusString())
          case .failure(let error):
            promise.reject("ERR_SCREEN_TIME_AUTH", error.localizedDescription)
          }
        }
      }
    }

    // MARK: - Screen Time Report (DeviceActivityReport)

    AsyncFunction("getCachedScreenTimeSummaryJson") { (range: String) -> String? in
      guard let defaults = UserDefaults(suiteName: self.appGroupId) else {
        return nil
      }
      // New format: range-scoped key.
      if let ranged = defaults.string(forKey: "\(self.screenTimeSummaryKeyPrefix).\(range)") {
        return ranged
      }

      // Back-compat: older extensions wrote without a range suffix.
      // Only treat this as valid for "today" reads to avoid leaking old day values into other ranges.
      if range == "today" {
        return defaults.string(forKey: "\(self.screenTimeSummaryKeyPrefix)")
      }
      return nil
    }

    AsyncFunction("presentScreenTimeReport") { (range: String, promise: Promise) in
      guard #available(iOS 16.0, *) else {
        promise.reject("ERR_UNSUPPORTED", "DeviceActivityReport requires iOS 16.0+.")
        return
      }

      DispatchQueue.main.async {
        guard let presenter = Self.findTopViewController() else {
          promise.reject("ERR_NO_VIEW_CONTROLLER", "Unable to find a view controller to present from.")
          return
        }

        let defaults = UserDefaults(suiteName: self.appGroupId)
        let generatedAtKey = "\(self.screenTimeGeneratedAtKeyPrefix).\(range)"
        // Baseline matters: if the extension is an older build, it may only write the legacy key.
        // If we start with a nil baseline but legacy has a value, we would instantly close and the
        // report wouldn’t have time to run (result: blank UI after a brief "sync").
        let initialGeneratedAtIso =
          defaults?.string(forKey: generatedAtKey) ??
          (range == "today" ? defaults?.string(forKey: self.screenTimeGeneratedAtLegacyKey) : nil)

        self.presentReportModal(
          presenter: presenter,
          range: range,
          generatedAtKey: generatedAtKey,
          initialGeneratedAtIso: initialGeneratedAtIso,
          onResolved: { promise.resolve(nil) }
        )
      }
    }

    // Back-compat alias: older JS called this method name.
    // Keep it invisible and map to the new implementation so physical devices don't regress.
    AsyncFunction("presentTodayScreenTimeReport") { (promise: Promise) in
      guard #available(iOS 16.0, *) else {
        promise.reject("ERR_UNSUPPORTED", "DeviceActivityReport requires iOS 16.0+.")
        return
      }

      DispatchQueue.main.async {
        guard let presenter = Self.findTopViewController() else {
          promise.reject("ERR_NO_VIEW_CONTROLLER", "Unable to find a view controller to present from.")
          return
        }

        let defaults = UserDefaults(suiteName: self.appGroupId)
        let range = "today"
        let generatedAtKey = "\(self.screenTimeGeneratedAtKeyPrefix).\(range)"
        let initialGeneratedAtIso =
          defaults?.string(forKey: generatedAtKey) ??
          defaults?.string(forKey: self.screenTimeGeneratedAtLegacyKey)

        self.presentReportModal(
          presenter: presenter,
          range: range,
          generatedAtKey: generatedAtKey,
          initialGeneratedAtIso: initialGeneratedAtIso,
          onResolved: { promise.resolve(nil) }
        )
      }
    }
  }

  private func screenTimeAuthorizationStatusString() -> String {
    let status = AuthorizationCenter.shared.authorizationStatus
    switch status {
    case .notDetermined:
      return "notDetermined"
    case .denied:
      return "denied"
    case .approved:
      return "approved"
    @unknown default:
      return "unknown"
    }
  }
}

@available(iOS 16.0, *)
private extension IosInsightsModule {
  func presentReportModal(
    presenter: UIViewController,
    range: String,
    generatedAtKey: String,
    initialGeneratedAtIso: String?,
    onResolved: @escaping () -> Void
  ) {
    // IMPORTANT: Apple's DeviceActivityReport extension REQUIRES the view to be properly
    // presented and visible. Hidden/invisible approaches do NOT work - the extension's
    // makeConfiguration method only runs when the DeviceActivityReport view is properly rendered.
    // This is why the original "black screen" worked but invisible approaches failed.

    let hosting = UIHostingController(
      rootView: IosInsightsScreenTimeReportModal(
        appGroupId: self.appGroupId,
        contextKey: range,
        generatedAtKey: generatedAtKey,
        initialGeneratedAtIso: initialGeneratedAtIso,
        onClose: {
          presenter.dismiss(animated: true) {
            onResolved()
          }
        }
      )
    )
    hosting.modalPresentationStyle = .fullScreen
    presenter.present(hosting, animated: true)
  }
}

private struct HealthSummary: Codable {
  let generatedAtIso: String
  let startIso: String
  let endIso: String

  let steps: Double?
  let activeEnergyKcal: Double?
  let distanceWalkingRunningMeters: Double?

  let heartRateAvgBpm: Double?
  let restingHeartRateAvgBpm: Double?
  let hrvSdnnAvgSeconds: Double?

  let sleepAsleepSeconds: Double?

  let workoutsCount: Int?
  let workoutsDurationSeconds: Double?

  let errors: [String]?
}

private struct ActivityRingsSummary: Codable {
  let generatedAtIso: String
  let dateIso: String

  let moveKcal: Double
  let moveGoalKcal: Double

  let exerciseMinutes: Double
  let exerciseGoalMinutes: Double

  let standHours: Double
  let standGoalHours: Double
}

private struct WorkoutSummary: Codable {
  let workoutStartIso: String
  let workoutEndIso: String
  let durationSeconds: Double
  let totalEnergyBurnedKcal: Double?
  let avgHeartRateBpm: Double?
  let maxHeartRateBpm: Double?
  let errors: [String]?
}

private enum Iso8601 {
  static func withFractionalSeconds(_ date: Date) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.string(from: date)
  }
}

private extension IosInsightsModule {
  func healthAuthorizationStatusString() -> String {
    // HealthKit authorization is per-type. We compute a coarse summary over the types we request.
    let types: [HKObjectType] = [
      HKObjectType.quantityType(forIdentifier: .stepCount),
      HKObjectType.quantityType(forIdentifier: .activeEnergyBurned),
      HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning),
      HKObjectType.quantityType(forIdentifier: .heartRate),
      HKObjectType.quantityType(forIdentifier: .restingHeartRate),
      HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN),
      HKObjectType.categoryType(forIdentifier: .sleepAnalysis),
      HKObjectType.workoutType(),
      HKObjectType.activitySummaryType(),
    ].compactMap { $0 }

    var authorizedCount = 0
    var deniedCount = 0
    var notDeterminedCount = 0

    for type in types {
      guard let sampleType = type as? HKSampleType else { continue }
      let status = healthStore.authorizationStatus(for: sampleType)
      switch status {
      case .notDetermined:
        notDeterminedCount += 1
      case .sharingDenied:
        deniedCount += 1
      case .sharingAuthorized:
        authorizedCount += 1
      @unknown default:
        break
      }
    }

    // UX rule:
    // - If we have ANY authorized type, treat Health as "connected" (authorized), even if some types were denied.
    //   iOS permissions are granular; "denied" should mean "no access at all".
    if authorizedCount > 0 { return "authorized" }
    if notDeterminedCount > 0 { return "notDetermined" }
    if deniedCount > 0 { return "denied" }
    return "unknown"
  }

  func fetchTodayActivityRingsSummary(completion: @escaping (ActivityRingsSummary?, String?) -> Void) {
    let calendar = Calendar.current
    let now = Date()
    let components = calendar.dateComponents([.year, .month, .day], from: now)

    // NOTE: Some SDKs don’t expose `HKQuery.predicateForActivitySummaries(...)` in Swift.
    // We query broadly (nil predicate) and then filter to today's date components.
    let predicate: NSPredicate? = nil
    let targetYear = components.year
    let targetMonth = components.month
    let targetDay = components.day

    let handler: (HKActivitySummaryQuery, [HKActivitySummary]?, Error?) -> Void = { _, summaries, error in
      if let error {
        completion(nil, "activitySummary: \(error.localizedDescription)")
        return
      }

      guard let summaries else {
        completion(nil, nil)
        return
      }

      var matched: HKActivitySummary?
      for summary in summaries {
        let dc = summary.dateComponents(for: calendar)
        if dc.year == targetYear, dc.month == targetMonth, dc.day == targetDay {
          matched = summary
          break
        }
      }

      guard let summary = matched else {
        completion(nil, nil)
        return
      }

      let move = summary.activeEnergyBurned.doubleValue(for: HKUnit.kilocalorie())
      let moveGoal = summary.activeEnergyBurnedGoal.doubleValue(for: HKUnit.kilocalorie())
      let exercise = summary.appleExerciseTime.doubleValue(for: HKUnit.minute())
      let exerciseGoal = summary.appleExerciseTimeGoal.doubleValue(for: HKUnit.minute())
      let stand = summary.appleStandHours.doubleValue(for: HKUnit.count())
      let standGoal = summary.appleStandHoursGoal.doubleValue(for: HKUnit.count())

      completion(
        ActivityRingsSummary(
          generatedAtIso: Iso8601.withFractionalSeconds(Date()),
          dateIso: Iso8601.withFractionalSeconds(now),
          moveKcal: move,
          moveGoalKcal: moveGoal,
          exerciseMinutes: exercise,
          exerciseGoalMinutes: exerciseGoal,
          standHours: stand,
          standGoalHours: standGoal
        ),
        nil
      )
    }
    let query = HKActivitySummaryQuery(predicate: predicate, resultsHandler: handler)
    healthStore.execute(query)
  }

  func fetchLatestWorkoutSummary(
    startDate: Date,
    endDate: Date,
    completion: @escaping (WorkoutSummary?, String?) -> Void
  ) {
    let workoutType = HKObjectType.workoutType()
    let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
    let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)

    let query = HKSampleQuery(sampleType: workoutType, predicate: predicate, limit: 1, sortDescriptors: [sort]) { [weak self] _, samples, error in
      guard let self else {
        completion(nil, "workouts: internal error")
        return
      }
      if let error {
        completion(nil, "workouts: \(error.localizedDescription)")
        return
      }

      guard let workout = (samples as? [HKWorkout])?.first else {
        completion(nil, nil)
        return
      }

      let bpmUnit = HKUnit.count().unitDivided(by: HKUnit.minute())
      let heartRateType = HKQuantityType.quantityType(forIdentifier: .heartRate)
      let fromWorkoutPredicate = HKQuery.predicateForObjects(from: workout)

      var avgBpm: Double?
      var maxBpm: Double?
      let group = DispatchGroup()
      var errors: [String] = []

      if let heartRateType {
        group.enter()
        let avgQuery = HKStatisticsQuery(quantityType: heartRateType, quantitySamplePredicate: fromWorkoutPredicate, options: .discreteAverage) { _, stats, err in
          if let err { errors.append("hrAvg: \(err.localizedDescription)") }
          avgBpm = stats?.averageQuantity()?.doubleValue(for: bpmUnit)
          group.leave()
        }
        healthStore.execute(avgQuery)

        group.enter()
        let maxQuery = HKStatisticsQuery(quantityType: heartRateType, quantitySamplePredicate: fromWorkoutPredicate, options: .discreteMax) { _, stats, err in
          if let err { errors.append("hrMax: \(err.localizedDescription)") }
          maxBpm = stats?.maximumQuantity()?.doubleValue(for: bpmUnit)
          group.leave()
        }
        healthStore.execute(maxQuery)
      }

      group.notify(queue: .main) {
        completion(
          WorkoutSummary(
            workoutStartIso: Iso8601.withFractionalSeconds(workout.startDate),
            workoutEndIso: Iso8601.withFractionalSeconds(workout.endDate),
            durationSeconds: workout.duration,
            totalEnergyBurnedKcal: workout.totalEnergyBurned?.doubleValue(for: HKUnit.kilocalorie()),
            avgHeartRateBpm: avgBpm,
            maxHeartRateBpm: maxBpm,
            errors: errors.isEmpty ? nil : errors
          ),
          nil
        )
      }
    }

    healthStore.execute(query)
  }

  func fetchCumulativeSum(
    identifier: HKQuantityTypeIdentifier,
    unit: HKUnit,
    startDate: Date,
    endDate: Date,
    completion: @escaping (Double?, String?) -> Void
  ) {
    guard let quantityType = HKQuantityType.quantityType(forIdentifier: identifier) else {
      completion(nil, "Unsupported quantity type: \(identifier.rawValue)")
      return
    }

    let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
    let query = HKStatisticsQuery(quantityType: quantityType, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, statistics, error in
      if let error {
        completion(nil, "\(identifier.rawValue): \(error.localizedDescription)")
        return
      }
      let value = statistics?.sumQuantity()?.doubleValue(for: unit) ?? 0
      completion(value, nil)
    }
    healthStore.execute(query)
  }

  func fetchDiscreteAverage(
    identifier: HKQuantityTypeIdentifier,
    unit: HKUnit,
    startDate: Date,
    endDate: Date,
    completion: @escaping (Double?, String?) -> Void
  ) {
    guard let quantityType = HKQuantityType.quantityType(forIdentifier: identifier) else {
      completion(nil, "Unsupported quantity type: \(identifier.rawValue)")
      return
    }

    let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
    let query = HKStatisticsQuery(quantityType: quantityType, quantitySamplePredicate: predicate, options: .discreteAverage) { _, statistics, error in
      if let error {
        completion(nil, "\(identifier.rawValue): \(error.localizedDescription)")
        return
      }
      let value = statistics?.averageQuantity()?.doubleValue(for: unit)
      completion(value, nil)
    }
    healthStore.execute(query)
  }

  func fetchSleepSeconds(
    startDate: Date,
    endDate: Date,
    completion: @escaping (Double?, String?) -> Void
  ) {
    guard let sleepType = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) else {
      completion(nil, "Unsupported category type: sleepAnalysis")
      return
    }

    let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
    let query = HKSampleQuery(sampleType: sleepType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
      if let error {
        completion(nil, "sleepAnalysis: \(error.localizedDescription)")
        return
      }

      let categorySamples = (samples as? [HKCategorySample]) ?? []
      var asleepValues: Set<Int> = [
        HKCategoryValueSleepAnalysis.asleep.rawValue,
      ]

      // Sleep stage values are iOS 16+.
      if #available(iOS 16.0, *) {
        asleepValues.formUnion([
          HKCategoryValueSleepAnalysis.asleepCore.rawValue,
          HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
          HKCategoryValueSleepAnalysis.asleepREM.rawValue,
          HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue,
        ])
      }

      let total = categorySamples.reduce(0.0) { acc, sample in
        guard asleepValues.contains(sample.value) else { return acc }
        return acc + sample.endDate.timeIntervalSince(sample.startDate)
      }
      completion(total, nil)
    }
    healthStore.execute(query)
  }

  func fetchWorkouts(
    startDate: Date,
    endDate: Date,
    completion: @escaping (Int?, Double?, String?) -> Void
  ) {
    let workoutType = HKObjectType.workoutType()
    let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)

    let query = HKSampleQuery(sampleType: workoutType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
      if let error {
        completion(nil, nil, "workouts: \(error.localizedDescription)")
        return
      }

      let workouts = (samples as? [HKWorkout]) ?? []
      let totalDuration = workouts.reduce(0.0) { $0 + $1.duration }
      completion(workouts.count, totalDuration, nil)
    }
    healthStore.execute(query)
  }
}

@available(iOS 16.0, *)
private struct IosInsightsScreenTimeReportModal: View {
  let appGroupId: String
  let contextKey: String
  let generatedAtKey: String
  let initialGeneratedAtIso: String?
  let onClose: () -> Void

  var body: some View {
    NavigationStack {
      // The DeviceActivityReport renders the SwiftUI view from the extension (ScreenTimeReportView).
      // The extension handles all the content UI. We just provide a nav bar with Done button.
      DeviceActivityReport(context(for: contextKey), filter: buildFilter(contextKey: contextKey))
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .topBarLeading) {
            Button(action: onClose) {
              Image(systemName: "arrow.left")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color(red: 0.067, green: 0.094, blue: 0.153))
            }
          }
          ToolbarItem(placement: .principal) {
            Text("Digital Wellbeing")
              .font(.system(size: 12, weight: .bold))
              .tracking(1.4)
              .textCase(.uppercase)
              .foregroundStyle(Color(red: 0.145, green: 0.388, blue: 0.922))
          }
          ToolbarItem(placement: .topBarTrailing) {
            Button(action: {}) {
              Image(systemName: "slider.horizontal.3")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color(red: 0.067, green: 0.094, blue: 0.153))
            }
          }
        }
        .toolbarBackground(
          LinearGradient(
            colors: [
              Color(red: 0.984, green: 0.988, blue: 1.0),
              Color(red: 0.957, green: 0.969, blue: 1.0),
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
          ),
          for: .navigationBar
        )
        .toolbarBackground(.visible, for: .navigationBar)
    }
  }
}

@available(iOS 16.0, *)
private extension DeviceActivityReport.Context {
  // CRITICAL: These MUST match the context strings in IosInsightsReportExtension.swift exactly.
  // The extension's DeviceActivityReportScene.context must equal the context we pass to DeviceActivityReport.
  static let totalActivityToday = Self("total-activity-today")
  static let totalActivityWeek = Self("total-activity-week")
  static let totalActivityMonth = Self("total-activity-month")
  static let totalActivityYear = Self("total-activity-year")
  // Legacy context from the original working version - use this for "today" to ensure backward compatibility.
  static let totalActivity = Self("total-activity")
}

@available(iOS 16.0, *)
private func context(for range: String) -> DeviceActivityReport.Context {
  switch range {
  case "week":
    return .totalActivityWeek
  case "month":
    return .totalActivityMonth
  case "year":
    return .totalActivityYear
  default:
    // Use the LEGACY context for "today" to maximize compatibility.
    // The new extension supports BOTH "total-activity" and "total-activity-today" contexts.
    return .totalActivity
  }
}

@available(iOS 16.0, *)
private func buildFilter(contextKey: String) -> DeviceActivityFilter {
  let calendar = Calendar.current
  let now = Date()
  let interval: DateInterval

  switch contextKey {
  case "week":
    let weekStart = calendar.startOfDay(for: calendar.date(byAdding: .day, value: -6, to: now) ?? now)
    let weekEnd = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now)) ?? now
    interval = DateInterval(start: weekStart, end: weekEnd)
  case "month":
    let monthStart = calendar.startOfDay(for: calendar.date(byAdding: .day, value: -29, to: now) ?? now)
    let monthEnd = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now)) ?? now
    interval = DateInterval(start: monthStart, end: monthEnd)
  case "year":
    let yearStart = calendar.startOfDay(for: calendar.date(byAdding: .day, value: -364, to: now) ?? now)
    let yearEnd = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now)) ?? now
    interval = DateInterval(start: yearStart, end: yearEnd)
  default:
    // For "today", use the full day interval (midnight to midnight) like the original working version.
    // This is critical - using a partial day (start to now) may produce incomplete data.
    interval = calendar.dateInterval(of: .day, for: now) ?? DateInterval(start: calendar.startOfDay(for: now), end: now)
  }

  // IMPORTANT:
  // Do NOT pass empty `applications/categories/webDomains` sets — that filters to "none"
  // and yields blank reports.
  // This initializer intentionally leaves app/category/domain filters unspecified (all).
  return DeviceActivityFilter(
    segment: .daily(during: interval),
    users: .all,
    devices: .init([.iPhone])
  )
}

private extension IosInsightsModule {
  static func findTopViewController() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes
    let windowScene = scenes.compactMap { $0 as? UIWindowScene }.first(where: { $0.activationState == .foregroundActive })
    let window = windowScene?.windows.first(where: { $0.isKeyWindow }) ?? windowScene?.windows.first
    guard var top = window?.rootViewController else { return nil }

    while let presented = top.presentedViewController {
      top = presented
    }

    if let nav = top as? UINavigationController {
      return nav.visibleViewController ?? nav
    }
    if let tab = top as? UITabBarController {
      return tab.selectedViewController ?? tab
    }
    return top
  }
}


