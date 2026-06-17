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

    // APNs push token 관찰 Task. activity id별로 1개. endActivity/endAll에서 cancel.
    // Task<Void, Never>는 @available 게이트가 필요 없어 클래스 레벨 보관 가능.
    private var pushTokenTasks: [String: Task<Void, Never>] = [:]

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

        // APNs Live Activity push 토큰이 갱신될 때마다 JS로 전달.
        // payload: { activityId: String, token: String(hex), environment: String }
        // token은 비동기로 발급되므로 startActivity는 이 이벤트를 기다리지 않는다.
        Events("onLiveActivityPushToken")

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
                // pushType: .token — ActivityKit이 APNs push token을 발급해 서버에서
                // Lock Screen / Dynamic Island를 원격 갱신할 수 있게 한다. 토큰은 비동기로
                // 도착하므로 여기서 기다리지 않고 activityId만 즉시 반환, 토큰은
                // pushTokenUpdates 관찰 Task에서 onLiveActivityPushToken 이벤트로 흘려보낸다.
                // 로컬 updateActivity 폴백은 그대로 동작 (push와 무관).
                let activity = try Activity<PitRunAttributes>.request(
                    attributes: attributes,
                    content: content,
                    pushType: .token
                )
                self.activities[activity.id] = activity as AnyObject
                NSLog("[PitRunLA] activity REQUESTED OK (pushType=.token): id=%@", activity.id)
                self.observePushToken(activity)
                promise.resolve(activity.id)
            } catch {
                NSLog("[PitRunLA] activity REQUEST FAILED: %@ (full: %@)", error.localizedDescription, "\(error)")
                promise.reject("ERR_START_ACTIVITY", "\(error)")
            }
        }

        // getPushToken(activityId) -> hex token | null
        // 폴백 조회용 — 이벤트를 놓쳤거나 JS context가 재시작된 경우 현재 토큰을 직접 읽는다.
        AsyncFunction("getPushToken") { (activityId: String, promise: Promise) in
            guard #available(iOS 16.2, *) else {
                promise.resolve(nil as String?)
                return
            }
            let activity: Activity<PitRunAttributes>?
            if let cached = self.activities[activityId] as? Activity<PitRunAttributes> {
                activity = cached
            } else {
                activity = Activity<PitRunAttributes>.activities.first(where: { $0.id == activityId })
            }
            guard let activity = activity, let tokenData = activity.pushToken else {
                promise.resolve(nil as String?)
                return
            }
            promise.resolve(Self.hexString(from: tokenData))
        }

        // frequentPushesEnabled() — NSSupportsLiveActivitiesFrequentUpdates 사용자 허용 여부.
        // priority 10 빈번한 push가 throttle 없이 전달될지 판단하는 서버측 힌트로 전송한다.
        Function("frequentPushesEnabled") { () -> Bool in
            if #available(iOS 16.2, *) {
                let enabled = ActivityAuthorizationInfo().frequentPushesEnabled
                NSLog("[PitRunLA] frequentPushesEnabled() → \(enabled)")
                return enabled
            }
            return false
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
            let activity: Activity<PitRunAttributes>
            if let cached = self.activities[activityId] as? Activity<PitRunAttributes> {
                activity = cached
            } else if let existing = Activity<PitRunAttributes>.activities.first(where: { $0.id == activityId }) {
                // Background JS/native module instances may not share this in-memory dictionary.
                // ActivityKit keeps the live activities globally available, so recover by id.
                self.activities[activityId] = existing as AnyObject
                activity = existing
            } else {
                NSLog("[PitRunLA] update skipped: activity not found id=%@", activityId)
                promise.resolve(false)
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
                promise.resolve(true)
            }
        }

        // endActivity(activityId)
        AsyncFunction("endActivity") { (activityId: String, promise: Promise) in
            guard #available(iOS 16.2, *) else {
                promise.resolve(nil as String?)
                return
            }
            let activity: Activity<PitRunAttributes>
            if let cached = self.activities[activityId] as? Activity<PitRunAttributes> {
                activity = cached
            } else if let existing = Activity<PitRunAttributes>.activities.first(where: { $0.id == activityId }) {
                self.activities[activityId] = existing as AnyObject
                activity = existing
            } else {
                promise.resolve(nil as String?)
                return
            }

            Task {
                await activity.end(nil, dismissalPolicy: .immediate)
                self.activities.removeValue(forKey: activityId)
                self.pushTokenTasks[activityId]?.cancel()
                self.pushTokenTasks.removeValue(forKey: activityId)
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
                for (_, task) in self.pushTokenTasks { task.cancel() }
                self.pushTokenTasks.removeAll()
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

    // Data(APNs token) → 소문자 hex 문자열. 서버가 APNs apns-topic 대상에 그대로 사용.
    private static func hexString(from data: Data) -> String {
        return data.map { String(format: "%02x", $0) }.joined()
    }

    // activity.pushTokenUpdates를 관찰해 토큰이 갱신될 때마다 JS로 이벤트 전송.
    // 첫 토큰 + rotation 모두 동일 경로로 흐른다. 빌드 environment(sandbox/production)는
    // 컴파일 플래그로 추정해 서버가 올바른 APNs 호스트를 고르게 힌트로 보낸다.
    @available(iOS 16.2, *)
    private func observePushToken(_ activity: Activity<PitRunAttributes>) {
        let activityId = activity.id
        // 이미 발급된 토큰이 있으면 즉시 1회 emit (이벤트 구독 타이밍 경합 방어).
        if let current = activity.pushToken {
            self.sendEvent("onLiveActivityPushToken", [
                "activityId": activityId,
                "token": Self.hexString(from: current),
                "environment": Self.apnsEnvironment(),
            ])
        }
        let task = Task { [weak self] in
            for await tokenData in activity.pushTokenUpdates {
                let hex = Self.hexString(from: tokenData)
                NSLog("[PitRunLA] pushToken update id=%@ token=%@", activityId, hex)
                self?.sendEvent("onLiveActivityPushToken", [
                    "activityId": activityId,
                    "token": hex,
                    "environment": Self.apnsEnvironment(),
                ])
            }
        }
        self.pushTokenTasks[activityId] = task
    }

    // DEBUG 빌드는 APNs sandbox, 그 외(TestFlight/App Store)는 production.
    // 서버 APNS_ENV가 최종 권위지만, 디바이스 빌드 종류를 같이 보내 불일치 진단을 돕는다.
    private static func apnsEnvironment() -> String {
        #if DEBUG
        return "sandbox"
        #else
        return "production"
        #endif
    }
}
