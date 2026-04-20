import ExpoModulesCore

public class UnlockDetectorModule: Module {
  public func definition() -> ModuleDefinition {
    Name("UnlockDetector")

    Events("onUnlock")

    OnCreate {
      NotificationCenter.default.addObserver(
        self,
        selector: #selector(self.protectedDataAvailable),
        name: UIApplication.protectedDataDidBecomeAvailableNotification,
        object: nil
      )
    }

    OnDestroy {
      NotificationCenter.default.removeObserver(self)
    }
  }

  @objc func protectedDataAvailable() {
    sendEvent("onUnlock")
  }
}
