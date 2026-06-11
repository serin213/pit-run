import CoreLocation
import ExpoModulesCore

/**
 * CLBackgroundActivitySession 관리.
 *
 * iOS 17+: 운동 앱이 잠금 화면에서 안정적으로 background runtime을 받기 위한
 * Apple 공식 패턴. WWDC23 Session 10180에서 권장.
 *
 * 동작:
 * - startSession(): CLBackgroundActivitySession 인스턴스 생성.
 *   → foreground에서만 시작 가능 (iOS 제약).
 * - stopSession(): session.invalidate().
 *
 * 주의:
 * - 한 번 invalidate된 session은 background에서 재시작 불가 (foreground 필요).
 * - 실제 location 처리는 expo-location의
 *   startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)가 담당.
 *
 * FIX 9-1: CLLocationUpdate.liveUpdates(.fitness) 스트림 제거.
 * liveUpdates는 정지 감지 시 자동 pause하는 API라 expo-location의
 * CLLocationManager와 같은 프로세스에서 동시 구동 시 GPS 누적 중단 유발.
 * CLBackgroundActivitySession만으로 background runtime 확보 충분.
 */
public class PitRunBackgroundActivityModule: Module {
  private var backgroundSession: Any?  // CLBackgroundActivitySession (iOS 17+, Any로 wrap해서 older OS 호환)
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
      NSLog("[PitRunBG] startSession: CLBackgroundActivitySession created (no liveUpdates)")

      promise.resolve(true)
    }

    AsyncFunction("stopSession") { (promise: Promise) in
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
