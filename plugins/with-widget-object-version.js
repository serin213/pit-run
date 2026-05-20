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
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const TARGET_OBJECT_VERSION = 77;

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
      return cfg;
    },
  ]);
};
