/** @type {import("@bacons/apple-targets").Config} */
module.exports = {
  type: "widget",
  name: "PitRunLiveActivity",
  deploymentTarget: "16.1",
  bundleIdentifier: "com.pitrun.apps.liveactivity",
  // WidgetKit 명시. ActivityKit만 있고 WidgetKit이 빠지면 `@main WidgetBundle`이
  // 정상 등록 안 될 수 있음 (대부분 자동이지만 명시적으로 거는 게 안전).
  frameworks: ["ActivityKit", "WidgetKit", "SwiftUI"],
  // 호스트 앱과 동일한 App Group을 줘야 향후 shared 데이터 / Darwin notification 등이
  // 가능. 현재 코드는 안 쓰지만 빠뜨리면 매칭/디버그 시점에 미스리딩 유발 가능.
  entitlements: {
    "com.apple.security.application-groups": ["group.com.pitrun.apps"],
  },
};
