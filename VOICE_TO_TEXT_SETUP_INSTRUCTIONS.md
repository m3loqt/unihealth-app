# 🎤 Voice-to-Text Setup Instructions

## **Issue Identified**
The voice-to-text feature is not working because the AssemblyAI API key is not properly configured. The current key in the code is invalid.

## **Quick Fix (5 minutes)**

### **Step 1: Get Your Free AssemblyAI API Key**
1. Go to [https://www.assemblyai.com/](https://www.assemblyai.com/)
2. Click "Get Started" and create a free account
3. Verify your email address
4. Go to your dashboard and copy your API key (starts with `sk-`)
5. **Free tier includes 5 hours of transcription per month**

### **Step 2: Update the Code**
1. Open `src/hooks/useVoiceToText.ts`
2. Find line 30: `const apiKey = 'YOUR_ASSEMBLYAI_API_KEY_HERE';`
3. Replace `YOUR_ASSEMBLYAI_API_KEY_HERE` with your actual API key
4. Example: `const apiKey = 'sk-1234567890abcdef...';`

### **Step 3: Test the Feature**
1. Run your app: `npm run dev`
2. Open on mobile device via Expo Go
3. Go to Patient Consultation screen
4. Tap the microphone icon next to any text field
5. Speak clearly and tap again to stop
6. Your speech should be transcribed into the text field

## **How It Works**

### **Web Platform (Chrome/Safari)**
- ✅ Uses Web Speech API (built into browsers)
- ✅ Real-time transcription as you speak
- ✅ No API key needed
- ✅ Unlimited usage

### **Mobile Platform (iOS/Android)**
- ✅ Uses AssemblyAI API for transcription
- ✅ Records audio using expo-av
- ✅ Uploads to AssemblyAI for processing
- ✅ Returns transcribed text to your app
- ✅ 5 hours free per month

## **Troubleshooting**

### **If you see "AssemblyAI API key not configured" error:**
- Make sure you've replaced the placeholder with your actual API key
- Ensure the key starts with `sk-`
- Check that you've saved the file

### **If you see "Invalid AssemblyAI API key" error:**
- Double-check your API key is correct
- Make sure you copied the full key from AssemblyAI dashboard
- Try generating a new API key if needed

### **If recording starts but no transcript appears:**
- Check your internet connection (AssemblyAI requires internet)
- Speak clearly and loudly
- Ensure you're in a quiet environment
- Check the console logs for detailed error messages

## **Alternative: Use Web Version**
If you don't want to set up AssemblyAI right now, you can test the voice-to-text feature on the web version of your app, which uses the browser's built-in speech recognition and doesn't require any API key.

## **Need Help?**
- AssemblyAI Documentation: [https://docs.assemblyai.com/](https://docs.assemblyai.com/)
- AssemblyAI Support: Available in your dashboard
- Check console logs for detailed error messages
