import DeviceActivity
import FamilyControls
import Foundation
import SwiftUI

// A minimal Device Activity Report Extension.
// Official docs: https://developer.apple.com/documentation/deviceactivity/deviceactivityreport

private enum ScreenTimeRangeKey: String, CaseIterable {
  case today
  case week
  case month
  case year
}

@main
struct IosInsightsReportExtension: DeviceActivityReportExtension {
  var body: some DeviceActivityReportScene {
    // New range-based reports
    TotalActivityTodayReport { summary in
      ScreenTimeReportView(summary: summary)
    }
    TotalActivityWeekReport { summary in
      ScreenTimeReportView(summary: summary)
    }
    TotalActivityMonthReport { summary in
      ScreenTimeReportView(summary: summary)
    }
    TotalActivityYearReport { summary in
      ScreenTimeReportView(summary: summary)
    }
    // Legacy report (for backward compatibility with older main app builds)
    TotalActivityLegacyReport { summary in
      ScreenTimeReportView(summary: summary)
    }
  }
}

extension DeviceActivityReport.Context {
  // New range-based contexts
  static let totalActivityToday = Self("total-activity-today")
  static let totalActivityWeek = Self("total-activity-week")
  static let totalActivityMonth = Self("total-activity-month")
  static let totalActivityYear = Self("total-activity-year")
  // Legacy context from the original working version (for backward compatibility)
  static let totalActivity = Self("total-activity")
}

struct TotalActivityTodayReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .totalActivityToday
  let content: (ScreenTimeSummary) -> AnyView

  init(content: @escaping (ScreenTimeSummary) -> some View) {
    self.content = { AnyView(content($0)) }
  }

  func makeConfiguration(representing data: DeviceActivityResults<DeviceActivityData>) async -> ScreenTimeSummary {
    let summary = await ScreenTimeAggregator.aggregate(range: .today, from: data)

    // Persist for the main app (React Native) to read and render in our own UI.
    ScreenTimeCache.shared.write(summary: summary, range: .today)
    return summary
  }
}

struct TotalActivityWeekReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .totalActivityWeek
  let content: (ScreenTimeSummary) -> AnyView

  init(content: @escaping (ScreenTimeSummary) -> some View) {
    self.content = { AnyView(content($0)) }
  }

  func makeConfiguration(representing data: DeviceActivityResults<DeviceActivityData>) async -> ScreenTimeSummary {
    let summary = await ScreenTimeAggregator.aggregate(range: .week, from: data)
    ScreenTimeCache.shared.write(summary: summary, range: .week)
    return summary
  }
}

struct TotalActivityMonthReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .totalActivityMonth
  let content: (ScreenTimeSummary) -> AnyView

  init(content: @escaping (ScreenTimeSummary) -> some View) {
    self.content = { AnyView(content($0)) }
  }

  func makeConfiguration(representing data: DeviceActivityResults<DeviceActivityData>) async -> ScreenTimeSummary {
    let summary = await ScreenTimeAggregator.aggregate(range: .month, from: data)
    ScreenTimeCache.shared.write(summary: summary, range: .month)
    return summary
  }
}

struct TotalActivityYearReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .totalActivityYear
  let content: (ScreenTimeSummary) -> AnyView

  init(content: @escaping (ScreenTimeSummary) -> some View) {
    self.content = { AnyView(content($0)) }
  }

  func makeConfiguration(representing data: DeviceActivityResults<DeviceActivityData>) async -> ScreenTimeSummary {
    let summary = await ScreenTimeAggregator.aggregate(range: .year, from: data)
    ScreenTimeCache.shared.write(summary: summary, range: .year)
    return summary
  }
}

// Legacy report for backward compatibility with the original "total-activity" context.
// This ensures older main app builds can still trigger a report.
struct TotalActivityLegacyReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .totalActivity
  let content: (ScreenTimeSummary) -> AnyView

  init(content: @escaping (ScreenTimeSummary) -> some View) {
    self.content = { AnyView(content($0)) }
  }

  func makeConfiguration(representing data: DeviceActivityResults<DeviceActivityData>) async -> ScreenTimeSummary {
    let summary = await ScreenTimeAggregator.aggregate(range: .today, from: data)
    // Write to both the legacy key (for older main app) and the new ranged key.
    ScreenTimeCache.shared.writeLegacy(summary: summary)
    ScreenTimeCache.shared.write(summary: summary, range: .today)
    return summary
  }
}

