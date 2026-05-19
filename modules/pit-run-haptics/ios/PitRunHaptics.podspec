require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'PitRunHaptics'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = 'MIT'
  s.author         = { 'serin213' => 'serin213@github' }
  s.homepage       = 'https://github.com/serin213/pit-run'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/serin213/pit-run' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Explicit framework deps for CoreHaptics (auto-linked, but listed for clarity).
  s.frameworks = 'CoreHaptics', 'UIKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
