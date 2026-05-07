import ExpoModulesCore
import ActivityKit

// Must mirror PitRunAttributes in the Widget Extension exactly.
// Both targets share the same struct layout; the system matches them by bundle ID.
@available(iOS 16.1, *)
struct PitRunAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var distKm: Double
        var elapsedMs: Int
        var paceS: Int
        var sector: String    // "yellow" | "purple" | "green"
        var tire: String      // "soft" | "medium" | "hard"
        var pitPhase: String  // "none" | "boxbox" | "inPit" | "fullPush"
    }
    var driverName: String
    var teamColor: String
}

public class PitRunLiveActivityModule: Module {

    // Store as AnyObject to avoid @available constraint at class level
    private var activities: [String: AnyObject] = [:]

    public func definition() -> ModuleDefinition {
        Name("PitRunLiveActivity")

        // startActivity(driverName, teamColor) -> activityId | null
        AsyncFunction("startActivity") { (driverName: String, teamColor: String, promise: Promise) in
            guard #available(iOS 16.1, *) else {
                promise.resolve(nil as String?)
                return
            }
            guard ActivityAuthorizationInfo().areActivitiesEnabled else {
                promise.resolve(nil as String?)
                return
            }

            let initialState = PitRunAttributes.ContentState(
                distKm: 0, elapsedMs: 0, paceS: 0,
                sector: "yellow", tire: "soft", pitPhase: "none"
            )
            let content = ActivityContent(state: initialState, staleDate: nil)
            let attributes = PitRunAttributes(driverName: driverName, teamColor: teamColor)

            do {
                let activity = try Activity<PitRunAttributes>.request(
                    attributes: attributes,
                    content: content,
                    pushType: nil
                )
                self.activities[activity.id] = activity as AnyObject
                promise.resolve(activity.id)
            } catch {
                promise.reject("ERR_START_ACTIVITY", error.localizedDescription)
            }
        }

        // updateActivity(activityId, distKm, elapsedMs, paceS, sector, tire, pitPhase)
        AsyncFunction("updateActivity") { (
            activityId: String,
            distKm: Double,
            elapsedMs: Int,
            paceS: Int,
            sector: String,
            tire: String,
            pitPhase: String,
            promise: Promise
        ) in
            guard #available(iOS 16.1, *) else {
                promise.resolve(nil as String?)
                return
            }
            guard let activity = self.activities[activityId] as? Activity<PitRunAttributes> else {
                promise.resolve(nil as String?)
                return
            }

            let newState = PitRunAttributes.ContentState(
                distKm: distKm, elapsedMs: elapsedMs, paceS: paceS,
                sector: sector, tire: tire, pitPhase: pitPhase
            )
            let content = ActivityContent(state: newState, staleDate: nil)

            Task {
                await activity.update(content)
                promise.resolve(nil as String?)
            }
        }

        // endActivity(activityId)
        AsyncFunction("endActivity") { (activityId: String, promise: Promise) in
            guard #available(iOS 16.1, *) else {
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
            guard #available(iOS 16.1, *) else {
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
            if #available(iOS 16.1, *) {
                return ActivityAuthorizationInfo().areActivitiesEnabled
            }
            return false
        }
    }
}
