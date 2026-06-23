const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const { setNotificationSounds: setIOSNotificationSounds } = require('expo-notifications/plugin/build/withNotificationsIOS');
const { setNotificationSounds: setAndroidNotificationSounds } = require('expo-notifications/plugin/build/withNotificationsAndroid');

module.exports = function withNotificationSounds(config, { sounds = [] } = {}) {
  config = withXcodeProject(config, (cfg) => {
    setIOSNotificationSounds(cfg.modRequest.projectRoot, {
      sounds,
      project: cfg.modResults,
      projectName: cfg.modRequest.projectName,
    });
    return cfg;
  });

  return withDangerousMod(config, ['android', (cfg) => {
    setAndroidNotificationSounds(cfg.modRequest.projectRoot, sounds);
    return cfg;
  }]);
};
