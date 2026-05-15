import ActivityKit
import Foundation

struct PitRunAttributes: ActivityAttributes {
    public typealias ContentState = PitRunState

    public struct PitRunState: Codable, Hashable {
        var distKm: Double
        var elapsedMs: Int
        var paceS: Int
        var sector: String    // "yellow" | "purple" | "green"
        var tire: String      // "soft" | "medium" | "hard"
        var pitPhase: String  // "none" | "boxbox" | "inPit" | "fullPush" | "completed"
        var prog: Double      // 0.0 – 1.0, circuit lap progress
        var isPaused: Bool
    }

    var driverName: String
    var teamColor: String     // hex string e.g. "#E8002D"
    var circuitId: String     // e.g. "shanghai"
}
