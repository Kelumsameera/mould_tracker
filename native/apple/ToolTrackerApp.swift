import SwiftUI
import WebKit

private let factoryURL = URL(string: "https://tools.192.168.0.116.sslip.io:8444/")!

@main
struct ToolTrackerApp: App {
    @StateObject private var connection = FactoryConnection()
    var body: some Scene {
        WindowGroup("Mould Tracker") {
            ZStack {
                FactoryWebView(connection: connection)
                if connection.loading || connection.failed {
                    VStack(spacing: 20) {
                        Text("Mould Tracker").font(.title)
                        if connection.failed {
                            Text("Connect to the factory Wi-Fi or LAN and make sure the server is running. On a new device, install and trust the factory certificate first.")
                            Text("Setup: http://192.168.0.116:8081/install.html").textSelection(.enabled)
                            Button("Try again") { connection.load() }
                        } else {
                            ProgressView().tint(.white)
                            Text("Connecting to the factory server…")
                        }
                    }
                    .multilineTextAlignment(.center).padding(32)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(red: 27/255, green: 43/255, blue: 53/255)).foregroundColor(.white)
                }
            }
            .onAppear { connection.load() }
        }
    }
}

final class FactoryConnection: NSObject, ObservableObject, WKNavigationDelegate {
    @Published var loading = true
    @Published var failed = false
    let webView: WKWebView
    override init() {
        let config = WKWebViewConfiguration()
        config.applicationNameForUserAgent = "ToolTrackerNative/2.2.0"
        webView = WKWebView(frame: .zero, configuration: config)
        super.init()
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true
    }
    func load() {
        failed = false; loading = true
        webView.load(URLRequest(url: factoryURL))
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let url = navigationAction.request.url
        let allowed = url?.scheme == factoryURL.scheme && url?.host == factoryURL.host && url?.port == factoryURL.port
        decisionHandler(allowed ? .allow : .cancel)
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { loading = false }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { failed = true; loading = false }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { failed = true; loading = false }
    // Default WebKit certificate validation is intentionally retained.
}

#if os(macOS)
struct FactoryWebView: NSViewRepresentable {
    @ObservedObject var connection: FactoryConnection
    func makeNSView(context: Context) -> WKWebView { connection.webView }
    func updateNSView(_ nsView: WKWebView, context: Context) {}
}
#else
struct FactoryWebView: UIViewRepresentable {
    @ObservedObject var connection: FactoryConnection
    func makeUIView(context: Context) -> WKWebView { connection.webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
#endif
