# 🎤 AssemblyAI Free Speech-to-Text Setup Guide

## **Overview**
AssemblyAI offers a **completely free tier** with 5 hours of transcription per month, perfect for testing and development. This guide will help you set up real voice-to-text functionality for your React Native app.

## **Step 1: Create AssemblyAI Account**

1. **Visit AssemblyAI**: Go to [https://www.assemblyai.com/](https://www.assemblyai.com/)
2. **Sign Up**: Click "Get Started" and create a free account
3. **Verify Email**: Check your email and verify your account
4. **Access Dashboard**: Log in to your AssemblyAI dashboard

## **Step 2: Get Your API Key**

1. **Navigate to API Keys**: In your dashboard, go to "API Keys" section
2. **Copy API Key**: Copy your API key (it starts with something like `sk-...`)
3. **Keep it Secure**: Store this key safely - you'll need it for the app

## **Step 3: Update Your App**

### **Option A: Update the Hook (Recommended)**

Open `src/hooks/useVoiceToText.ts` and replace the placeholder:

```typescript
// Replace this line:
initializeFreeSpeechToText('YOUR_ASSEMBLYAI_API_KEY');

// With your actual API key:
initializeFreeSpeechToText('sk-your-actual-api-key-here');
```

### **Option B: Environment Variable (More Secure)**

1. **Create `.env` file** in your project root:
```env
ASSEMBLYAI_API_KEY=sk-your-actual-api-key-here
```

2. **Install dotenv**:
```bash
npm install react-native-dotenv
```

3. **Update the hook**:
```typescript
import { ASSEMBLYAI_API_KEY } from '@env';

// In useEffect:
initializeFreeSpeechToText(ASSEMBLYAI_API_KEY);
```

## **Step 4: Test the Feature**

1. **Start Expo Go**: Run `npm run dev`
2. **Open on Mobile**: Scan the QR code with Expo Go
3. **Navigate to Patient Consultation**: Go to the consultation screen
4. **Test Voice Input**: Tap the microphone icon and speak
5. **Check Results**: Your speech should appear in the text field

## **How It Works**

### **Web Platform**
- Uses **Web Speech API** (built into browsers)
- **Real-time transcription** as you speak
- **No API key needed** for web

### **Mobile Platform (iOS/Android)**
- Uses **AssemblyAI API** for transcription
- **Records audio** using `expo-av`
- **Uploads to AssemblyAI** for processing
- **Returns transcribed text** to your app

## **Features**

 **Real-time transcription** on web  
 **High-quality transcription** on mobile  
 **5 hours free per month** (AssemblyAI)  
 **No credit card required** for free tier  
 **Works on both iOS and Android**  
 **Automatic punctuation and formatting**  

## **Usage Limits**

- **Web**: Unlimited (uses browser's speech recognition)
- **Mobile**: 5 hours per month (AssemblyAI free tier)
- **File Size**: Up to 1GB per file
- **Languages**: 99+ languages supported

## **Troubleshooting**

### **Common Issues**

1. **"API Key Invalid"**
   - Check your API key is correct
   - Ensure you've copied the full key

2. **"Microphone Permission Denied"**
   - Grant microphone permissions in your device settings
   - Restart the app after granting permissions

3. **"No Speech Detected"**
   - Speak clearly and loudly
   - Ensure you're in a quiet environment
   - Check microphone is working

4. **"Network Error"**
   - Check your internet connection
   - AssemblyAI requires internet for mobile transcription

### **Debug Logs**

The app includes extensive logging. Check your console for:
- `"Mobile Platform - Starting AssemblyAI recording"`
- `"AssemblyAI upload successful"`
- `"AssemblyAI transcription completed"`

## **Upgrading (Optional)**

If you need more than 5 hours per month:
1. **Upgrade AssemblyAI Plan**: Visit your dashboard
2. **Pay-as-you-go**: $0.25 per hour after free tier
3. **Enterprise Plans**: Contact AssemblyAI for custom pricing

## **Alternative Free APIs**

If AssemblyAI doesn't work for you:

1. **Google Cloud Speech-to-Text**: $0.006 per 15 seconds
2. **Azure Speech Services**: 5 hours free per month
3. **AWS Transcribe**: 60 minutes free per month

## **Support**

- **AssemblyAI Docs**: [https://docs.assemblyai.com/](https://docs.assemblyai.com/)
- **AssemblyAI Support**: Available in your dashboard
- **Expo Audio Docs**: [https://docs.expo.dev/versions/latest/sdk/audio/](https://docs.expo.dev/versions/latest/sdk/audio/)

---

**🎉 You're all set!** Your voice-to-text feature should now work with real transcription on both web and mobile platforms. 