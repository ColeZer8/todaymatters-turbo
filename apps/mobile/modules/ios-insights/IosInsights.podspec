require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = 'ios-insights'
  s.version      = package['version']
  s.summary      = 'Local Expo module: iOS Screen Time (FamilyControls/DeviceActivity) + HealthKit access.'
  s.license      = { :type => 'UNLICENSED' }
  s.author       = { 'TodayMatters' => 'dev@todaymatters' }
  s.homepage     = 'https://todaymatters'
  s.platforms    = { :ios => '15.1' }

  s.source       = { :git => 'https://example.invalid/ios-insights.git', :tag => s.version.to_s }
  s.static_framework = true

  s.source_files = 'ios/**/*.{h,m,mm,swift}'

  s.dependency 'ExpoModulesCore'
end


