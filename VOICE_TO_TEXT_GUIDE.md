# Voice-to-Text Feature Implementation Guide

## Overview
The voice-to-text feature has been implemented in the patient consultation screen to allow doctors to dictate their notes using voice recognition. This feature works across all platforms (Web, iOS, and Android) using different APIs for each platform.

## Implementation Details

### Platforms Supported
- **Web**: Uses the Web Speech API (`webkitSpeechRecognition` or `SpeechRecognition`)
- **iOS/Android**: Uses `@react-native-voice/voice` library with Expo AV for permissions

### Key Components

#### 1. Custom Hook: `useVoiceToText`
Location: `src/hooks/useVoiceToText.ts`

This hook provides a unified interface for voice recognition across all platforms:

```typescript
const {
  isRecording,        // Boolean indicating if recording is active
  isAvailable,        // Boolean indicating if voice recognition is available
  error,             // Error message if any
  startRecording,    // Function to start recording
  stopRecording,     // Function to stop recording
  transcript,        // Current transcript text
  resetTranscript,   // Function to reset transcript
} = useVoiceToText();
```

#### 2. Integration in Patient Consultation Screen
Location: `app/(patient)/patient-consultation.tsx`

The voice-to-text feature is integrated into the form fields with microphone buttons that:
- Show recording state with pulsing animation
- Display availability status
- Handle errors gracefully
- Automatically append transcript to form fields

### Usage Instructions

#### For Users (Doctors):
1. **Start Recording**: Tap the microphone icon next to any text field
2. **Speak Clearly**: Dictate your notes while the microphone is pulsing
3. **Stop Recording**: Tap the microphone again or wait for automatic stop
4. **Review**: The transcribed text will be automatically added to the field

#### For Developers:
1. **Import the hook**:
   ```typescript
   import { useVoiceToText } from '../../src/hooks/useVoiceToText';
   ```

2. **Use in component**:
   ```typescript
   const {
     isRecording,
     isAvailable,
     error,
     startRecording,
     stopRecording,
     transcript,
   } = useVoiceToText();
   ```

3. **Handle transcript updates**:
   ```typescript
   useEffect(() => {
     if (transcript && activeField) {
       // Update form field with transcript
       setFormData(prev => ({
         ...prev,
         [activeField]: prev[activeField] + ' ' + transcript
       }));
     }
   }, [transcript, activeField]);
   ```

### Permissions Required

#### iOS
- Microphone permission
- Speech recognition permission

#### Android
- Microphone permission
- Internet permission (for speech recognition service)

#### Web
- Microphone access (browser will prompt user)

### Error Handling

The implementation includes comprehensive error handling for:
- Permission denials
- Network errors
- No speech detected
- Service unavailability
- Platform-specific issues

### Configuration

#### app.json
The voice plugin is configured in `app.json`:
```json
{
  "plugins": [
    [
      "@react-native-voice/voice",
      {
        "microphonePermission": "Allow $(PRODUCT_NAME) to access your microphone for voice recognition.",
        "speechRecognitionPermission": "Allow $(PRODUCT_NAME) to access speech recognition."
      }
    ]
  ]
}
```

### Dependencies

Required packages:
- `@react-native-voice/voice`: For native voice recognition
- `expo-av`: For audio permissions
- `expo-speech`: For text-to-speech (optional)

### Testing

#### Web Testing
1. Open the app in a modern browser (Chrome, Firefox, Safari)
2. Allow microphone access when prompted
3. Test voice recognition in different fields

#### Mobile Testing
1. Build and run on iOS/Android device or simulator
2. Grant microphone and speech recognition permissions
3. Test voice recognition functionality

### Troubleshooting

#### Common Issues:
1. **"Voice recognition not available"**
   - Check if running on supported platform
   - Verify permissions are granted
   - Ensure internet connection (for mobile)

2. **"No speech detected"**
   - Speak more clearly and loudly
   - Check microphone is working
   - Try in quieter environment

3. **Permission errors**
   - Go to device settings and grant microphone access
   - Restart the app after granting permissions

### Future Enhancements

Potential improvements:
- Support for multiple languages
- Continuous recording mode
- Voice commands for navigation
- Offline voice recognition
- Custom vocabulary for medical terms
- Voice feedback for confirmation

## Technical Notes

- The implementation uses different APIs for web vs native platforms
- Error handling is platform-specific
- The hook automatically cleans up resources on unmount
- Transcripts are automatically appended to existing field content
- Recording state is managed with visual feedback (pulsing animation) 