private final class ScreenTimeCache {
  static let shared = ScreenTimeCache()

  // NOTE: Requires App Group entitlement on both the app + extension.
  private let appGroupId = "group.com.todaymatters.mobile"
  private let latestKeyPrefix = "iosInsights.screenTime.summary.latest"
  private let generatedAtKeyPrefix = "iosInsights.screenTime.summary.generatedAtIso"
  // Legacy keys (no range suffix) - for backward compatibility with older main app builds.
  private let legacyLatestKey = "iosInsights.screenTime.summary.latest"
  private let legacyGeneratedAtKey = "iosInsights.screenTime.summary.generatedAtIso"

  private init() {}

  func write(summary: ScreenTimeSummary, range: ScreenTimeRangeKey) {
    guard let defaults = UserDefaults(suiteName: appGroupId) else {
      return
    }
    do {
      let data = try JSONEncoder().encode(summary)
      defaults.set(String(data: data, encoding: .utf8), forKey: "\(latestKeyPrefix).\(range.rawValue)")
      defaults.set(summary.generatedAtIso, forKey: "\(generatedAtKeyPrefix).\(range.rawValue)")
    } catch {
      // Extension is sandboxed; fail silently.
    }
  }

  /// Writes to the legacy (non-ranged) keys for backward compatibility with older main app builds.
  func writeLegacy(summary: ScreenTimeSummary) {
    guard let defaults = UserDefaults(suiteName: appGroupId) else {
      return
    }
    do {
      let data = try JSONEncoder().encode(summary)
      defaults.set(String(data: data, encoding: .utf8), forKey: legacyLatestKey)
      defaults.set(summary.generatedAtIso, forKey: legacyGeneratedAtKey)
    } catch {
      // Extension is sandboxed; fail silently.
    }
  }
}

struct ScreenTimeSummary: Codable {
  let generatedAtIso: String
  let dayStartIso: String
  let dayEndIso: String
  let totalSeconds: Int
  let topApps: [ScreenTimeAppUsage]
  let hourlyBucketsSeconds: [Int]?
  // Per-app hourly breakdown: [hour: [appId: seconds]]
  let hourlyByApp: [String: [Int: Int]]?
  // Per-app time intervals (sessions)
  let appSessions: [ScreenTimeAppSession]?
}

struct ScreenTimeAppUsage: Codable {
  let bundleIdentifier: String
  let displayName: String
  let durationSeconds: Int
  let pickups: Int
}

struct ScreenTimeAppSession: Codable {
  let bundleIdentifier: String
  let displayName: String
  let startedAtIso: String
  let endedAtIso: String
  let durationSeconds: Int
  let pickups: Int
}

// MARK: - Design Tokens (matching RN theme)
private enum DesignTokens {
  static let bgGradientStart = Color(red: 0.984, green: 0.988, blue: 1.0) // #FBFCFF
  static let bgGradientEnd = Color(red: 0.957, green: 0.969, blue: 1.0) // #F4F7FF
  static let brandPrimary = Color(red: 0.145, green: 0.388, blue: 0.922) // #2563EB
  static let textPrimary = Color(red: 0.067, green: 0.094, blue: 0.153) // #111827
  static let textSecondary = Color(red: 0.42, green: 0.45, blue: 0.50) // #6B7280
  static let textTertiary = Color(red: 0.55, green: 0.58, blue: 0.63) // #9CA3AF
  static let cardBorder = Color(red: 0.902, green: 0.918, blue: 0.949) // #E6EAF2
  static let cardBg = Color.white
  static let pillBg = Color(red: 0.933, green: 0.941, blue: 1.0) // #EEF0FF
  static let barBg = Color(red: 0.898, green: 0.906, blue: 0.922) // #E5E7EB
  static let successGreen = Color(red: 0.086, green: 0.639, blue: 0.290) // #16A34A
  static let suggestionBg = Color(red: 0.925, green: 0.988, blue: 0.961) // #ECFDF5
  static let suggestionBorder = Color(red: 0.525, green: 0.937, blue: 0.675) // #86EFAC
  static let suggestionText = Color(red: 0.078, green: 0.325, blue: 0.176) // #14532D
  static let suggestionLabel = Color(red: 0.086, green: 0.396, blue: 0.204) // #166534
}

