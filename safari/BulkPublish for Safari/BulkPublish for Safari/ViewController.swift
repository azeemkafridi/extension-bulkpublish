//
//  ViewController.swift
//  BulkPublish for Safari
//

import Cocoa
import SafariServices
import WebKit

let extensionBundleIdentifier = "com.bulkpublish.safari.Extension"
let safariBundleIdentifier = "com.apple.Safari"

class ViewController: NSViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self
        self.webView.configuration.userContentController.add(self, name: "controller")
        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)

        // Re-check when the person comes back from Safari Settings.
        NotificationCenter.default.addObserver(forName: NSApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            self?.refreshState()
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        refreshState()
    }

    /// Safari cannot always report the state — on a Mac where it has not yet
    /// seen the extension, the call fails. The page still works then: it shows
    /// the neutral instructions instead of on/off.
    func refreshState() {
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { state, error in
            let enabled: String
            if let state = state, error == nil {
                enabled = state.isEnabled ? "true" : "false"
            } else {
                enabled = "null"
            }
            DispatchQueue.main.async {
                self.webView.evaluateJavaScript("show(\(enabled))")
            }
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.body as? String == "open-preferences" else { return }

        // Safari answers this in well under a second when it knows the
        // extension. When it does not (a Mac that has never opened Safari
        // with this app installed) the call can fail, or never call back at
        // all, which left the button doing nothing. Whichever comes first —
        // an error or three seconds of silence — open Safari ourselves and
        // keep this window up with the manual steps.
        var settled = false
        let fallback = {
            guard !settled else { return }
            settled = true
            self.openSafari()
            self.webView.evaluateJavaScript("showFallback()")
        }

        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
            DispatchQueue.main.async {
                if error == nil {
                    guard !settled else { return }
                    settled = true
                    NSApplication.shared.terminate(nil)
                } else {
                    fallback()
                }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3, execute: fallback)
    }

    func openSafari() {
        guard let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: safariBundleIdentifier) else { return }
        NSWorkspace.shared.openApplication(at: url, configuration: NSWorkspace.OpenConfiguration())
    }

}
