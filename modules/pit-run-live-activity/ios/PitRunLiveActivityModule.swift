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
        // "race" | "qualifying" — 반드시 targets/.../PitRunAttributes.swift의
        // ContentState와 순서/이름/타입 동일.
        var mode: String
        // FIX 10-B: timerInterval 전환용 epoch ms 기준점.
        var timerStartMs: Double?
        var timerEndMs: Double?
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

        // startActivity(driverName, teamColor, circuitId, mode) -> activityId | null
        // mode: "race" | "qualifying" — Lock screen / expanded color 분기.
        AsyncFunction("startActivity") { (driverName: String, teamColor: String, circuitId: String, mode: String, promise: Promise) in
            NSLog("[PitRunLA] startActivity called: driver=%@ team=%@ circuit=%@ mode=%@", driverName, teamColor, circuitId, mode)
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
                prog: 0, isPaused: false,
                mode: mode,
                timerStartMs: nil, timerEndMs: nil
            )
            let content = ActivityContent(state: initialState, staleDate: Date().addingTimeInterval(60))
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

        // updateActivity(activityId, state: dict)
        // 이전엔 10개 individual 매개변수였는데 expo-modules-core의 AsyncFunction
        // 매개변수 개수 상한을 초과해 native binding이 깨지는 케이스 발생
        // ("Native function expects 10 arguments, but received 11" 매초 throw).
        // state 9개 필드를 dictionary 한 개로 묶어 매개변수 3개 (activityId, state,
        // promise)로 축소.
        AsyncFunction("updateActivity") { (
            activityId: String,
            state: [String: Any],
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
                distKm:       state["distKm"]       as? Double ?? 0,
                elapsedMs:    state["elapsedMs"]    as? Int    ?? 0,
                paceS:        state["paceS"]        as? Int    ?? 0,
                sector:       state["sector"]       as? String ?? "yellow",
                tire:         state["tire"]         as? String ?? "soft",
                pitPhase:     state["pitPhase"]     as? String ?? "none",
                prog:         state["prog"]         as? Double ?? 0,
                isPaused:     state["isPaused"]     as? Bool   ?? false,
                mode:         state["mode"]         as? String ?? "race",
                timerStartMs: state["timerStartMs"] as? Double,
                timerEndMs:   state["timerEndMs"]   as? Double
            )
            // FIX 7-3: staleDate 60초 후로 설정. iOS가 stale 시점이 지나면 LA를 자동
            // refresh 트리거 (시스템 hint) → 잠금 중 background runtime이 일시 throttle
            // 돼도 다음 update 보장. CLBackgroundActivitySession과 같이 효과 강화.
            let staleDate = Date().addingTimeInterval(60)
            let content = ActivityContent(state: newState, staleDate: staleDate)

            Task {
                await activity.update(content)
                NSLog("[PitRunLA] update OK: id=%@ dist=%.2f phase=%@",
                      activityId, newState.distKm, newState.pitPhase)
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
