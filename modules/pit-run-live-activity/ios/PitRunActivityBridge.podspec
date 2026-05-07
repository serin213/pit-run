Pod::Spec.new do |s|
  s.name           = 'PitRunActivityBridge'
  s.version        = '1.0.0'
  s.summary        = 'ActivityKit Live Activity bridge for Pit Run'
  s.description    = 'Native module that wraps ActivityKit to start/update/end Live Activities from React Native.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platform       = :ios, '16.1'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
