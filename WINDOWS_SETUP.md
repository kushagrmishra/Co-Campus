# Windows Development Guide for CoCampus

This guide is for team members setting up and developing **CoCampus** on a Windows machine.

---

## 1. Prerequisites

1. **Node.js (LTS v20 or v22)**
   - Download the Windows installer (.msi) from [nodejs.org](https://nodejs.org/).
   - Ensure the option *"Add to PATH"* is checked during installation.
   - Verify in PowerShell:
     ```powershell
     node -v
     npm -v
     ```

2. **Git for Windows**
   - Download from [git-scm.com](https://git-scm.com/).
   - Recommended settings during installation:
     - Default editor: VS Code
     - Line ending conversions: *"Checkout as-is, commit Unix-style line endings"* (our repository's `.gitattributes` will enforce LF automatically).

3. **VS Code (Recommended)**
   - Extensions:
     - **ESLint**
     - **Prettier**
     - **React Native Tools** (optional)

---

## 2. Windows PowerShell Policy (Important)

If running `npx` or `npm` commands in PowerShell gives an error like:
> `File ... cannot be loaded because running scripts is disabled on this system.`

Open **PowerShell** (as administrator or standard user) and run:
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```
Type `Y` to confirm.

---

## 3. Clone & Install Dependencies

Open PowerShell, Windows Terminal, or Git Bash:

```powershell
git clone https://github.com/kushagrmishra/Co-Campus.git
cd Co-Campus
npm install
```

---

## 4. Setup `.env` File

Create a `.env` file in the project root directory:

```env
# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyA9c8pV4kMg-8oxpYQ0bU5PPapaoKBivzk
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=cocampus-f8179.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=cocampus-f8179
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=cocampus-f8179.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=143831216762
EXPO_PUBLIC_FIREBASE_APP_ID=1:143831216762:web:5722fe78daf2b332a441c3

# LLM API Key (Groq / Whisper)
EXPO_PUBLIC_LLM_API_KEY=your_groq_key

# YouTube Data API v3
EXPO_PUBLIC_YOUTUBE_API_KEY=your_youtube_key

# Gemini API Key (Direct Fallback)
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_key

# OpenRouter API Key (Primary Vision & Extraction)
EXPO_PUBLIC_OPENROUTER_API_KEY=your_openrouter_key

# Expo Token (for Cloud EAS Builds)
EXPO_TOKEN=your_expo_token
```

---

## 5. Running the App on Windows

### Option A: On Your Physical Phone via Expo Go (Fastest & Recommended)
1. Install **Expo Go**:
   - [Google Play Store (Android)](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - [Apple App Store (iPhone)](https://apps.apple.com/app/expo-go/id982107779)
2. In PowerShell, run:
   ```powershell
   npm start
   ```
3. Ensure your phone and PC are connected to the **same Wi-Fi network**.
4. Scan the QR code:
   - **Android**: Scan with the Expo Go app.
   - **iPhone**: Scan with the native Camera app, then tap open in Expo Go.

> 💡 **College / Corporate Wi-Fi Note (Network Isolation)**:  
> If your phone cannot connect because your router isolates devices, run:
> ```powershell
> npx expo start --tunnel
> ```
> Tunnel mode routes the connection over secure Cloudflare/ngrok tunnels, allowing your phone to connect regardless of network restrictions.

---

### Option B: On Android Emulator (Windows)
1. Install [Android Studio](https://developer.android.com/studio).
2. During setup, install the **Android SDK Platform-Tools** and **Android Virtual Device (AVD)**.
3. Add Android SDK to your Windows User Environment Variables:
   - Variable: `ANDROID_HOME`
   - Value: `C:\Users\<YourUsername>\AppData\Local\Android\Sdk`
   - Add `%ANDROID_HOME%\platform-tools` to your `Path`.
4. Create an emulator (e.g. Pixel 8 with Android 14) in Android Studio Device Manager and start it.
5. In your project terminal, press `a` (or run `npm run android`).

---

### Option C: In Web Browser
To test the web layout and UI components:
```powershell
npm run web
```
or press `w` in the Expo terminal. The app opens at `http://localhost:8081`.

---

## 6. Building Android APK & iOS IPA on Windows (EAS Cloud)

Because iOS Xcode cannot run natively on Windows, builds are handled via **Expo Application Services (EAS) in the cloud**:

- **Build Android APK (Installable test build)**:
  ```powershell
  npm run build:apk
  ```
- **Build iOS IPA (Ad-Hoc / TestFlight preview)**:
  ```powershell
  npm run build:ipa
  ```
- **Publish Over-The-Air Update (Instantly updates code on users' phones without store re-approval)**:
  ```powershell
  npm run update:ota
  ```

All `package.json` scripts use `dotenv-cli` and work seamlessly across Windows PowerShell, Command Prompt, and macOS.
