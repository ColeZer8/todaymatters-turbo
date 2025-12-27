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
  private let screenTimeSummaryKey = "iosInsights.screenTime.summary.latest"

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
      if let sleepAnalysis = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
        readTypes.insert(sleepAnalysis)
      }
      if let activeEnergy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) {
        readTypes.insert(activeEnergy)
      }

      healthStore.requestAuthorization(toShare: [], read: readTypes) { success, error in
        if let error {
          promise.reject("ERR_HEALTH_AUTH", error.localizedDescription)
          return
        }
        promise.resolve(success)
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
            // Official API (iOS 16+): request authorization for the current device user.
            // See: AuthorizationCenter.requestAuthorization(for:)
            try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            promise.resolve(self.screenTimeAuthorizationStatusString())
          } catch {
            promise.reject("ERR_SCREEN_TIME_AUTH", error.localizedDescription)
          }
        }
      } else {
        // Older API variant (iOS 15.x): request authorization without member selection.
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

    AsyncFunction("getCachedScreenTimeSummaryJson") { () -> String? in
      guard let defaults = UserDefaults(suiteName: self.appGroupId) else {
        return nil
      }
      return defaults.string(forKey: self.screenTimeSummaryKey)
    }

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

        let hosting = UIHostingController(rootView: IosInsightsScreenTimeReportModal(
          onClose: {
            presenter.dismiss(animated: true) {
              promise.resolve(nil)
            }
          }
        ))
        hosting.modalPresentationStyle = .formSheet
        presenter.present(hosting, animated: true)
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
private struct IosInsightsScreenTimeReportModal: View {
  let onClose: () -> Void

  @State private var filter: DeviceActivityFilter = {
    let calendar = Calendar.current
    let now = Date()
    let interval = calendar.dateInterval(of: .day, for: now) ?? DateInterval(start: now, end: now)

    return DeviceActivityFilter(
      segment: .daily(during: interval),
      users: .all,
      devices: .init([.iPhone]),
      applications: Set<ApplicationToken>(),
      categories: Set<ActivityCategoryToken>(),
      webDomains: Set<WebDomainToken>()
    )
  }()

  var body: some View {
    NavigationStack {
      VStack(spacing: 0) {
        DeviceActivityReport(.totalActivity, filter: filter)
          .frame(maxWidth: .infinity, maxHeight: .infinity)
      }
      .navigationTitle("Screen Time (Today)")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Button("Done") { onClose() }
        }
      }
    }
  }
}

@available(iOS 16.0, *)
private extension DeviceActivityReport.Context {
  static let totalActivity = Self("total-activity")
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


