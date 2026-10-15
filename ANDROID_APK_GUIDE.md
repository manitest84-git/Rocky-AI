# Rocky AI - Android APK Guide

The Android APK for **Rocky AI** has been successfully built and packaged with all features and functionality intact.

---

## 📦 APK Details

| Property | Details |
| :--- | :--- |
| **Output File** | [rocky-ai-debug.apk](./rocky-ai-debug.apk) |
| **Android Project Path** | [frontend/android/app/build/outputs/apk/debug/app-debug.apk](./frontend/android/app/build/outputs/apk/debug/app-debug.apk) |
| **File Size** | **~30 MB** |
| **Package ID** | `ai.rocky.assistant` |
| **Target Android SDK** | 34 (Android 14) |
| **Min Android SDK** | 24 (Android 7.0+) |
| **Centerpiece Animation** | `blue_sphere.webm` (bundled inside the APK) |

---

## 🚀 Key Features Preserved

1. **Full Voice & WebRTC Duplex Stream**:
   - `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, and `CAMERA` permissions configured in `AndroidManifest.xml`.
   - Custom `WebChromeClient` in `MainActivity.java` automatically grants WebRTC audio capture inside the WebView.

2. **Unrestricted Network Communication**:
   - `android:usesCleartextTraffic="true"` configured to allow direct connections to host IP addresses over HTTP and WebSocket without SSL certificate blocks.

3. **Dynamic Server Uplink Modal**:
   - In-app endpoint switcher accessible from the HUD navigation drawer.
   - Allows instant one-tap switching between:
     - **Tailscale IP**: `100.125.118.104` (works anywhere in the world when phone is on the same Tailnet)
     - **Local LAN IP**: `192.168.0.111` (works when connected to home Wi-Fi)
     - **Custom Host / Domain**: Any user-defined IP or URL
   - Built-in latency ping test to verify backend reachability before connecting.

4. **All Interactive Drawers & Visuals**:
   - Tasks, Calendar, Financial Shopping, Smart Home, Memory Map, Study Matrix, and Live Integrations.
   - Three.js particle backgrounds and `blue_sphere.webm` centerpiece video.

---

## 📲 How to Install & Use on Android

### Option A: Transfer to Phone
1. Transfer `rocky-ai-debug.apk` to your phone (via USB file transfer, Google Drive, Telegram, LocalSend, or email).
2. Tap the APK file on your Android device to install.
   *(If prompted, allow "Install from Unknown Sources" for your file manager or browser)*.
3. Open **Rocky AI**.
4. Grant the requested Microphone permission when prompted.

### Option B: Install via ADB (if USB debugging is enabled)
```bash
adb install -r rocky-ai-debug.apk
```

---

## 🔗 Connecting the App to your Rocky Backend

1. Ensure the Rocky AI backend services and dev server are running on your host machine.
2. If connecting remotely away from home, ensure your phone is connected to your **Tailscale** network.
3. If connecting at home, make sure your phone is connected to the same **Wi-Fi** (`192.168.0.111`).
4. In the app:
   - Tap the hamburger / menu icon in the HUD.
   - Tap **Server Uplink**.
   - Tap **Tailscale (100.125.118.104)** or **Local LAN (192.168.0.111)**.
   - Tap **Test Latency** to confirm the backend responds.
   - Tap **Save & Apply Connection**.
