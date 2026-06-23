/**
 * Config plugin — Bump xcodeproj objectVersion to 77 (Xcode 16+).
 *
 * Why:
 *   @bacons/apple-targets 4.0.7 generates Widget target with
 *   `fileSystemSynchronizedGroups` (PBXFileSystemSynchronizedRootGroup),
 *   which is an Xcode 16+ feature requiring objectVersion >= 77.
 *
 *   Expo's default iOS template uses objectVersion 54, which causes
 *   xcodebuild to silently ignore the synchronized groups → Widget target
 *   compiles with empty Sources buildPhase → empty .appex → no Live Activity
 *   in shipped IPA.
 *
 *   This plugin runs AFTER all other plugins (via withDangerousMod) and
 *   patches the xcodeproj just before pod install / build.
 *
 * It also patches the generated Podfile for CocoaPods/xcodeproj combinations
 * that know objectVersion 77 but miss objectVersion 70 in their compatibility
 * map. Without that, `pod install` can fail while generating Pods.xcodeproj:
 *   [Xcodeproj] Unable to find compatibility version string for object version `70`.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const TARGET_OBJECT_VERSION = 77;
const PODFILE_PATCH_MARKER = '# PIT RUN: xcodeproj objectVersion 70 compatibility patch';
const PODFILE_PATCH = `${PODFILE_PATCH_MARKER}
begin
  require 'xcodeproj'
  versions = Xcodeproj::Constants::COMPATIBILITY_VERSION_BY_OBJECT_VERSION
  unless versions.key?(70)
    Xcodeproj::Constants.send(:remove_const, :COMPATIBILITY_VERSION_BY_OBJECT_VERSION)
    Xcodeproj::Constants.const_set(
      :COMPATIBILITY_VERSION_BY_OBJECT_VERSION,
      versions.merge(70 => 'Xcode 16.0').freeze
    )
  end
rescue LoadError
end
`;

module.exports = function withWidgetObjectVersion(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const projectName = cfg.modRequest.projectName;
      if (!projectName) return cfg;
      const pbxprojPath = path.join(
        cfg.modRequest.platformProjectRoot,
        `${projectName}.xcodeproj`,
        'project.pbxproj',
      );
      if (!fs.existsSync(pbxprojPath)) return cfg;
      let content = fs.readFileSync(pbxprojPath, 'utf-8');
      const before = content;
      content = content.replace(
        /^(\s*)objectVersion = \d+;/m,
        `$1objectVersion = ${TARGET_OBJECT_VERSION};`,
      );
      if (content !== before) {
        fs.writeFileSync(pbxprojPath, content, 'utf-8');
      }
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (fs.existsSync(podfilePath)) {
        const podfile = fs.readFileSync(podfilePath, 'utf-8');
        if (!podfile.includes(PODFILE_PATCH_MARKER)) {
          fs.writeFileSync(podfilePath, `${PODFILE_PATCH}\n${podfile}`, 'utf-8');
        }
      }
      return cfg;
    },
  ]);
};