private struct ScreenTimeReportView: View {
  let summary: ScreenTimeSummary

  // Computed values
  private var score: Int {
    let minutes = summary.totalSeconds / 60
    let pickups = summary.topApps.reduce(0) { $0 + $1.pickups }
    let minutesPenalty = min(70, minutes / 6)
    let pickupsPenalty = min(30, pickups / 8)
    return max(0, min(100, 100 - minutesPenalty - pickupsPenalty))
  }

  private var scoreLabel: String {
    if score >= 80 { return "Balanced" }
    if score >= 60 { return "Steady" }
    return "Overloaded"
  }

  private var scoreTrendLabel: String {
    if score >= 80 { return "Improving" }
    if score >= 60 { return "Stable" }
    return "Needs focus"
  }

  private var insightBody: String {
    let minutes = summary.totalSeconds / 60
    if minutes == 0 { return "No usage yet today. You're set up for a focused day." }
    if minutes <= 90 { return "Your screen time is light today—great control. Keep momentum by batching check-ins." }
    if minutes <= 180 { return "You're in a solid range. Try compressing social check-ins into one window to protect deep work." }
    return "Screen time is trending high today. A small boundary (like a 15-minute cap) can protect your evening routine."
  }

  private var suggestionBody: String {
    if let top = summary.topApps.first?.displayName {
      return "Try setting a 15-minute limit for \(top) this evening to protect your wind-down routine."
    }
    return "Try a 15-minute limit for social apps this evening to protect your wind-down routine."
  }

  private var maxAppSeconds: Int {
    max(summary.topApps.map(\.durationSeconds).max() ?? 1, 1)
  }

  private var maxHourlySeconds: Int {
    max((summary.hourlyBucketsSeconds ?? []).max() ?? 1, 1)
  }

