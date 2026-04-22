import ExpoModulesCore
import CoreLocation
import Foundation

// Reads UID from UserDefaults (written by JS via storeUid).
// When significant location change or visit fires, POSTs heartbeat directly
// to Firebase HTTP Cloud Function — no JS bridge needed.
// This means the heartbeat fires even when the app is terminated.

// Separate NSObject subclass required because CLLocationManagerDelegate
// inherits NSObjectProtocol, which Swift protocols cannot satisfy directly.
private class LocationDelegate: NSObject, CLLocationManagerDelegate {
  var onHeartbeat: ((String) -> Void)?

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    onHeartbeat?("significant")
  }

  func locationManager(_ manager: CLLocationManager, didVisit visit: CLVisit) {
    onHeartbeat?("visit")
  }
}

public class LocationMonitorModule: Module {
  private var locationManager: CLLocationManager?
  private var locationDelegate: LocationDelegate?
  private let UID_KEY = "safesignal_uid"
  private let FIRESTORE_API_KEY = "AIzaSyBgg6V84ZBGjYbi_3E11XWC0Eo4_BQynXA"
  private let FIRESTORE_PROJECT_ID = "safesignal-7d538"

  public func definition() -> ModuleDefinition {
    Name("LocationMonitor")

    OnCreate {
      self.setupLocationManager()
    }

    Function("startNativeMonitoring") { () -> Bool in
      guard let manager = self.locationManager else { return false }
      guard CLLocationManager.authorizationStatus() == .authorizedAlways else { return false }
      manager.startMonitoringSignificantLocationChanges()
      manager.startMonitoringVisits()
      return true
    }

    Function("stopNativeMonitoring") {
      self.locationManager?.stopMonitoringSignificantLocationChanges()
      self.locationManager?.stopMonitoringVisits()
    }

    Function("storeUid") { (uid: String) in
      UserDefaults.standard.set(uid, forKey: self.UID_KEY)
      UserDefaults.standard.synchronize()
    }

    Function("clearUid") {
      UserDefaults.standard.removeObject(forKey: self.UID_KEY)
    }
  }

  private func setupLocationManager() {
    let delegate = LocationDelegate()
    delegate.onHeartbeat = { [weak self] source in
      self?.postHeartbeat(source: source)
    }
    locationDelegate = delegate

    locationManager = CLLocationManager()
    locationManager?.delegate = delegate
    locationManager?.allowsBackgroundLocationUpdates = true
    locationManager?.pausesLocationUpdatesAutomatically = false
  }

  private func postHeartbeat(source: String) {
    guard let uid = UserDefaults.standard.string(forKey: UID_KEY), !uid.isEmpty else { return }
    let urlString = "https://firestore.googleapis.com/v1/projects/\(FIRESTORE_PROJECT_ID)/databases/(default)/documents/heartbeats/\(uid)?key=\(FIRESTORE_API_KEY)"
    guard let url = URL(string: urlString) else { return }
    var request = URLRequest(url: url)
    request.httpMethod = "PATCH"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    let body: [String: Any] = [
      "fields": [
        "lastSeen": ["timestampValue": ISO8601DateFormatter().string(from: Date())],
        "appVersion": ["stringValue": "1.0.0"],
        "source": ["stringValue": source]
      ]
    ]
    request.httpBody = try? JSONSerialization.data(withJSONObject: body)
    URLSession.shared.dataTask(with: request).resume()
  }
}
