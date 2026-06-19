import ExpoModulesCore
import AVFoundation

/**
 * AVAudioSession interruption/route observer — 순수 관찰자(observer-only).
 *
 * 엔진음 keep-alive(연속 오디오로 잠금 중 앱 생존)의 인터럽션 복구를 정확히 하기 위함.
 * expo-audio의 AudioStatus엔 인터럽션 시작/끝 전용 이벤트가 없어 `playing===false`로
 * 추론해야 하는데, 그건 다의적(트랙 끝/우리 pause/버퍼링/라우트 변경 등). 이 모듈은
 * iOS 네이티브 AVAudioSession.interruptionNotification을 직접 구독해 명확한
 * .began/.ended(+shouldResume)를 JS로 emit한다.
 *
 * 중요: 이 모듈은 절대 setActive 하지 않는다(세션 조작 금지). 세션/플레이어 제어는
 * 전부 JS(expo-audio)가 담당 — 네이티브가 setActive까지 하면 expo-audio와 세션
 * 소유권이 충돌한다. 여기서는 "관찰 + 이벤트 emit"만 한다.
 *
 * .ended + shouldResume = iOS가 "지금 세션 재활성해도 된다"고 보증하는 정확한 순간.
 * 음악 앱이 통화 후 자동 재개하는 sanctioned 경로 → JS가 이 시점에 player.play()를
 * 호출하면 백그라운드 오디오 재시작이 안정적이다.
 */
public class PitRunAudioSessionModule: Module {
  private var interruptionToken: NSObjectProtocol?
  private var routeChangeToken: NSObjectProtocol?
  private var mediaResetToken: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("PitRunAudioSession")

    Events("interruption", "routeChange", "mediaServicesReset")

    OnCreate {
      self.startObserving()
    }

    OnDestroy {
      self.stopObserving()
    }

    Function("isSupported") { () -> Bool in
      return true
    }
  }

  private func startObserving() {
    let nc = NotificationCenter.default

    interruptionToken = nc.addObserver(
      forName: AVAudioSession.interruptionNotification,
      object: nil,
      queue: nil
    ) { [weak self] notif in
      guard
        let info = notif.userInfo,
        let typeRaw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
        let type = AVAudioSession.InterruptionType(rawValue: typeRaw)
      else { return }

      switch type {
      case .began:
        self?.sendEvent("interruption", ["phase": "began"])
      case .ended:
        var shouldResume = false
        if let optRaw = info[AVAudioSessionInterruptionOptionKey] as? UInt {
          let opts = AVAudioSession.InterruptionOptions(rawValue: optRaw)
          shouldResume = opts.contains(.shouldResume)
        }
        self?.sendEvent("interruption", ["phase": "ended", "shouldResume": shouldResume])
      @unknown default:
        break
      }
    }

    routeChangeToken = nc.addObserver(
      forName: AVAudioSession.routeChangeNotification,
      object: nil,
      queue: nil
    ) { [weak self] notif in
      var reasonStr = "unknown"
      if
        let info = notif.userInfo,
        let reasonRaw = info[AVAudioSessionRouteChangeReasonKey] as? UInt,
        let reason = AVAudioSession.RouteChangeReason(rawValue: reasonRaw)
      {
        switch reason {
        case .oldDeviceUnavailable: reasonStr = "oldDeviceUnavailable"
        case .newDeviceAvailable:   reasonStr = "newDeviceAvailable"
        case .categoryChange:       reasonStr = "categoryChange"
        case .override:             reasonStr = "override"
        default:                    reasonStr = "other"
        }
      }
      self?.sendEvent("routeChange", ["reason": reasonStr])
    }

    mediaResetToken = nc.addObserver(
      forName: AVAudioSession.mediaServicesWereResetNotification,
      object: nil,
      queue: nil
    ) { [weak self] _ in
      self?.sendEvent("mediaServicesReset", [:])
    }
  }

  private func stopObserving() {
    let nc = NotificationCenter.default
    if let t = interruptionToken { nc.removeObserver(t) }
    if let t = routeChangeToken { nc.removeObserver(t) }
    if let t = mediaResetToken { nc.removeObserver(t) }
    interruptionToken = nil
    routeChangeToken = nil
    mediaResetToken = nil
  }
}