  var body: some View {
    ZStack {
      LinearGradient(
        colors: [DesignTokens.bgGradientStart, DesignTokens.bgGradientEnd],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
      .ignoresSafeArea()

      ScrollView(showsIndicators: false) {
        VStack(alignment: .leading, spacing: 20) {
          // Range Toggle (visual only - extension doesn't control this)
          rangeToggle

          // Summary Card with Score Donut
          summaryCard

          // AI Insight Section
          aiInsightSection

          // Hourly Activity Chart
          hourlyActivitySection

          // Top Apps List
          topAppsSection
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 40)
      }
    }
  }

  // MARK: - Range Toggle
  private var rangeToggle: some View {
    HStack(spacing: 0) {
      // "Today" is selected (the extension always shows today for now)
      Text("Today")
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(DesignTokens.textPrimary)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(DesignTokens.cardBg)
        .clipShape(Capsule())
        .shadow(color: Color.black.opacity(0.06), radius: 3, x: 0, y: 1)

      ForEach(["Week", "Month", "Year"], id: \.self) { label in
        Text(label)
          .font(.system(size: 13, weight: .medium))
          .foregroundStyle(DesignTokens.textSecondary)
          .padding(.horizontal, 12)
          .padding(.vertical, 8)
      }
    }
    .padding(4)
    .background(DesignTokens.barBg.opacity(0.5))
    .clipShape(Capsule())
  }

  // MARK: - Summary Card
  private var summaryCard: some View {
    VStack(spacing: 0) {
      HStack(alignment: .top, spacing: 16) {
        // Left side: Score label + total + delta
        VStack(alignment: .leading, spacing: 2) {
          Text(scoreLabel)
            .font(.system(size: 22, weight: .bold))
            .foregroundStyle(DesignTokens.brandPrimary)

          Text("Today's Total")
            .font(.system(size: 11, weight: .bold))
            .tracking(1.0)
            .textCase(.uppercase)
            .foregroundStyle(DesignTokens.textSecondary)
            .padding(.top, 2)

          Text(ScreenTimeFormatter.formatDuration(seconds: summary.totalSeconds))
            .font(.system(size: 32, weight: .bold))
            .foregroundStyle(DesignTokens.textPrimary)
            .padding(.top, 2)

          // Delta placeholder (would need historical data)
          Text("↓ 30m vs Avg")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(DesignTokens.textSecondary)
            .padding(.top, 4)
        }

        Spacer()

        // Right side: Score Donut (matching the mockup exactly)
        VStack(spacing: 4) {
          ZStack {
            // Background ring
            Circle()
              .stroke(DesignTokens.barBg, lineWidth: 10)
              .frame(width: 80, height: 80)

            // Progress ring
            Circle()
              .trim(from: 0, to: CGFloat(score) / 100.0)
              .stroke(
                DesignTokens.brandPrimary,
                style: StrokeStyle(lineWidth: 10, lineCap: .round)
              )
              .frame(width: 80, height: 80)
              .rotationEffect(.degrees(-90))

            // Center text
            VStack(spacing: 0) {
              Text("\(score)")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(DesignTokens.brandPrimary)
              Text("SCORE")
                .font(.system(size: 9, weight: .bold))
                .tracking(1.0)
                .foregroundStyle(DesignTokens.textSecondary)
            }
          }

          Text(scoreTrendLabel)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(DesignTokens.textSecondary)
        }
      }
    }
    .padding(16)
    .background(DesignTokens.cardBg)
    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 20, style: .continuous)
        .stroke(DesignTokens.cardBorder, lineWidth: 1)
    )
    .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 4)
  }

  // MARK: - AI Insight Section
  private var aiInsightSection: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 8) {
        Image(systemName: "sparkles")
          .font(.system(size: 14, weight: .semibold))
          .foregroundStyle(DesignTokens.brandPrimary)
        Text("AI Optimization Insight")
          .font(.system(size: 14, weight: .bold))
          .foregroundStyle(DesignTokens.textPrimary)
      }

      Text(insightBody)
        .font(.system(size: 14, weight: .regular))
        .foregroundStyle(DesignTokens.textSecondary)
        .fixedSize(horizontal: false, vertical: true)

      // Suggestion card
      VStack(alignment: .leading, spacing: 8) {
        Text("Suggestion")
          .font(.system(size: 12, weight: .bold))
          .tracking(1.2)
          .textCase(.uppercase)
          .foregroundStyle(DesignTokens.suggestionLabel)

        Text(suggestionBody)
          .font(.system(size: 14, weight: .regular))
          .foregroundStyle(DesignTokens.suggestionText)
          .fixedSize(horizontal: false, vertical: true)
      }
      .padding(16)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(DesignTokens.suggestionBg)
      .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
      .overlay(
        RoundedRectangle(cornerRadius: 16, style: .continuous)
          .stroke(DesignTokens.suggestionBorder, lineWidth: 1)
      )
    }
    .padding(.horizontal, 4)
  }

  // MARK: - Hourly Activity Section
  private var hourlyActivitySection: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Hourly Activity")
        .font(.system(size: 16, weight: .bold))
        .foregroundStyle(DesignTokens.textPrimary)

      GeometryReader { geometry in
        let buckets = summary.hourlyBucketsSeconds ?? Array(repeating: 0, count: 24)
        let barWidth: CGFloat = 8
        let totalBars: CGFloat = 24
        let spacing = (geometry.size.width - (barWidth * totalBars)) / (totalBars - 1)

        HStack(alignment: .bottom, spacing: max(2, spacing)) {
          ForEach(0..<24, id: \.self) { idx in
            let value = buckets.indices.contains(idx) ? buckets[idx] : 0
            let height = maxHourlySeconds <= 0 ? 4.0 : max(4.0, Double(value) / Double(maxHourlySeconds) * 56.0)
            let showLabel = idx % 3 == 0

            VStack(spacing: 4) {
              // Bar track
              ZStack(alignment: .bottom) {
                RoundedRectangle(cornerRadius: 3, style: .continuous)
                  .fill(DesignTokens.barBg)
                  .frame(height: 56)

                RoundedRectangle(cornerRadius: 3, style: .continuous)
                  .fill(DesignTokens.brandPrimary)
                  .frame(height: CGFloat(height))
              }
              .frame(width: barWidth)

              // Label
              if showLabel {
                Text(formatHourLabel(idx))
                  .font(.system(size: 9, weight: .semibold))
                  .foregroundStyle(DesignTokens.textTertiary)
                  .frame(width: 28)
                  .lineLimit(1)
              } else {
                Color.clear.frame(height: 14)
              }
            }
          }
        }
      }
      .frame(height: 80)
    }
  }

  // MARK: - Top Apps Section
  private var topAppsSection: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Top Apps")
        .font(.system(size: 16, weight: .bold))
        .foregroundStyle(DesignTokens.textPrimary)
        .padding(.horizontal, 4)

      if summary.topApps.isEmpty {
        Text("No usage data yet.")
          .font(.system(size: 14, weight: .regular))
          .foregroundStyle(DesignTokens.textSecondary)
          .padding(.horizontal, 4)
      } else {
        VStack(spacing: 12) {
          ForEach(summary.topApps, id: \.bundleIdentifier) { app in
            topAppCard(app: app)
          }
        }
      }
    }
  }

  private func topAppCard(app: ScreenTimeAppUsage) -> some View {
    let category = categorizeApp(app.displayName)
    let iconInfo = getAppIcon(app.displayName)
    let pct = min(1.0, Double(app.durationSeconds) / Double(maxAppSeconds))

    return HStack(spacing: 12) {
      // App icon (using SF Symbols that match common apps)
      ZStack {
        RoundedRectangle(cornerRadius: 12, style: .continuous)
          .fill(iconInfo.bgColor)
          .frame(width: 44, height: 44)
        Image(systemName: iconInfo.symbol)
          .font(.system(size: 20, weight: .semibold))
          .foregroundStyle(iconInfo.fgColor)
      }

      // App name + category badge
      VStack(alignment: .leading, spacing: 4) {
        Text(app.displayName)
          .font(.system(size: 15, weight: .semibold))
          .foregroundStyle(DesignTokens.textPrimary)
          .lineLimit(1)

        Text(category.label)
          .font(.system(size: 10, weight: .bold))
          .tracking(0.6)
          .textCase(.uppercase)
          .foregroundStyle(category.color)
          .padding(.horizontal, 8)
          .padding(.vertical, 3)
          .background(category.color.opacity(0.12))
          .clipShape(Capsule())
      }

      Spacer()

      // Progress bar + duration
      VStack(alignment: .trailing, spacing: 6) {
        Text(ScreenTimeFormatter.formatDuration(seconds: app.durationSeconds))
          .font(.system(size: 14, weight: .semibold))
          .foregroundStyle(DesignTokens.textPrimary)

        // Inline progress bar
        ZStack(alignment: .leading) {
          RoundedRectangle(cornerRadius: 3, style: .continuous)
            .fill(DesignTokens.barBg)
            .frame(width: 80, height: 6)
          RoundedRectangle(cornerRadius: 3, style: .continuous)
            .fill(category.color)
            .frame(width: max(6, 80 * CGFloat(pct)), height: 6)
        }
      }
    }
    .padding(.horizontal, 14)
    .padding(.vertical, 12)
    .background(DesignTokens.cardBg)
    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 16, style: .continuous)
        .stroke(DesignTokens.cardBorder, lineWidth: 1)
    )
    .shadow(color: Color.black.opacity(0.03), radius: 4, x: 0, y: 2)
  }

  // MARK: - Helpers
  private func formatHourLabel(_ hour: Int) -> String {
    if hour == 0 { return "12am" }
    if hour < 12 { return "\(hour)am" }
    if hour == 12 { return "12pm" }
    return "\(hour - 12)pm"
  }

  private func categorizeApp(_ name: String) -> (label: String, color: Color) {
    let lower = name.lowercased()
    let work = ["slack", "gmail", "calendar", "outlook", "teams", "notion", "jira", "figma", "linear"]
    let faith = ["bible", "pray", "prayer", "hallow", "youversion", "calm"]
    let family = ["instagram", "tiktok", "snapchat", "facebook", "messages", "messenger", "whatsapp", "imessage"]

    if work.contains(where: { lower.contains($0) }) {
      return ("Work", Color(red: 0.184, green: 0.482, blue: 1.0)) // #2F7BFF
    }
    if faith.contains(where: { lower.contains($0) }) {
      return ("Faith", Color(red: 0.969, green: 0.604, blue: 0.231)) // #F79A3B
    }
    if family.contains(where: { lower.contains($0) }) {
      return ("Family", Color(red: 0.373, green: 0.388, blue: 0.961)) // #5F63F5
    }
    return ("Other", Color(red: 0.612, green: 0.639, blue: 0.686)) // #9CA3AF
  }

  private func getAppIcon(_ name: String) -> (symbol: String, bgColor: Color, fgColor: Color) {
    let n = name.lowercased()

    // Social Media
    if n.contains("instagram") {
      return ("camera.fill", Color(red: 0.88, green: 0.19, blue: 0.42), .white)
    }
    if n.contains("tiktok") {
      return ("music.note", Color.black, .white)
    }
    if n.contains("snapchat") {
      return ("camera.viewfinder", Color.yellow, .black)
    }
    if n.contains("facebook") {
      return ("person.2.fill", Color(red: 0.26, green: 0.40, blue: 0.70), .white)
    }
    if n.contains("twitter") || n.contains("x ") {
      return ("at", Color.black, .white)
    }

    // Video & Entertainment
    if n.contains("youtube") {
      return ("play.rectangle.fill", Color.red, .white)
    }
    if n.contains("netflix") {
      return ("play.tv.fill", Color.red, .white)
    }
    if n.contains("spotify") {
      return ("music.note", Color(red: 0.11, green: 0.72, blue: 0.33), .white)
    }

    // Messaging
    if n.contains("messages") || n.contains("imessage") {
      return ("message.fill", Color.green, .white)
    }
    if n.contains("whatsapp") {
      return ("phone.bubble.fill", Color(red: 0.15, green: 0.68, blue: 0.38), .white)
    }
    if n.contains("messenger") {
      return ("bubble.left.and.bubble.right.fill", Color(red: 0.0, green: 0.47, blue: 1.0), .white)
    }

    // Work & Productivity
    if n.contains("slack") {
      return ("number.square.fill", Color(red: 0.31, green: 0.14, blue: 0.44), .white)
    }
    if n.contains("gmail") || n.contains("mail") {
      return ("envelope.fill", Color.red, .white)
    }
    if n.contains("outlook") {
      return ("envelope.fill", Color.blue, .white)
    }
    if n.contains("teams") {
      return ("person.3.fill", Color(red: 0.29, green: 0.33, blue: 0.55), .white)
    }
    if n.contains("notion") {
      return ("doc.text.fill", Color.black, .white)
    }
    if n.contains("figma") {
      return ("paintbrush.fill", Color.purple, .white)
    }
    if n.contains("calendar") {
      return ("calendar", Color.red, .white)
    }

    // Browsers
    if n.contains("safari") {
      return ("safari.fill", Color.blue, .white)
    }
    if n.contains("chrome") {
      return ("globe", Color(red: 0.26, green: 0.52, blue: 0.96), .white)
    }

    // Health & Wellness
    if n.contains("calm") {
      return ("leaf.fill", Color(red: 0.29, green: 0.56, blue: 0.89), .white)
    }
    if n.contains("headspace") {
      return ("brain.head.profile", Color.orange, .white)
    }
    if n.contains("bible") || n.contains("youversion") {
      return ("book.fill", Color.orange, .white)
    }
    if n.contains("hallow") || n.contains("pray") {
      return ("hands.sparkles.fill", Color(red: 0.25, green: 0.18, blue: 0.45), .white)
    }

    // Games
    if n.contains("game") || n.contains("play") {
      return ("gamecontroller.fill", Color.purple, .white)
    }

    // Photos
    if n.contains("photos") {
      return ("photo.fill", Color(red: 1.0, green: 0.8, blue: 0.0), .white)
    }

    // Default
    return ("app.fill", Color.gray, .white)
  }
}

