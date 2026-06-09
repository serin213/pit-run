require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'PitRunBackgroundActivity'
  s.module_name    = 'PitRunBackgroundActivityNative'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = 'MIT'
  s.author         = { 'serin213' => 'serin213@github' }
  s.homepage       = 'https://github.com/serin213/pit-run'
  # iOS 17+ 전용 (CLBackgroundActivitySession). Podfile도 16.1 이상이면 OK
  # (런타임 @available 17.0 체크로 16~17 호환).
  s.platforms      = { :ios => '16.1' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/serin213/pit-run' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # CoreLocation framework 명시 (autolinking이 놓칠 수 있음).
  s.frameworks = 'CoreLocation'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
