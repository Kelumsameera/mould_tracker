# Tool Tracker: LAN HTTPS and biometric login

App: **[Tool Tracker](https://tools.192.168.0.116.sslip.io:8444)**

Connect each device to the same LAN as the NUC. The hostname resolves to the
private address 192.168.0.116 using [sslip.io DNS](https://nip.io/); it does not
make the app publicly accessible. DNS access is needed to resolve this name.
Keep the NUC at 192.168.0.116. If that address changes, the hostname, certificate,
and passkey configuration need updating; previously enrolled passkeys remain
bound to their original hostname.

Install the **Tool Tracker LAN Root CA** on every device before using the HTTPS
app. Download only the public certificate/profile below; private keys stay on
the NUC. Certificate SHA-256 fingerprint:

```text
19:9D:E9:3B:5F:2E:CF:FC:5F:7B:24:83:49:07:55:3C:C8:3E:9B:64:19:87:74:6A:FB:41:4A:F6:D5:F7:52:A7
```

## Windows

Download [the certificate](http://192.168.0.116:8081/tool-tracker-root-ca.cer).
Double-click it, choose **Install Certificate → Current User → Place all
certificates in the following store → Trusted Root Certification Authorities**,
then Finish. Approve the Windows security confirmation for **Tool Tracker LAN
Root CA**. Close and reopen Chrome/Edge, then open the HTTPS app.

The same operation in PowerShell:

```powershell
Import-Certificate -FilePath .\tool-tracker-root-ca.cer -CertStoreLocation Cert:\CurrentUser\Root
```

This trusts the certificate for the current Windows user. Repeat for other
Windows accounts or PCs. [Microsoft certificate import documentation](https://learn.microsoft.com/en-us/powershell/module/pki/import-certificate).

## Android

Download [the CA certificate](http://192.168.0.116:8081/tool-tracker-root-ca.crt).
In Settings, open **Security & privacy → More security settings → Encryption &
credentials → Install a certificate → CA certificate**, and select the file.
Confirm using the device PIN when prompted. Menu names vary by manufacturer.
Restart Chrome and open the HTTPS app.
[Google's certificate instructions](https://support.google.com/pixelphone/answer/2844832).

## iPhone / iPad

Open [the installation profile](http://192.168.0.116:8081/tool-tracker-lan.mobileconfig)
in Safari and allow the download. In **Settings → General → VPN & Device
Management**, install **Tool Tracker LAN HTTPS**.

Then open **Settings → General → About → Certificate Trust Settings** and enable
full trust for **Tool Tracker LAN Root CA**. Installing the profile alone does
not enable SSL trust. [Apple's trust instructions](https://support.apple.com/en-us/102390).

## Add a passkey

1. Open the HTTPS app without a certificate warning and sign in with your email
   and password. Your HTTP session will not carry over to the new hostname.
2. In the sidebar, open **Passkeys / Biometric login**.
3. Enter your current password and a device name, then choose **Add a passkey**.
4. Complete the device's fingerprint, Face ID, Windows Hello or PIN prompt.
5. Sign out and choose the biometric login button to test your passkey.

Keep password login available for recovery. Passkey enrollment and the final
biometric prompt must be completed by the person using each device.

## Install as an app (PWA)

After trusting the certificate, open the HTTPS app and choose **Install app**
in the sidebar or on the login page. Chrome/Edge on Windows and Android can show
a native install prompt. On iPhone/iPad, open Safari and choose **Share → Add to
Home Screen**. The installed app opens in its own window with the Tool Tracker
icon. It uses the same HTTPS hostname as browser/passkey login.

The PWA has an offline fallback screen and caches public static assets. Tool
data and account/API responses are not cached, and changes require a live LAN
connection. It does not queue tool changes offline.

## Server administration

Coolify service: **Mould Tracker → production → Tool Tracker**.
HTTP port 8081 redirects to HTTPS, except for the public certificate downloads.
HTTPS port 8444 routes through the service's Nginx container.

Backend settings:

```dotenv
WEBAUTHN_ORIGIN=https://tools.192.168.0.116.sslip.io:8444
WEBAUTHN_RP_ID=tools.192.168.0.116.sslip.io
CORS_ORIGIN=https://tools.192.168.0.116.sslip.io:8444
COOKIE_SECURE=true
```

Nginx config: `/home/flexi/apps/tool-tracker/deploy/nginx-lan-https.conf`.
Public certificates: `/home/flexi/apps/tool-tracker/deploy/lan-certificates`.
CA and server private keys: `/data/coolify/certs/tool-tracker`, readable only by
root. Only the server certificate/key are mounted into Nginx, read-only.
The server certificate is valid for one year; renew it using the existing CA
before expiry and redeploy the proxy. Retain the same hostname and CA to keep
existing device trust and passkeys working.
