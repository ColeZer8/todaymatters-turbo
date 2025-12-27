import DeviceActivity
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
    // Keep this intentionally minimal and safe:
    // - We only confirm the extension is invoked and receiving data.
    // - We'll expand to per-app totals once the embedding/authorization is stable.
    _ = data
    return "DeviceActivity report loaded."
  }
}


