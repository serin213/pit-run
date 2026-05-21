import ActivityKit
import Foundation

// IMPORTANT: 네이티브 모듈(modules/pit-run-live-activity/.../PitRunLiveActivityModule.swift)의
// PitRunAttributes 정의와 **자료형 / 필드명 / 순서까지 정확히 일치**시켜야 함.
// iOS Live Activity는 ActivityAttributes 타입을 reflection 기반으로 매칭하므로 미세한
// 차이(typealias vs inline struct, public 수식자 유무)도 매칭 실패의 원인이 될 수 있음.
// LockNormalView 등에서 사용하던 ContentState.PitRunState 참조도 ContentState로 통일.
struct PitRunAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var distKm: Double
        var elapsedMs: Int
        var paceS: Int
        var sector: String    // "yellow" | "purple" | "green"
        var tire: String      // "soft" | "medium" | "hard"
        var pitPhase: String  // "none" | "boxbox" | "inPit" | "fullPush" | "completed"
        var prog: Double      // 0.0 – 1.0, circuit lap progress (또는 qualifying 진행도 0~1)
        var isPaused: Bool
        // "race" | "qualifying" — UI 분기 (lock screen 전용 layout, expanded color)
        var mode: String
    }

    var driverName: String
    var teamColor: String     // hex string e.g. "#E8002D"
    var circuitId: String     // e.g. "shanghai"
}
