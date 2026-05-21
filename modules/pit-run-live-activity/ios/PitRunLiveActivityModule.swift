import ExpoModulesCore
import ActivityKit

// Must mirror PitRunAttributes in the Widget Extension exactly.
// Both targets share the same struct layout; the system matches them by bundle ID.
@available(iOS 16.2, *)
struct PitRunAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var distKm: Double
        var elapsedMs: Int
        var paceS: Int
        var sector: String    // "yellow" | "purple" | "green"
        var tire: String      // "soft" | "medium" | "hard"
        var pitPhase: String  // "none" | "boxbox" | "inPit" | "fullPush" | "completed"
        var prog: Double      // 0.0 – 1.0
        var isPaused: Bool
    }
    var driverName: String
    var teamColor: String
    var circuitId: String
}

public class PitRunLiveActivityModule: Module {

    // Store as AnyObject to avoid @available constraint at class level
    private var activities: [String: AnyObject] = [:]

    public func definition() -> ModuleDefinition {
        // IMPORTANT: 'PitRunLiveActivity'는 widget extension target name
        // (targets/pit-run-live-activity/expo-target.config.js)과 동일해서
        // JS↔Native 식별자 충돌 회피용으로 *Bridge로 다르게 등록.
        // JS 쪽 MODULE_NAME도 동일하게 맞춰야 함 (modules/.../src/index.ts).
        Name("PitRunLiveActivityBridge")

        // 모듈 인스턴스화 시점에 1회 찍힘. Console.app에서 이 줄도 없다면
        // 네이티브 모듈 autolinking이 깨진 상태 (podspec / 빌드 설정 문제).
        // definition() 메서드는 AnyDefinition만 받으므로 NSLog는 OnCreate 블록 안.
        OnCreate {
            NSLog("[PitRunLA] Module OnCreate called — module is loaded and registered")
        }

        // startActivity(driverName, teamColor, circuitId) -> activityId | null
        AsyncFunction("startActivity") { (driverName: String, teamColor: String, circuitId: String, promise: Promise) in
            NSLog("[PitRunLA] startActivity called: driver=%@ team=%@ circuit=%@", driverName, teamColor, circuitId)
            guard #available(iOS 16.2, *) else {
                NSLog("[PitRunLA] iOS < 16.2 — returning null")
                promise.resolve(nil as String?)
                return
            }
            let enabled = ActivityAuthorizationInfo().areActivitiesEnabled
            NSLog("[PitRunLA] areActivitiesEnabled=%@", enabled ? "YES" : "NO")
            guard enabled else {
                NSLog("[PitRunLA] LA disabled in Settings — returning null (Settings > [App] > Live Activities)")
                promise.resolve(nil as String?)
                return
            }

            let initialState = PitRunAttributes.ContentState(
                distKm: 0, elapsedMs: 0, paceS: 0,
                sector: "yellow", tire: "soft", pitPhase: "none",
                prog: 0, isPaused: false
            )
            let content = ActivityContent(state: initialState, staleDate: nil)
            let attributes = PitRunAttributes(driverName: driverName, teamColor: teamColor, circuitId: circuitId)

            do {
                let activity = try Activity<PitRunAttributes>.request(
                    attributes: attributes,
                    content: content,
                    pushType: nil
                )
                self.activities[activity.id] = activity as AnyObject
                NSLog("[PitRunLA] activity REQUESTED OK: id=%@", activity.id)
                promise.resolve(activity.id)
            } catch {
                NSLog("[PitRunLA] activity REQUEST FAILED: %@ (full: %@)", error.localizedDescription, "\(error)")
                promise.reject("ERR_START_ACTIVITY", "\(error)")
            }
        }

        // updateActivity(activityId, distKm, elapsedMs, paceS, sector, tire, pitPhase, prog, isPaused)
        AsyncFunction("updateActivity") { (
            activityId: String,
            distKm: Double,
            elapsedMs: Int,
            paceS: Int,
            sector: String,
            tire: String,
            pitPhase: String,
            prog: Double,
            isPaused: Bool,
            promise: Promise
        ) in
            guard #available(iOS 16.2, *) else {
                promise.resolve(nil as String?)
                return
            }
            guard let activity = self.activities[activityId] as? Activity<PitRunAttributes> else {
                promise.resolve(nil as String?)
                return
            }

            let newState = PitRunAttributes.ContentState(
                distKm: distKm, elapsedMs: elapsedMs, paceS: paceS,
                sector: sector, tire: tire, pitPhase: pitPhase,
                prog: prog, isPaused: isPaused
            )
            let content = ActivityContent(state: newState, staleDate: nil)

            Task {
                await activity.update(content)
                NSLog("[PitRunLA] update OK: id=%@ dist=%.2f phase=%@", activityId, distKm, pitPhase)
                promise.resolve(nil as String?)
            }
        }

        // endActivity(activityId)
        AsyncFunction("endActivity") { (activityId: String, promise: Promise) in
            guard #available(iOS 16.2, *) else {
                promise.resolve(nil as String?)
                return
            }
            guard let activity = self.activities[activityId] as? Activity<PitRunAttributes> else {
                promise.resolve(nil as String?)
                return
            }

            Task {
                await activity.end(nil, dismissalPolicy: .immediate)
                self.activities.removeValue(forKey: activityId)
                promise.resolve(nil as String?)
            }
        }

        // endAllActivities() — 앱 강제 종료 등 예외 상황용
        AsyncFunction("endAllActivities") { (promise: Promise) in
            guard #available(iOS 16.2, *) else {
                promise.resolve(nil as String?)
                return
            }
            Task {
                for activity in Activity<PitRunAttributes>.activities {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
                self.activities.removeAll()
                promise.resolve(nil as String?)
            }
        }

        // isSupported() — iOS 16.1+ 실기기 여부 체크
        Function("isSupported") { () -> Bool in
            if #available(iOS 16.2, *) {
                let enabled = ActivityAuthorizationInfo().areActivitiesEnabled
                NSLog("[PitRunLA] isSupported() → \(enabled)")
                return enabled
            }
            NSLog("[PitRunLA] isSupported() → false (iOS < 16.2)")
            return false
        }
    }
}