private enum ScreenTimeAggregator {
  static func aggregate(range: ScreenTimeRangeKey, from data: DeviceActivityResults<DeviceActivityData>) async -> ScreenTimeSummary {
    let calendar = Calendar.current
    let now = Date()
    let dayStart: Date
    let dayEnd: Date

    switch range {
    case .today:
      dayStart = calendar.startOfDay(for: now)
      dayEnd = calendar.date(byAdding: .day, value: 1, to: dayStart) ?? now
    case .week:
      dayStart = calendar.startOfDay(for: calendar.date(byAdding: .day, value: -6, to: now) ?? now)
      dayEnd = now
    case .month:
      dayStart = calendar.startOfDay(for: calendar.date(byAdding: .day, value: -29, to: now) ?? now)
      dayEnd = now
    case .year:
      dayStart = calendar.startOfDay(for: calendar.date(byAdding: .day, value: -364, to: now) ?? now)
      dayEnd = now
    }

    var usageByBundle: [String: ScreenTimeAppUsage] = [:]
    var hourlyBuckets = Array(repeating: 0, count: 24)
    // Per-app hourly breakdown: [appId: [hour: seconds]]
    var hourlyByApp: [String: [Int: Int]] = [:]
    // Per-app time intervals (sessions)
    var appSessions: [ScreenTimeAppSession] = []

    for await deviceData in data {
      for await segment in deviceData.activitySegments {
        let segmentStart = segment.dateInterval.start
        let segmentEnd = segment.dateInterval.end
        var segmentTotalSeconds = 0
        
        for await categoryActivity in segment.categories {
          for await applicationActivity in categoryActivity.applications {
            let bundleId = applicationActivity.application.bundleIdentifier ?? "unknown"
            let displayName = applicationActivity.application.localizedDisplayName ?? bundleId

            let durationSeconds = Int(applicationActivity.totalActivityDuration)
            let pickups = Int(applicationActivity.numberOfPickups)
            segmentTotalSeconds += durationSeconds

            // Update daily totals
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

            // Track per-app hourly breakdown (only for today range)
            if range == .today {
              let startHour = calendar.component(.hour, from: segmentStart)
              let endHour = calendar.component(.hour, from: segmentEnd)
              
              // Distribute duration across hours if segment spans multiple hours
              let segmentDuration = segmentEnd.timeIntervalSince(segmentStart)
              if segmentDuration > 0 {
                for hour in startHour...min(endHour, 23) {
                  // Calculate hour boundaries
                  var hourComponents = calendar.dateComponents([.year, .month, .day], from: segmentStart)
                  hourComponents.hour = hour
                  hourComponents.minute = 0
                  hourComponents.second = 0
                  guard let hourStart = calendar.date(from: hourComponents) else { continue }
                  guard let hourEnd = calendar.date(byAdding: .hour, value: 1, to: hourStart) else { continue }
                  
                  let overlapStart = max(segmentStart, hourStart)
                  let overlapEnd = min(segmentEnd, hourEnd)
                  let overlapDuration = overlapEnd.timeIntervalSince(overlapStart)
                  
                  if overlapDuration > 0 {
                    let hourSeconds = Int((overlapDuration / segmentDuration) * Double(durationSeconds))
                    if hourlyByApp[bundleId] == nil {
                      hourlyByApp[bundleId] = [:]
                    }
                    hourlyByApp[bundleId]?[hour] = (hourlyByApp[bundleId]?[hour] ?? 0) + hourSeconds
                  }
                }
              } else {
                // Single hour case
                if hourlyByApp[bundleId] == nil {
                  hourlyByApp[bundleId] = [:]
                }
                hourlyByApp[bundleId]?[startHour] = (hourlyByApp[bundleId]?[startHour] ?? 0) + durationSeconds
              }
            }

            // Track per-app sessions (only for today range)
            if range == .today {
              appSessions.append(ScreenTimeAppSession(
                bundleIdentifier: bundleId,
                displayName: displayName,
                startedAtIso: ScreenTimeFormatter.isoString(segmentStart),
                endedAtIso: ScreenTimeFormatter.isoString(segmentEnd),
                durationSeconds: durationSeconds,
                pickups: pickups
              ))
            }
          }
        }

        if range == .today {
          // Best-effort bucketization: segments are time-windowed; attribute segment total to the start hour.
          let hour = calendar.component(.hour, from: segmentStart)
          if hour >= 0 && hour < 24 {
            hourlyBuckets[hour] += segmentTotalSeconds
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
      topApps: Array(sorted.prefix(5)),
      hourlyBucketsSeconds: range == .today ? hourlyBuckets : nil,
      hourlyByApp: range == .today && !hourlyByApp.isEmpty ? hourlyByApp : nil,
      appSessions: range == .today && !appSessions.isEmpty ? appSessions : nil
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


