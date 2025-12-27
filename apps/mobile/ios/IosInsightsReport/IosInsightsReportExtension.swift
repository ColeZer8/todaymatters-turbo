import DeviceActivity
import FamilyControls
import Foundation
import SwiftUI

// A minimal Device Activity Report Extension.
// Official docs: https://developer.apple.com/documentation/deviceactivity/deviceactivityreport

@main
struct IosInsightsReportExtension: DeviceActivityReportExtension {
  var body: some DeviceActivityReportScene {
    TotalActivityReport { summaryText in
      ZStack {
        Color.black.ignoresSafeArea()
        Text(summaryText)
          .foregroundStyle(.white)
          .multilineTextAlignment(.center)
          .padding()
      }
    }
  }
}

extension DeviceActivityReport.Context {
  static let totalActivity = Self("total-activity")
}

struct TotalActivityReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .totalActivity
  let content: (String) -> AnyView

  init(content: @escaping (String) -> some View) {
    self.content = { AnyView(content($0)) }
  }

  func makeConfiguration(representing data: DeviceActivityResults<DeviceActivityData>) async -> String {
    let summary = await ScreenTimeAggregator.aggregateToday(from: data)

    // Persist for the main app (React Native) to read and render in our own UI.
    ScreenTimeCache.shared.write(summary: summary)

    // Keep the extension UI minimal (we primarily render in RN), but include enough
    // info for quick debugging.
    let total = ScreenTimeFormatter.formatDuration(seconds: summary.totalSeconds)
    let topAppLines = summary.topApps
      .prefix(5)
      .map { "• \($0.displayName): \(ScreenTimeFormatter.formatDuration(seconds: $0.durationSeconds))" }
      .joined(separator: "\n")

    return [
      "Today total: \(total)",
      "",
      "Top apps:",
      topAppLines.isEmpty ? "• (no data yet)" : topAppLines,
    ].joined(separator: "\n")
  }
}

private final class ScreenTimeCache {
  static let shared = ScreenTimeCache()

  // NOTE: Requires App Group entitlement on both the app + extension.
  private let appGroupId = "group.com.todaymatters.mobile"
  private let latestKey = "iosInsights.screenTime.summary.latest"

  private init() {}

  func write(summary: ScreenTimeSummary) {
    guard let defaults = UserDefaults(suiteName: appGroupId) else {
      return
    }
    do {
      let data = try JSONEncoder().encode(summary)
      defaults.set(String(data: data, encoding: .utf8), forKey: latestKey)
      defaults.set(summary.generatedAtIso, forKey: "iosInsights.screenTime.summary.generatedAtIso")
    } catch {
      // Extension is sandboxed; fail silently.
    }
  }
}

private struct ScreenTimeSummary: Codable {
  let generatedAtIso: String
  let dayStartIso: String
  let dayEndIso: String
  let totalSeconds: Int
  let topApps: [ScreenTimeAppUsage]
}

private struct ScreenTimeAppUsage: Codable {
  let bundleIdentifier: String
  let displayName: String
  let durationSeconds: Int
  let pickups: Int
}

private enum ScreenTimeAggregator {
  static func aggregateToday(from data: DeviceActivityResults<DeviceActivityData>) async -> ScreenTimeSummary {
    let calendar = Calendar.current
    let now = Date()
    let dayStart = calendar.startOfDay(for: now)
    let dayEnd = calendar.date(byAdding: .day, value: 1, to: dayStart) ?? now

    var usageByBundle: [String: ScreenTimeAppUsage] = [:]

    for await deviceData in data {
      for await segment in deviceData.activitySegments {
        for await categoryActivity in segment.categories {
          for await applicationActivity in categoryActivity.applications {
            let bundleId = applicationActivity.application.bundleIdentifier ?? "unknown"
            let displayName = applicationActivity.application.localizedDisplayName ?? bundleId

            let durationSeconds = Int(applicationActivity.totalActivityDuration)
            let pickups = Int(applicationActivity.numberOfPickups)

            if let existing = usageByBundle[bundleId] {
              usageByBundle[bundleId] = ScreenTimeAppUsage(
                bundleIdentifier: bundleId,
                displayName: existing.displayName,
                durationSeconds: existing.durationSeconds + durationSeconds,
                pickups: existing.pickups + pickups
              )
            } else {
              usageByBundle[bundleId] = ScreenTimeAppUsage(
                bundleIdentifier: bundleId,
                displayName: displayName,
                durationSeconds: durationSeconds,
                pickups: pickups
              )
            }
          }
        }
      }
    }

    let sorted = usageByBundle.values.sorted { $0.durationSeconds > $1.durationSeconds }
    let totalSeconds = sorted.reduce(0) { $0 + $1.durationSeconds }

    return ScreenTimeSummary(
      generatedAtIso: ScreenTimeFormatter.isoString(now),
      dayStartIso: ScreenTimeFormatter.isoString(dayStart),
      dayEndIso: ScreenTimeFormatter.isoString(dayEnd),
      totalSeconds: totalSeconds,
      topApps: Array(sorted.prefix(5))
    )
  }
}

private enum ScreenTimeFormatter {
  static func isoString(_ date: Date) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.string(from: date)
  }

  static func formatDuration(seconds: Int) -> String {
    let hours = seconds / 3600
    let minutes = (seconds % 3600) / 60

    if hours > 0 {
      return "\(hours)h \(minutes)m"
    }
    return "\(minutes)m"
  }
}


