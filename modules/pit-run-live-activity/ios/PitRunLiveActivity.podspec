require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  # IMPORTANT: podspec name은 반드시 package.json의 name을 PascalCase 변환한 값
  # ('pit-run-live-activity' → 'PitRunLiveActivity')과 일치해야 함.
  # Expo modules autolinking이 이 규약으로 podspec을 찾기 때문에, *Bridge 같은 다른
  # 이름을 쓰면 ExpoModulesProvider.swift에 모듈이 등록 자체가 안 되어 production에서
  # requireOptionalNativeModule이 영구히 null 반환 (이전 디버그 증상의 원인).
  #
  # widget extension target도 같은 이름('PitRunLiveActivity')이지만, 그건 .appex
  # 빌드 타겟이고 이건 CocoaPods framework라 빌드 단위가 달라 충돌하지 않음.
  # JS↔Native 식별자 충돌 회피는 Swift Name("PitRunLiveActivityBridge")로 분리.
  s.name           = 'PitRunLiveActivity'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = 'MIT'
  s.author         = { 'serin213' => 'serin213@github' }
  s.homepage       = 'https://github.com/serin213/pit-run'
  # iOS 16.1+ 전용 (ActivityKit). Podfile도 반드시 16.1로 맞춰야 함
  # (app.json plugins의 expo-build-properties로 ios.deploymentTarget="16.1" 설정).
  # podspec platform > Podfile platform이면 expo-modules-autolinking이
  # "doesn't support iOS platform"으로 판정해서 모듈을 silent drop함.
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
