import CoreLocation
import ExpoModulesCore

/**
 * CLBackgroundActivitySession + CLLocationUpdate.liveUpdates(.fitness) 관리.
 *
 * iOS 17+: 운동 앱이 잠금 화면에서 안정적으로 background runtime을 받기 위한
 * Apple 공식 패턴. WWDC23 Session 10180에서 권장.
 *
 * 동작:
 * - startSession(): CLBackgroundActivitySession 인스턴스 생성 + liveUpdates 스트림 시작.
 *   → foreground에서만 시작 가능 (iOS 제약).
 * - stopSession(): liveUpdates task cancel + session.invalidate().
 *
 * 주의:
 * - 한 번 invalidate된 session은 background에서 재시작 불가 (foreground 필요).
 * - liveUpdates 스트림은 keep-alive 목적. 실제 location 처리는 expo-location의
 *   startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)가 담당.
 *   두 메커니즘이 공존해도 충돌 없음 (CLBAS는 runtime 보장, expo-location은 callback 처리).
 */
public class PitRunBackgroundActivityModule: Module {
  private var backgroundSession: Any?  // CLBackgroundActivitySession (iOS 17+, Any로 wrap해서 older OS 호환)
  private var locationUpdateTask: Task<Void, Never>?
  private var isSessionActive: Bool = false

  public func definition() -> ModuleDefinition {
    Name("PitRunBackgroundActivity")

    AsyncFunction("startSession") { (promise: Promise) in
      guard #available(iOS 17.0, *) else {
        NSLog("[PitRunBG] startSession: iOS 17+ required, returning false")
        promise.resolve(false)
        return
      }

      // 이미 활성화된 session이 있으면 reuse.
      if self.isSessionActive {
        NSLog("[PitRunBG] startSession: already active, skip")
        promise.resolve(true)
        return
      }

      // CLBackgroundActivitySession은 foreground에서만 생성 가능.
      // RunningScreen mount 시점에 호출되므로 OK.
      let session = CLBackgroundActivitySession()
      self.backgroundSession = session
      self.isSessionActive = true
      NSLog("[PitRunBG] startSession: CLBackgroundActivitySession created")

      // liveUpdates 스트림 시작 — keep-alive 용도.
      // 실제 GPS 처리는 expo-location의 background task가 별도로 담당.
      self.locationUpdateTask = Task {
        do {
          let updates = CLLocationUpdate.liveUpdates(.fitness)
          for try await update in updates {
            // 스트림 유지가 목적. update.location은 의도적으로 사용 안 함.
            // (expo-location이 별도로 모든 location callback 처리)
            _ = update.location
            if Task.isCancelled { break }
          }
        } catch {
          NSLog("[PitRunBG] liveUpdates error: \(error.localizedDescription)")
        }
      }

      promise.resolve(true)
    }

    AsyncFunction("stopSession") { (promise: Promise) in
      self.locationUpdateTask?.cancel()
      self.locationUpdateTask = nil

      if #available(iOS 17.0, *), let session = self.backgroundSession as? CLBackgroundActivitySession {
        session.invalidate()
        NSLog("[PitRunBG] stopSession: CLBackgroundActivitySession invalidated")
      }
      self.backgroundSession = nil
      self.isSessionActive = false

      promise.resolve(nil as String?)
    }

    Function("isSupported") { () -> Bool in
      if #available(iOS 17.0, *) {
        return true
      }
      return false
    }

    Function("isActive") { () -> Bool in
      return self.isSessionActive
    }
  }
}
