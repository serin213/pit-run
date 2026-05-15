import ExpoModulesCore
import CoreHaptics
import UIKit

public class PitRunHapticsModule: Module {
  private var engine: CHHapticEngine?

  private var supportsHaptics: Bool {
    return CHHapticEngine.capabilitiesForHardware().supportsHaptics
  }

  public func definition() -> ModuleDefinition {
    Name("PitRunHaptics")

    OnCreate {
      self.setupEngine()
    }

    Function("isSupported") { () -> Bool in
      return self.supportsHaptics
    }

    AsyncFunction("singleImpact") {
      self.playSingle()
    }

    AsyncFunction("doubleImpact") {
      self.playDouble()
    }

    AsyncFunction("successLong") {
      self.playSuccessLong()
    }
  }

  private func setupEngine() {
    guard supportsHaptics else { return }
    do {
      let e = try CHHapticEngine()
      e.isAutoShutdownEnabled = false
      e.resetHandler = { [weak self] in
        try? self?.engine?.start()
      }
      e.stoppedHandler = { _ in }
      try e.start()
      engine = e
    } catch {
      engine = nil
    }
  }

  private func ensureEngine() -> CHHapticEngine? {
    if engine == nil { setupEngine() }
    try? engine?.start()
    return engine
  }

  // MARK: - GREEN LIGHT (5-second sustained heavy buzz)

  private func playSingle() {
    guard let engine = ensureEngine() else {
      fallbackImpactRepeated(times: 17, interval: 0.3)
      return
    }

    let fullIntensity = CHHapticEventParameter(parameterID: .hapticIntensity, value: 1.0)
    let highSharp     = CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.9)
    let lowSharp      = CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.3)

    // 5-second continuous "rumble" body for sustained weight.
    let body = CHHapticEvent(eventType: .hapticContinuous,
                             parameters: [fullIntensity, lowSharp],
                             relativeTime: 0,
                             duration: 1.5)

    // Sharp transient stack to keep perception alive across the 5s
    // (continuous haptics fade in perception without re-triggers).
    var events: [CHHapticEvent] = [body]
    var t: TimeInterval = 0
    while t < 1.5 {
      events.append(CHHapticEvent(eventType: .hapticTransient,
                                  parameters: [fullIntensity, highSharp],
                                  relativeTime: t))
      t += 0.15
    }

    play(events: events, on: engine)
  }

  // MARK: - BOX BOX / FULL PUSH

  private func playDouble() {
    guard let engine = ensureEngine() else {
      fallbackHeavyBuzz()
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.22) { [weak self] in
        self?.fallbackHeavyBuzz()
      }
      return
    }

    let fullIntensity = CHHapticEventParameter(parameterID: .hapticIntensity, value: 1.0)
    let highSharp     = CHHapticEventParameter(parameterID: .hapticSharpness, value: 1.0)
    let lowSharp      = CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.3)

    func burst(at t: TimeInterval) -> [CHHapticEvent] {
      return [
        CHHapticEvent(eventType: .hapticContinuous,
                      parameters: [fullIntensity, lowSharp],
                      relativeTime: t,
                      duration: 0.18),
        CHHapticEvent(eventType: .hapticTransient,
                      parameters: [fullIntensity, highSharp],
                      relativeTime: t),
        CHHapticEvent(eventType: .hapticTransient,
                      parameters: [fullIntensity, highSharp],
                      relativeTime: t + 0.05),
      ]
    }

    let events = burst(at: 0) + burst(at: 0.22)
    play(events: events, on: engine)
  }

  // MARK: - Race end / qualifying end

  private func playSuccessLong() {
    guard let engine = ensureEngine() else { fallbackHeavyBuzz(); return }

    let fullIntensity = CHHapticEventParameter(parameterID: .hapticIntensity, value: 1.0)
    let medSharp      = CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.6)
    let highSharp     = CHHapticEventParameter(parameterID: .hapticSharpness, value: 1.0)

    let body = CHHapticEvent(eventType: .hapticContinuous,
                             parameters: [fullIntensity, medSharp],
                             relativeTime: 0,
                             duration: 0.7)
    let kickStart = CHHapticEvent(eventType: .hapticTransient,
                                  parameters: [fullIntensity, highSharp],
                                  relativeTime: 0)
    let kickMid = CHHapticEvent(eventType: .hapticTransient,
                                parameters: [fullIntensity, highSharp],
                                relativeTime: 0.35)
    let kickEnd = CHHapticEvent(eventType: .hapticTransient,
                                parameters: [fullIntensity, highSharp],
                                relativeTime: 0.7)
    play(events: [body, kickStart, kickMid, kickEnd], on: engine)
  }

  private func play(events: [CHHapticEvent], on engine: CHHapticEngine) {
    do {
      let pattern = try CHHapticPattern(events: events, parameters: [])
      let player = try engine.makePlayer(with: pattern)
      try player.start(atTime: 0)
    } catch {}
  }

  private func fallbackHeavyBuzz() {
    DispatchQueue.main.async {
      let gen = UIImpactFeedbackGenerator(style: .heavy)
      gen.prepare()
      gen.impactOccurred(intensity: 1.0)
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
      let gen = UIImpactFeedbackGenerator(style: .heavy)
      gen.prepare()
      gen.impactOccurred(intensity: 1.0)
    }
  }

  private func fallbackImpactRepeated(times: Int, interval: TimeInterval) {
    for i in 0..<times {
      DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * interval) {
        let gen = UIImpactFeedbackGenerator(style: .heavy)
        gen.prepare()
        gen.impactOccurred(intensity: 1.0)
      }
    }
  }
}
