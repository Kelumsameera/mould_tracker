# Native Tool Tracker packages

All shells open `https://tools.192.168.0.116.sslip.io:8444/`. They need the
factory LAN and the existing server. They do not bundle or expose the database,
server secrets or admin credentials. Web UI updates arrive from the server;
shell updates require rebuilding the installer/APK with a higher version.

## Windows

From `native/desktop`, run `npm ci` then `npm run dist:win`. The NSIS installer
is written to `outputs/native/desktop/`. It installs for the current Windows
user and adds desktop/Start shortcuts. Normal system title/window controls stay;
browser menus and extension/uninstall toolbars are absent. F11 toggles fullscreen.
Install/trust the factory CA on Windows first using the existing setup page.
The current installer is unsigned: there is no publisher code-signing identity
configured. Do not describe it as Microsoft verified. Obtain a trusted Windows
signing certificate to distribute a publisher-signed release.

## Android

Requires Java 21, Android SDK platform `android-37.0`, build-tools `36.0.0` and
Python. Set `ANDROID_HOME` if needed and run `python native/android/build.py`
on Windows. Output: `outputs/native/Tool-Tracker-2.1.0-android.apk`.
Minimum Android version: Android 8 / API 26. The factory public CA is embedded
only for the factory hostname; no SSL errors are ignored. No system CA install
is necessary for the APK. Use email/password; passkeys in native WebViews have
not been integrated/tested. There is no JavaScript-to-native bridge.

The release key and its password record are generated in the current build
user's `~/.tool-tracker-signing/`, outside the repo. **Back up that directory
securely**: future APK updates must use the same signing key. Never upload the
key/password to the server or download folder. The build verifies APK v2/v3
signatures. Users must allow installation from their browser when Android asks.

## Apple: source prepared, no distributable release yet

On a Mac with Xcode and XcodeGen installed:

```sh
cd native/apple
xcodegen generate
open ToolTracker.xcodeproj
```

Select the appropriate `ToolTrackerIOS` or `ToolTrackerMac` scheme, assign the
owner's Apple Developer team, and set up signing. Install and trust the LAN CA
on each device; normal WebKit TLS validation is retained. The iOS target
includes the local-network permission message. No Apple builds were compiled or
tested from Windows. Add AppIcon assets and validate device behavior before a
distribution release.

For iOS/iPadOS, use a supported signed distribution method such as TestFlight,
Custom Apps/Apple Business Manager, registered-device Ad Hoc, or eligible
Enterprise distribution. A generic unsigned `.ipa` download cannot install on
arbitrary iPhones. Do not publish an iOS download link until a real signed build
and its distribution method exist. Existing PWA installation remains available.

For a downloadable Mac app, archive the Mac target, sign with Developer ID,
notarize, and package a `.dmg` on macOS. Alternatively, the Electron shell has
`npm run dist:mac` for a Mac build environment. Neither path produces a signed
Mac release from this Windows environment.

## Publishing LAN downloads

Only publish finished installers/APKs (plus SHA-256 checksums) to the server's
`deploy/lan-certificates/downloads/` directory. Nginx serves that directory at
`/downloads/` on both LAN HTTP and HTTPS. Keep signing keys, source, dependency
folders and credentials out of this directory. Verify the HTTP downloads match
the local SHA-256 before announcing the release.

References: [Electron security](https://www.electronjs.org/docs/latest/tutorial/security/),
[Android custom trust anchors](https://developer.android.com/privacy-and-security/security-config),
[Apple distribution](https://developer.apple.com/support/compare-memberships/).
