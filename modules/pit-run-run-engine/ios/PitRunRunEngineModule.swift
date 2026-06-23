import ExpoModulesCore
import CoreLocation
import Foundation
import UserNotifications
import AVFoundation

private let RunEngineSnapshotNotification = Notification.Name("PitRunRunEngineSnapshot")

private struct NativeLapEntry {
  let idx: Int
  let type: String
  let distM: Int
  let durationSec: Double
  let paceS: Int?

  func dictionary() -> [String: Any] {
    return [
      "idx": idx,
      "type": type,
      "distM": distM,
      "durationSec": durationSec,
      "paceS": nullable(paceS)
    ]
  }
}

private final class RunEngineLocationDelegate: NSObject, CLLocationManagerDelegate {
  weak var owner: PitRunRunEngineModule?

  init(owner: PitRunRunEngineModule) {
    self.owner = owner
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    owner?.handleLocationUpdates(locations)
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    owner?.handleLocationError(error)
  }
}

public class PitRunRunEngineModule: Module {
  private lazy var locationDelegate = RunEngineLocationDelegate(owner: self)

  private lazy var locationManager: CLLocationManager = {
    let manager = CLLocationManager()
    manager.delegate = locationDelegate
    manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
    manager.distanceFilter = kCLDistanceFilterNone
    manager.activityType = .fitness
    manager.pausesLocationUpdatesAutomatically = false
    if #available(iOS 9.0, *) {
      manager.allowsBackgroundLocationUpdates = true
    }
    if #available(iOS 11.0, *) {
      manager.showsBackgroundLocationIndicator = true
    }
    return manager
  }()

  private var tickTimer: Timer?
  private var lastLocation: CLLocation?

  private var raceId: String?
  private var activityId: String?
  private var isRunning = false
  private var isPaused = false
  private var startedAtMs: Double = 0
  private var pausedAtMs: Double?
  private var pausedTotalMs: Double = 0

  private var distKm: Double = 0
  private var intervalKm: Double = 0.4
  private var recoveryDurationMs: Double = 180_000
  private var maxReps: Int = Int.max
  private var completedReps: Int = 0
  private var circuitKm: Double = 0
  private var expectedCycleM: Double = 600
  private var tire: String = "medium"
  private var triggerMode: String = "distance"

  private var nextFullPushAtMs: Double?
  private var nextBoxBoxAtMs: Double?
  private var predictedWorkMs: Double = 0
  private var lastBoxBoxAtKm: Double = 0
  private var lastFiredAt: String?
  private var lastFiredAtMs: Double?
  private var workStartedAtMs: Double = 0
  private var workStartedAtKm: Double = 0
  private var pitStartedAtMs: Double?
  private var pitStartedAtKm: Double?
  private var finalLapFired = false
  private var finishFired = false
  private var lapLog: [NativeLapEntry] = []

  private var lastSnapshotEventAtMs: Double = 0
  private var lastNativeLAPostAtMs: Double = 0
  private var lastLiveActivityAPNsPostAtMs: Double = 0

  private var liveActivityPushEnabled = false
  private var liveActivityPushURL: URL?
  private var liveActivityPushAnonKey: String?
  private var liveActivityPushAccessToken: String?
  private var audioPlayers: [String: AVAudioPlayer] = [:]

  private let alertMs: Double = 5_000
  private let regularLiveActivityCadenceMs: Double = 20_000
  private let regularLiveActivityAPNsCadenceMs: Double = 60_000
  private let maxStaleMs: Double = 10_000
  private let maxAccuracyM: CLLocationAccuracy = 100
  private let maxRunningSpeedMs: Double = 10
  private let minSpeedMs: Double = 0.3
  private let minDeltaKm: Double = 0.0005

  public func definition() -> ModuleDefinition {
    Name("PitRunRunEngine")

    Events("onRunSnapshot", "onRunEvent")

    OnCreate {
      self.locationManager.delegate = self.locationDelegate
    }

    Function("isSupported") { () -> Bool in
      return CLLocationManager.locationServicesEnabled()
    }

    AsyncFunction("startRace") { (config: [String: Any], promise: Promise) in
      self.startRace(config: config)
      promise.resolve(self.snapshotDictionary())
    }
    .runOnQueue(DispatchQueue.main)

    AsyncFunction("pauseRace") { (promise: Promise) in
      self.pauseRace()
      promise.resolve(self.snapshotDictionary())
    }
    .runOnQueue(DispatchQueue.main)

    AsyncFunction("resumeRace") { (promise: Promise) in
      self.resumeRace()
      promise.resolve(self.snapshotDictionary())
    }
    .runOnQueue(DispatchQueue.main)

    AsyncFunction("stopRace") { (promise: Promise) in
      self.stopRace()
      promise.resolve(self.snapshotDictionary())
    }
    .runOnQueue(DispatchQueue.main)

    AsyncFunction("getSnapshot") { (promise: Promise) in
      promise.resolve(self.isRunning ? self.snapshotDictionary() : nil)
    }
    .runOnQueue(DispatchQueue.main)
  }

  private func startRace(config: [String: Any]) {
    stopRace(clearEvents: false)

    let now = Self.nowMs()
    raceId = stringValue(config["raceId"])
    activityId = stringValue(config["activityId"])
    startedAtMs = doubleValue(config["startedAtMs"], defaultValue: now)
    pausedTotalMs = max(0, doubleValue(config["initialElapsedMs"], defaultValue: 0) - (now - startedAtMs))
    pausedAtMs = nil
    isRunning = true
    isPaused = false

    distKm = doubleValue(config["initialDistKm"], defaultValue: 0)
    intervalKm = max(0.001, doubleValue(config["intervalKm"], defaultValue: 0.4))
    recoveryDurationMs = max(0, doubleValue(config["recoveryDurationMs"], defaultValue: 180_000))
    maxReps = max(1, intValue(config["maxReps"], defaultValue: Int.max))
    circuitKm = max(0, doubleValue(config["circuitKm"], defaultValue: 0))
    expectedCycleM = max(1, doubleValue(config["expectedCycleM"], defaultValue: intervalKm * 1500))
    tire = stringValue(config["tire"]) ?? "medium"
    triggerMode = stringValue(config["triggerMode"]) ?? "distance"
    predictedWorkMs = max(0, doubleValue(config["predictedWorkMs"], defaultValue: 0))
    configureLiveActivityPush(config["liveActivityPush"])

    completedReps = 0
    nextFullPushAtMs = nil
    if triggerMode == "time" && predictedWorkMs > 0 {
      nextBoxBoxAtMs = now + predictedWorkMs
    } else {
      nextBoxBoxAtMs = nil
    }
    lastBoxBoxAtKm = distKm
    lastFiredAt = nil
    lastFiredAtMs = nil
    workStartedAtMs = now
    workStartedAtKm = distKm
    pitStartedAtMs = nil
    pitStartedAtKm = nil
    finalLapFired = false
    finishFired = false
    lapLog = []
    lastLocation = nil

    configureAudioSession()
    startLocationUpdates()
    startTimer()
    cancelScheduledNotifications()
    emitSnapshot(force: true)
  }

  private func pauseRace() {
    guard isRunning, !isPaused else { return }
    isPaused = true
    pausedAtMs = Self.nowMs()
    lastLocation = nil
    lastFiredAt = nil
    lastFiredAtMs = nil
    cancelScheduledNotifications()
    stopTimer()
    locationManager.stopUpdatingLocation()
    emitSnapshot(force: true)
  }

  private func resumeRace() {
    guard isRunning, isPaused else { return }
    let now = Self.nowMs()
    if let pausedAt = pausedAtMs {
      let pausedFor = max(0, now - pausedAt)
      pausedTotalMs += pausedFor
      if let nextFullPush = nextFullPushAtMs { nextFullPushAtMs = nextFullPush + pausedFor }
      if let nextBoxBox = nextBoxBoxAtMs { nextBoxBoxAtMs = nextBoxBox + pausedFor }
      workStartedAtMs += pausedFor
      if let pitStart = pitStartedAtMs { pitStartedAtMs = pitStart + pausedFor }
    }
    pausedAtMs = nil
    isPaused = false
    lastLocation = nil
    lastFiredAt = nil
    lastFiredAtMs = nil
    startLocationUpdates()
    startTimer()
    emitSnapshot(force: true)
  }

  private func stopRace(clearEvents: Bool = true) {
    isRunning = false
    isPaused = false
    pausedAtMs = nil
    lastLocation = nil
    cancelScheduledNotifications()
    stopTimer()
    locationManager.stopUpdatingLocation()
    resetLiveActivityPushRuntime()
    if clearEvents {
      emitSnapshot(force: true)
    }
  }

  private func startLocationUpdates() {
    let status = locationManager.authorizationStatus
    if status == .notDetermined {
      locationManager.requestWhenInUseAuthorization()
      locationManager.requestAlwaysAuthorization()
    }
    locationManager.startUpdatingLocation()
  }

  private func startTimer() {
    stopTimer()
    tickTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
      guard let self = self else { return }
      self.evaluateEvents(now: Self.nowMs())
      self.emitSnapshot(force: false)
    }
    if let timer = tickTimer {
      RunLoop.main.add(timer, forMode: .common)
    }
  }

  private func stopTimer() {
    tickTimer?.invalidate()
    tickTimer = nil
  }

  fileprivate func handleLocationUpdates(_ locations: [CLLocation]) {
    guard isRunning, !isPaused else { return }
    for location in locations {
      process(location: location)
    }
    evaluateEvents(now: Self.nowMs())
    emitSnapshot(force: false)
  }

  fileprivate func handleLocationError(_ error: Error) {
    NSLog("[PitRunRunEngine] location error: %@", "\(error)")
  }

  private func process(location: CLLocation) {
    let now = Self.nowMs()
    let ageMs = now - (location.timestamp.timeIntervalSince1970 * 1000)
    guard ageMs <= maxStaleMs else { return }
    guard location.horizontalAccuracy >= 0, location.horizontalAccuracy <= maxAccuracyM else { return }

    defer { lastLocation = location }
    guard let previous = lastLocation else { return }
    let dtSec = location.timestamp.timeIntervalSince(previous.timestamp)
    guard dtSec > 0 else { return }

    let haversine = previous.distance(from: location) / 1000
    let impliedSpeed = (haversine * 1000) / dtSec
    guard impliedSpeed <= maxRunningSpeedMs else { return }

    let dopplerSpeed = location.speed
    let deltaKm: Double
    if dopplerSpeed >= minSpeedMs {
      deltaKm = (dopplerSpeed * dtSec) / 1000
    } else if impliedSpeed >= minSpeedMs && haversine >= minDeltaKm {
      deltaKm = haversine
    } else {
      return
    }

    guard deltaKm > 0, !isPaused else { return }
    distKm += deltaKm
  }

  private func evaluateEvents(now: Double) {
    guard isRunning, !isPaused, !finishFired else { return }

    if circuitKm > 0, distKm >= circuitKm {
      finishFired = true
      finalLapFired = true
      lastFiredAt = nil
      lastFiredAtMs = nil
      playAudioCue(kind: "finish")
      emitEvent(kind: "finish", now: now)
      emitSnapshot(force: true)
      return
    }

    if !finalLapFired, nextFullPushAtMs == nil, shouldFireFinalLap() {
      finalLapFired = true
      playAudioCue(kind: "finalLap")
      emitEvent(kind: "finalLap", now: now)
      emitSnapshot(force: true)
    }

    if let fullPushAt = nextFullPushAtMs, now >= fullPushAt {
      fireFullPush(now: now)
      return
    }

    guard nextFullPushAtMs == nil, completedReps < maxReps, !finalLapFired else { return }
    if triggerMode == "time", let boxAt = nextBoxBoxAtMs {
      if now >= boxAt {
        fireBoxBox(now: now)
      }
      return
    }

    let workKm = distKm - lastBoxBoxAtKm
    if workKm >= intervalKm {
      fireBoxBox(now: now)
    }
  }

  private func fireBoxBox(now: Double) {
    guard isRunning, !isPaused, nextFullPushAtMs == nil else { return }
    let triggerDistKm = distKm
    completedReps += 1
    lastBoxBoxAtKm = triggerDistKm
    nextBoxBoxAtMs = nil
    nextFullPushAtMs = now + alertMs + recoveryDurationMs
    lastFiredAt = "boxbox"
    lastFiredAtMs = now
    pitStartedAtMs = now
    pitStartedAtKm = triggerDistKm

    let distM = max(0, Int(round((triggerDistKm - workStartedAtKm) * 1000)))
    let durationSec = max(0.1, (now - workStartedAtMs) / 1000)
    let paceS = distM > 0 ? Int(round(durationSec / (Double(distM) / 1000))) : nil
    lapLog.append(NativeLapEntry(
      idx: lapLog.count,
      type: "lap",
      distM: distM,
      durationSec: durationSec,
      paceS: paceS
    ))

    playAudioCue(kind: "boxbox")
    emitEvent(kind: "boxbox", now: now)
    schedulePostAlertSnapshot(kind: "boxbox", firedAtMs: now)
    emitSnapshot(force: true)
  }

  private func fireFullPush(now: Double) {
    guard isRunning, !isPaused, nextFullPushAtMs != nil else { return }
    let triggerDistKm = distKm

    if let pitStartedAt = pitStartedAtMs, let pitStartedKm = pitStartedAtKm {
      let distM = max(0, Int(round((triggerDistKm - pitStartedKm) * 1000)))
      let durationSec = max(0.1, (now - pitStartedAt) / 1000)
      lapLog.append(NativeLapEntry(
        idx: lapLog.count,
        type: "pit",
        distM: distM,
        durationSec: durationSec,
        paceS: nil
      ))
    }

    nextFullPushAtMs = nil
    if triggerMode == "time", predictedWorkMs > 0 {
      nextBoxBoxAtMs = now + predictedWorkMs
    } else {
      nextBoxBoxAtMs = nil
    }
    lastBoxBoxAtKm = triggerDistKm
    lastFiredAt = "fullPush"
    lastFiredAtMs = now
    workStartedAtMs = now
    workStartedAtKm = triggerDistKm
    pitStartedAtMs = nil
    pitStartedAtKm = nil

    playAudioCue(kind: "fullPush")
    emitEvent(kind: "fullPush", now: now)
    schedulePostAlertSnapshot(kind: "fullPush", firedAtMs: now)
    emitSnapshot(force: true)
  }

  private func shouldFireFinalLap() -> Bool {
    guard circuitKm > 0 else { return false }
    let remainingM = max(0, (circuitKm - distKm) * 1000)
    if remainingM <= expectedCycleM { return true }
    return remainingM <= max(100, intervalKm * 1000)
  }

  private func pitPhase(now: Double) -> String {
    if finishFired { return "completed" }
    if !isRunning || isPaused { return "none" }
    if lastFiredAt == "boxbox", let firedAt = lastFiredAtMs, now - firedAt < alertMs {
      return "boxbox"
    }
    if lastFiredAt == "fullPush", let firedAt = lastFiredAtMs, now - firedAt < alertMs {
      return "fullPush"
    }
    if let fullPushAt = nextFullPushAtMs, fullPushAt > now {
      return "inPit"
    }
    return "none"
  }

  private func elapsedMs(now: Double) -> Double {
    if startedAtMs <= 0 { return 0 }
    let pausedInProgress = isPaused ? max(0, now - (pausedAtMs ?? now)) : 0
    return max(0, now - startedAtMs - pausedTotalMs - pausedInProgress)
  }

  private func snapshotDictionary() -> [String: Any] {
    return snapshotDictionary(now: Self.nowMs())
  }

  private func snapshotDictionary(now: Double) -> [String: Any] {
    let elapsed = elapsedMs(now: now)
    let pace = distKm > 0 ? Int(round((elapsed / 1000) / distKm)) : 0
    let progress = circuitKm > 0 ? min(max(distKm / circuitKm, 0), 1) : 0
    return [
      "raceId": nullable(raceId),
      "activityId": nullable(activityId),
      "isRunning": isRunning,
      "isPaused": isPaused,
      "startedAtMs": Int(round(startedAtMs)),
      "pausedAtMs": nullable(pausedAtMs),
      "distKm": distKm,
      "elapsedMs": Int(round(elapsed)),
      "paceS": pace,
      "prog": progress,
      "tire": tire,
      "pitPhase": pitPhase(now: now),
      "completedReps": completedReps,
      "intervalKm": intervalKm,
      "recoveryDurationMs": Int(round(recoveryDurationMs)),
      "maxReps": maxReps,
      "circuitKm": circuitKm,
      "expectedCycleM": Int(round(expectedCycleM)),
      "nextFullPushAtMs": nullable(nextFullPushAtMs),
      "nextBoxBoxAtMs": nullable(nextBoxBoxAtMs),
      "predictedWorkMs": Int(round(predictedWorkMs)),
      "lastBoxBoxAtKm": lastBoxBoxAtKm,
      "workStartedAtMs": Int(round(workStartedAtMs)),
      "workStartedAtKm": workStartedAtKm,
      "pitStartedAtMs": nullable(pitStartedAtMs),
      "pitStartedAtKm": nullable(pitStartedAtKm),
      "finalLapFired": finalLapFired,
      "finishFired": finishFired,
      "lapLog": lapLog.map { $0.dictionary() },
      "mode": "race"
    ]
  }

  private func emitSnapshot(force: Bool) {
    let now = Self.nowMs()
    if !force && now - lastSnapshotEventAtMs < 1_000 { return }
    lastSnapshotEventAtMs = now
    let snapshot = snapshotDictionary(now: now)
    sendEvent("onRunSnapshot", snapshot)
    if force || now - lastNativeLAPostAtMs >= regularLiveActivityCadenceMs {
      lastNativeLAPostAtMs = now
      NotificationCenter.default.post(
        name: RunEngineSnapshotNotification,
        object: nil,
        userInfo: snapshot
      )
    }
    pushLiveActivityAPNsIfNeeded(snapshot: snapshot, now: now)
  }

  private func emitEvent(kind: String, now: Double) {
    let snapshot = snapshotDictionary(now: now)
    sendEvent("onRunEvent", [
      "kind": kind,
      "firedAtMs": Int(round(now)),
      "distKm": distKm,
      "snapshot": snapshot
    ])
    forceLiveActivitySnapshot(snapshot: snapshot, now: now, priority: 10)
  }

  private func forceLiveActivitySnapshot(priority: Int) {
    let now = Self.nowMs()
    let snapshot = snapshotDictionary(now: now)
    forceLiveActivitySnapshot(snapshot: snapshot, now: now, priority: priority)
  }

  private func forceLiveActivitySnapshot(snapshot: [String: Any], now: Double, priority: Int) {
    lastNativeLAPostAtMs = now
    NotificationCenter.default.post(
      name: RunEngineSnapshotNotification,
      object: nil,
      userInfo: snapshot
    )
    pushLiveActivityAPNs(snapshot: snapshot, now: now, priority: priority, force: true)
  }

  private func schedulePostAlertSnapshot(kind: String, firedAtMs: Double) {
    let delaySec = (alertMs / 1000) + 0.25
    DispatchQueue.main.asyncAfter(deadline: .now() + delaySec) { [weak self] in
      guard let self = self else { return }
      guard self.isRunning, !self.isPaused, self.lastFiredAt == kind else { return }
      guard let currentFiredAt = self.lastFiredAtMs, abs(currentFiredAt - firedAtMs) < 1 else { return }
      self.forceLiveActivitySnapshot(priority: 10)
    }
  }

  private func configureLiveActivityPush(_ value: Any?) {
    resetLiveActivityPushRuntime()
    guard
      let config = value as? [String: Any],
      boolValue(config["enabled"], defaultValue: false),
      let supabaseUrl = stringValue(config["supabaseUrl"]),
      let anonKey = stringValue(config["supabaseAnonKey"]),
      let accessToken = stringValue(config["accessToken"])
    else {
      return
    }

    let trimmedUrl = supabaseUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    guard let url = URL(string: "\(trimmedUrl)/functions/v1/live-activity-push") else {
      return
    }

    liveActivityPushEnabled = true
    liveActivityPushURL = url
    liveActivityPushAnonKey = anonKey
    liveActivityPushAccessToken = accessToken
    lastLiveActivityAPNsPostAtMs = 0
  }

  private func resetLiveActivityPushRuntime() {
    liveActivityPushEnabled = false
    liveActivityPushURL = nil
    liveActivityPushAnonKey = nil
    liveActivityPushAccessToken = nil
    lastLiveActivityAPNsPostAtMs = 0
  }

  private func pushLiveActivityAPNsIfNeeded(snapshot: [String: Any], now: Double) {
    guard !isPaused else { return }
    guard now - lastLiveActivityAPNsPostAtMs >= regularLiveActivityAPNsCadenceMs else { return }
    pushLiveActivityAPNs(snapshot: snapshot, now: now, priority: 5, force: false)
  }

  private func pushLiveActivityAPNs(snapshot: [String: Any], now: Double, priority: Int, force: Bool) {
    guard liveActivityPushEnabled else { return }
    guard let url = liveActivityPushURL else { return }
    guard let anonKey = liveActivityPushAnonKey, let accessToken = liveActivityPushAccessToken else { return }
    guard let activityId = stringValue(snapshot["activityId"]) else { return }
    if !force && now - lastLiveActivityAPNsPostAtMs < regularLiveActivityAPNsCadenceMs { return }

    lastLiveActivityAPNsPostAtMs = now

    let contentState: [String: Any] = [
      "distKm": doubleValue(snapshot["distKm"], defaultValue: 0),
      "elapsedMs": intValue(snapshot["elapsedMs"], defaultValue: 0),
      "paceS": intValue(snapshot["paceS"], defaultValue: 0),
      "sector": "red",
      "tire": stringValue(snapshot["tire"]) ?? "medium",
      "pitPhase": stringValue(snapshot["pitPhase"]) ?? "none",
      "prog": doubleValue(snapshot["prog"], defaultValue: 0),
      "isPaused": boolValue(snapshot["isPaused"], defaultValue: false),
      "mode": stringValue(snapshot["mode"]) ?? "race",
      "timerStartMs": NSNull(),
      "timerEndMs": NSNull()
    ]

    let body: [String: Any] = [
      "activityId": activityId,
      "contentState": contentState,
      "priority": priority == 10 ? 10 : 5,
      "event": "update",
      "staleDateMs": Int(round(now + 60_000)),
      "relevanceScore": priority == 10 ? 1.0 : 0.5
    ]

    guard JSONSerialization.isValidJSONObject(body) else { return }
    guard let data = try? JSONSerialization.data(withJSONObject: body) else { return }

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue(anonKey, forHTTPHeaderField: "apikey")
    request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
    request.httpBody = data

    URLSession.shared.dataTask(with: request) { _, response, error in
      if let error = error {
        NSLog("[PitRunRunEngine] LA APNs push failed: %@", "\(error)")
        return
      }
      if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
        NSLog("[PitRunRunEngine] LA APNs push HTTP %d", http.statusCode)
      }
    }.resume()
  }

  private func cancelScheduledNotifications() {
    UNUserNotificationCenter.current().getPendingNotificationRequests { requests in
      let ids = requests
        .map { $0.identifier }
        .filter { $0.hasPrefix("pitrun-runengine-") }
      if !ids.isEmpty {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ids)
      }
    }
    UNUserNotificationCenter.current().getDeliveredNotifications { notifications in
      let ids = notifications
        .map { $0.request.identifier }
        .filter { $0.hasPrefix("pitrun-runengine-") }
      if !ids.isEmpty {
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: ids)
      }
    }
  }

  private func configureAudioSession() {
    let session = AVAudioSession.sharedInstance()
    try? session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
    try? session.setActive(true)
  }

  private func playAudioCue(kind: String) {
    guard let fileName = audioCueFileName(kind: kind) else { return }
    configureAudioSession()

    let parts = fileName.split(separator: ".", maxSplits: 1).map(String.init)
    guard parts.count == 2 else { return }
    guard let url = Bundle.main.url(forResource: parts[0], withExtension: parts[1]) else {
      NSLog("[PitRunRunEngine] audio cue missing: %@", fileName)
      return
    }

    let player: AVAudioPlayer
    if let cached = audioPlayers[fileName] {
      player = cached
    } else {
      guard let created = try? AVAudioPlayer(contentsOf: url) else {
        NSLog("[PitRunRunEngine] audio cue load failed: %@", fileName)
        return
      }
      created.prepareToPlay()
      audioPlayers[fileName] = created
      player = created
    }

    if player.isPlaying {
      player.stop()
    }
    player.currentTime = 0
    player.prepareToPlay()
    player.play()
  }

  private func audioCueFileName(kind: String) -> String? {
    switch kind {
    case "boxbox":
      return "notif-boxbox.caf"
    case "fullPush":
      return "notif-fullpush.caf"
    case "finalLap":
      return "final-lap.caf"
    case "finish":
      return "chequered-flag.caf"
    default:
      return nil
    }
  }

  private static func nowMs() -> Double {
    return Date().timeIntervalSince1970 * 1000
  }

  private func stringValue(_ value: Any?) -> String? {
    if let value = value as? String, !value.isEmpty { return value }
    return nil
  }

  private func doubleValue(_ value: Any?, defaultValue: Double) -> Double {
    if let value = value as? Double { return value }
    if let value = value as? Int { return Double(value) }
    if let value = value as? NSNumber { return value.doubleValue }
    return defaultValue
  }

  private func intValue(_ value: Any?, defaultValue: Int) -> Int {
    if let value = value as? Int { return value }
    if let value = value as? Double { return Int(value) }
    if let value = value as? NSNumber { return value.intValue }
    return defaultValue
  }

  private func boolValue(_ value: Any?, defaultValue: Bool) -> Bool {
    if let value = value as? Bool { return value }
    if let value = value as? NSNumber { return value.boolValue }
    return defaultValue
  }
}

private func nullable<T>(_ value: T?) -> Any {
  return value as Any? ?? NSNull()
}
