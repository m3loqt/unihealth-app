# 📱 Native Setup Guide - Running with Native Dependencies

## **🎯 Overview**

Your project has been successfully prebuilt and is now ready to run with native dependencies! This means you can use `@react-native-voice/voice` and other native libraries directly on your device.

## ** What's Been Done**

1.  **Project prebuilt** with `npx expo prebuild`
2.  **Android native code** generated
3.  **Native voice library** installed (`@react-native-voice/voice`)
4.  **Autolinking** configured
5.  **Scripts updated** for native builds

## **🚀 Running Your App**

### **Option 1: Using Expo CLI (Recommended for Development)**

```bash
# Start the development server
npm run dev

# Run on Android device/emulator
npm run android

# Run on iOS device/simulator
npm run ios
```

### **Option 2: Using React Native CLI (Direct Native)**

```bash
# Start Metro bundler
npm run metro

# Run on Android device/emulator
npm run android-native

# Run on iOS device/simulator
npm run ios-native
```

## **📱 Device Setup**

### **Android Setup:**

1. **Enable Developer Options:**
   - Settings → About Phone → Tap "Build Number" 7 times
   - Go back to Settings → Developer Options

2. **Enable USB Debugging:**
   - Settings → Developer Options → USB Debugging (ON)
   - Settings → Developer Options → Install via USB (ON)

3. **Connect Your Device:**
   - Connect via USB cable
   - Allow USB debugging when prompted
   - Or use ADB over WiFi

### **iOS Setup (Mac Required):**

1. **Install Xcode** from Mac App Store
2. **Connect iPhone** via USB
3. **Trust Developer Certificate:**
   - Settings → General → Device Management
   - Trust your developer certificate

## **🔧 Development Workflow**

### **For Android:**

```bash
# 1. Start Metro bundler
npm run metro

# 2. In another terminal, run on device
npm run android-native

# 3. Or use Expo CLI (easier)
npm run android
```

### **For iOS:**

```bash
# 1. Start Metro bundler
npm run metro

# 2. In another terminal, run on device
npm run ios-native

# 3. Or use Expo CLI (easier)
npm run ios
```

## **🎤 Voice-to-Text Features**

### **What You Get:**
-  **Real-time voice recognition** on device
-  **No API costs** for basic transcription
-  **Works offline**
-  **Better performance**
-  **Privacy** (voice stays on device)

### **How It Works:**
1. **Click microphone** → Start recording
2. **Speak clearly** → Real-time transcription
3. **Click microphone again** → Stop recording
4. **See your speech** → Transcribed in the field

### **Expected Logs:**
```
Native Platform - Starting native voice recording
Native Voice: Recording started
Native Platform - Real-time transcript: Hello world
Native Platform - Stopping native voice recording
Native Platform - Final transcription result: Hello world
```

## **🛠️ Troubleshooting**

### **Common Issues:**

1. **"Metro bundler not found"**
   ```bash
   npm install -g @react-native-community/cli
   npm run metro
   ```

2. **"Device not found"**
   - Check USB connection
   - Enable USB debugging
   - Run `adb devices` to verify

3. **"Build failed"**
   ```bash
   # Clean and rebuild
   npm run clean
   npm run android-native
   ```

4. **"Voice library not working"**
   - Check permissions in app
   - Verify microphone access
   - Check console logs for errors

### **Debug Commands:**

```bash
# Check connected devices
adb devices

# View logs
adb logcat

# Clean build
npm run clean

# Reset Metro cache
npx react-native start --reset-cache
```

## **📦 Building for Production**

### **Android APK:**
```bash
# Build release APK
npm run build:android

# APK will be in: android/app/build/outputs/apk/release/
```

### **iOS Archive:**
```bash
# Build iOS archive (Mac only)
npm run build:ios

# Archive will be in: ios/build/
```

## **🔒 Permissions**

### **Android Permissions (auto-configured):**
- `RECORD_AUDIO` - For voice recording
- `MICROPHONE` - For microphone access

### **iOS Permissions (auto-configured):**
- `NSMicrophoneUsageDescription` - Microphone access
- `NSSpeechRecognitionUsageDescription` - Speech recognition

## **🎯 Next Steps**

1. **Test on your device:**
   ```bash
   npm run android  # or npm run ios
   ```

2. **Try voice-to-text:**
   - Go to patient consultation screen
   - Click microphone icon
   - Speak clearly
   - See real-time transcription

3. **Build for production:**
   ```bash
   npm run build:android  # or npm run build:ios
   ```

## **💡 Tips**

- **Use Expo CLI** (`npm run android/ios`) for easier development
- **Use React Native CLI** (`npm run android-native/ios-native`) for full native control
- **Check console logs** for debugging voice recognition
- **Test on real device** for best voice recognition results
- **Speak clearly** for better transcription accuracy

## **🚀 Quick Start**

```bash
# 1. Start development server
npm run dev

# 2. Run on your device
npm run android  # or npm run ios

# 3. Test voice-to-text in patient consultation screen
```

**You now have native voice recognition working directly on your device!** 🎤📱✨ 