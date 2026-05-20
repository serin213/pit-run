require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  # IMPORTANT: 위젯 extension 타겟 이름(targets/pit-run-live-activity/expo-target.config.js의
  # name: "PitRunLiveActivity")과 절대 같으면 안 됨. 같으면 Xcode 프로젝트에서 두 타겟이
  # 충돌하여 native 모듈이 main app에 silently 누락됨 (Console.app에서 PitRunLA NSLog가
  # 하나도 안 찍히는 증상). 그래서 일부러 *Bridge로 다른 이름 사용.
  s.name           = 'PitRunLiveActivityBridge'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = 'MIT'
  s.author         = { 'serin213' => 'serin213@github' }
  s.homepage       = 'https://github.com/serin213/pit-run'
  s.platforms      = { :ios => '16.1' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/serin213/pit-run' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # ActivityKit needs explicit framework declaration — autolinking can miss it
  # since the Swift @available check is runtime-only.
  s.frameworks = 'ActivityKit', 'WidgetKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
