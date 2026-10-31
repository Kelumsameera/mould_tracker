"""Build/sign a LAN APK with installed Android SDK tools, without Gradle downloads."""
from pathlib import Path
import hashlib
import json
import os
import re
import secrets
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
SDK = Path(os.environ.get("ANDROID_HOME", Path.home() / "AppData/Local/Android/Sdk"))
TOOLS = SDK / "build-tools/36.0.0"
ANDROID = SDK / "platforms/android-37.0/android.jar"
BUILD = ROOT / "build"
OUT = REPO / "outputs/native"
SIGNING = Path.home() / ".tool-tracker-signing"
MANIFEST = (ROOT / "AndroidManifest.xml").read_text(encoding="utf-8")
VERSION_CODE = int(re.search(r'android:versionCode="(\d+)"', MANIFEST).group(1))
VERSION_NAME = re.search(r'android:versionName="([^"]+)"', MANIFEST).group(1)

def run(*args, env=None):
    subprocess.run([str(a) for a in args], check=True, env=env, cwd=ROOT)

for directory in (BUILD, BUILD / "classes", BUILD / "dex", OUT, SIGNING):
    directory.mkdir(parents=True, exist_ok=True)
if not ANDROID.exists():
    raise SystemExit("Install Android SDK platform android-37.0 and build-tools 36.0.0 first.")
credential_file = SIGNING / "android.json"
keystore = SIGNING / "tool-tracker-release.jks"
if not credential_file.exists():
    if keystore.exists():
        raise SystemExit("Existing keystore has no password record. Restore android.json; do not replace the key.")
    credential_file.write_text(json.dumps({"password": secrets.token_urlsafe(36)}))
    if os.name != "nt":
        credential_file.chmod(0o600)
env = dict(os.environ, TOOL_TRACKER_STORE_PASSWORD=json.loads(credential_file.read_text())["password"])
if not keystore.exists():
    run("keytool", "-genkeypair", "-keystore", keystore, "-alias", "tool-tracker", "-keyalg", "RSA", "-keysize", "3072", "-validity", "10000", "-dname", "CN=Tool Tracker Factory App", "-storepass:env", "TOOL_TRACKER_STORE_PASSWORD", "-keypass:env", "TOOL_TRACKER_STORE_PASSWORD", env=env)
run(TOOLS / "aapt2.exe", "compile", "--dir", ROOT / "res", "-o", BUILD / "resources.zip")
run(TOOLS / "aapt2.exe", "link", "-o", BUILD / "unsigned.apk", "-I", ANDROID, "--manifest", ROOT / "AndroidManifest.xml", BUILD / "resources.zip")
sources = list((ROOT / "src").rglob("*.java"))
run("javac", "-encoding", "UTF-8", "--release", "8", "-classpath", ANDROID, "-d", BUILD / "classes", *sources)
run("java", "-cp", TOOLS / "lib/d8.jar", "com.android.tools.r8.D8", "--lib", ANDROID, "--min-api", "26", "--output", BUILD / "dex", *list((BUILD / "classes").rglob("*.class")))
with zipfile.ZipFile(BUILD / "unsigned.apk", "a", zipfile.ZIP_DEFLATED) as apk:
    for dex in (BUILD / "dex").glob("*.dex"):
        apk.write(dex, dex.name)
run(TOOLS / "zipalign.exe", "-f", "-p", "4", BUILD / "unsigned.apk", BUILD / "aligned.apk")
target = OUT / f"Mould-Tracker-{VERSION_NAME}-android.apk"
run("java", "-jar", TOOLS / "lib/apksigner.jar", "sign", "--ks", keystore, "--ks-key-alias", "tool-tracker", "--ks-pass", "env:TOOL_TRACKER_STORE_PASSWORD", "--key-pass", "env:TOOL_TRACKER_STORE_PASSWORD", "--out", target, BUILD / "aligned.apk", env=env)
run("java", "-jar", TOOLS / "lib/apksigner.jar", "verify", "--verbose", target)
feed = {"versionCode": VERSION_CODE, "versionName": VERSION_NAME, "file": target.name, "sha256": hashlib.sha256(target.read_bytes()).hexdigest()}
(OUT / "android-latest.json").write_text(json.dumps(feed, indent=2) + "\n")
print(f"APK ready: {target}")
