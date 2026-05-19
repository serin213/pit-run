require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'PitRunLiveActivity'
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
