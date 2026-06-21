/**
 * Config plugin — remove the `aps-environment` entitlement.
 *
 * Why:
 *   expo-notifications adds `aps-environment` (remote push / APNs) to the app
 *   entitlements during prebuild. But PIT RUN only uses LOCAL scheduled
 *   notifications (box-box / 풀푸시 정시 발화), which do NOT require
 *   aps-environment. The App Store provisioning profile ('pit run app store')
 *   has no Push Notifications capability, so leaving aps-environment in the
 *   entitlements breaks code signing:
 *     "Provisioning profile doesn't include the aps-environment entitlement".
 *
 *   Local notifications work fine without it, so we strip it after
 *   expo-notifications adds it. Must be listed AFTER "expo-notifications" in
 *   app.json plugins so this entitlements mod runs last and wins.
 */
const { withEntitlementsPlist } = require('@expo/config-plugins');

module.exports = function withNoApsEnvironment(config) {
  return withEntitlementsPlist(config, (cfg) => {
    if (cfg.modResults && 'aps-environment' in cfg.modResults) {
      delete cfg.modResults['aps-environment'];
    }
    return cfg;
  });
};
