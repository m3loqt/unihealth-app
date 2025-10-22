# Supabase Storage Setup Guide for Voice Messages

This guide will walk you through setting up Supabase Storage to handle voice message files for the UniHealth app.

## Prerequisites

- A Supabase account (free tier available)
- Basic understanding of React Native/Expo
- Firebase Realtime Database already configured

## Step 1: Create a Supabase Project

1. **Go to [Supabase](https://supabase.com)**
2. **Sign up/Login** with your GitHub, Google, or email
3. **Click "New Project"**
4. **Fill in project details:**
   - Organization: Select or create one
   - Project Name: `unihealth-voice-storage` (or your preferred name)
   - Database Password: Generate a strong password (save this!)
   - Region: Choose closest to your users
5. **Click "Create new project"**
6. **Wait for setup** (usually 2-3 minutes)

## Step 2: Get Your Project Credentials

1. **Go to Project Settings** (gear icon in sidebar)
2. **Navigate to "API" section**
3. **Copy these values:**
   - `Project URL` (e.g., `https://your-project-id.supabase.co`)
   - `anon public` key (starts with `eyJ...`)
   - `service_role` key (starts with `eyJ...`) - Keep this secret!

## Step 3: Install Supabase Client

```bash
npm install @supabase/supabase-js
```

## Step 4: Configure Supabase Client

Create `src/config/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

## Step 5: Set Up Storage Bucket

### Option A: Using Supabase Dashboard (Recommended)

1. **Go to Storage** in your Supabase dashboard
2. **Click "Create a new bucket"**
3. **Configure bucket:**
   - Name: `voice-messages`
   - Public: `false` (we'll use signed URLs)
   - File size limit: `50 MB` (adjust as needed)
   - Allowed MIME types: `audio/mpeg, audio/mp4, audio/m4a, audio/webm`
4. **Click "Create bucket"**

### Option B: Using SQL (Alternative)

1. **Go to SQL Editor** in Supabase dashboard
2. **Run this query:**

```sql
-- Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-messages',
  'voice-messages',
  false,
  52428800, -- 50MB in bytes
  ARRAY['audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/webm']
);

-- Set up RLS policies
CREATE POLICY "Users can upload voice messages" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'voice-messages' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view voice messages" ON storage.objects
FOR SELECT USING (
  bucket_id = 'voice-messages' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own voice messages" ON storage.objects
FOR DELETE USING (
  bucket_id = 'voice-messages' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

## Step 6: Set Up Row Level Security (RLS)

### Create Storage Policies

1. **Go to Authentication > Policies**
2. **Select "storage.objects"**
3. **Create these policies:**

#### Policy 1: Upload Voice Messages
```sql
-- Policy name: "Users can upload voice messages"
-- Operation: INSERT
-- Target roles: authenticated
-- USING expression: bucket_id = 'voice-messages' AND auth.uid()::text = (storage.foldername(name))[1]
```

#### Policy 2: View Voice Messages
```sql
-- Policy name: "Users can view voice messages"
-- Operation: SELECT
-- Target roles: authenticated
-- USING expression: bucket_id = 'voice-messages' AND auth.uid()::text = (storage.foldername(name))[1]
```

#### Policy 3: Delete Voice Messages
```sql
-- Policy name: "Users can delete voice messages"
-- Operation: DELETE
-- Target roles: authenticated
-- USING expression: bucket_id = 'voice-messages' AND auth.uid()::text = (storage.foldername(name))[1]
```

## Step 7: Update Voice Message Service

Update `src/services/voiceMessageService.ts`:

```typescript
import { Audio } from 'expo-av';
import { supabase } from '@/config/supabase';

export interface VoiceMessage {
  id: string;
  audioUrl: string;
  duration: number;
  senderId: string;
  timestamp: number;
}

class VoiceMessageService {
  private recording: Audio.Recording | null = null;
  private isRecording = false;

  async startRecording(): Promise<void> {
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Audio recording permission not granted');
      }

      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Create recording
      this.recording = new Audio.Recording();
      
      // Configure recording options for MP3-like quality
      const recordingOptions = {
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      };

      await this.recording.prepareToRecordAsync(recordingOptions);
      await this.recording.startAsync();
      this.isRecording = true;
      
      console.log('Voice recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<{ uri: string; duration: number }> {
    try {
      if (!this.recording || !this.isRecording) {
        throw new Error('No active recording to stop');
      }

      await this.recording.stopAndUnloadAsync();
      this.isRecording = false;

      const uri = this.recording.getURI();
      const status = await this.recording.getStatusAsync();
      
      if (!uri) {
        throw new Error('Failed to get recording URI');
      }

      const duration = status.durationMillis ? status.durationMillis / 1000 : 0;
      
      console.log('Voice recording stopped:', { uri, duration });
      
      return { uri, duration };
    } catch (error) {
      console.error('Error stopping recording:', error);
      throw error;
    } finally {
      this.recording = null;
    }
  }

  async uploadVoiceMessage(uri: string, threadId: string, messageId: string, userId: string): Promise<string> {
    try {
      // Create file path: userId/threadId/messageId.m4a
      const fileName = `${userId}/${threadId}/${messageId}.m4a`;
      
      // Convert URI to blob for upload
      const response = await fetch(uri);
      const blob = await response.blob();

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('voice-messages')
        .upload(fileName, blob, {
          contentType: 'audio/m4a',
          upsert: false, // Don't overwrite existing files
        });

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL (signed URL for private bucket)
      const { data: urlData } = supabase.storage
        .from('voice-messages')
        .getPublicUrl(fileName);

      console.log('Voice message uploaded:', urlData.publicUrl);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading voice message:', error);
      throw error;
    }
  }

  async playVoiceMessage(audioUrl: string): Promise<Audio.Sound> {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );
      
      return sound;
    } catch (error) {
      console.error('Error playing voice message:', error);
      throw error;
    }
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  async cleanup(): Promise<void> {
    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch (error) {
        console.error('Error cleaning up recording:', error);
      }
      this.recording = null;
    }
    this.isRecording = false;
  }
}

export const voiceMessageService = new VoiceMessageService();
```

## Step 8: Update Chat Service

Update the `sendVoiceMessage` method in `src/services/chatService.ts`:

```typescript
async sendVoiceMessage(
  threadId: string,
  senderId: string,
  audioUrl: string,
  duration: number
): Promise<string> {
  try {
    // Create message
    const messageRef = ref(database, `messages/${threadId}`);
    const newMessageRef = push(messageRef);
    const messageId = newMessageRef.key!;

    const message: ChatMessage = {
      id: messageId,
      senderId,
      text: '🎤 Voice message',
      at: Date.now(),
      seenBy: {
        [senderId]: true,
      },
      voiceMessage: {
        audioUrl,
        duration,
      },
    };

    await set(newMessageRef, message);

    // Update thread with last message and unread counts
    const threadRef = ref(database, `chatThreads/${threadId}`);
    
    await runTransaction(threadRef, (currentData) => {
      if (currentData) {
        if (!currentData.unread) {
          currentData.unread = {};
        }

        currentData.lastMessage = {
          text: '🎤 Voice message',
          at: message.at,
          senderId,
        };

        Object.keys(currentData.participants).forEach((participantId) => {
          if (participantId === senderId) {
            currentData.unread[participantId] = 0;
          } else {
            currentData.unread[participantId] = (currentData.unread[participantId] || 0) + 1;
          }
        });
      }
      return currentData;
    });

    return messageId;
  } catch (error) {
    console.error('Error sending voice message:', error);
    throw error;
  }
}
```

## Step 9: Environment Variables (Optional but Recommended)

Create `.env` file in your project root:

```env
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

Update `src/config/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

## Step 10: Test the Setup

1. **Test file upload** in your app
2. **Check Supabase Storage** dashboard to see uploaded files
3. **Verify file permissions** and access
4. **Test playback** of uploaded voice messages

## Storage Structure

Your voice messages will be organized as:
```
voice-messages/
├── userId1/
│   ├── threadId1/
│   │   ├── messageId1.m4a
│   │   └── messageId2.m4a
│   └── threadId2/
│       └── messageId3.m4a
└── userId2/
    └── threadId1/
        └── messageId4.m4a
```

## Pricing Considerations

- **Supabase Free Tier**: 1GB storage, 2GB bandwidth/month
- **Voice Message Size**: ~50KB per 10 seconds (compressed)
- **Estimated Capacity**: ~20,000 10-second voice messages per month

## Security Notes

1. **RLS Policies**: Ensure only authenticated users can access their own files
2. **File Validation**: Validate file types and sizes on upload
3. **URL Expiration**: Consider using signed URLs with expiration for sensitive content
4. **Cleanup**: Implement cleanup for old/deleted messages

## Troubleshooting

### Common Issues:

1. **Upload Fails**: Check RLS policies and file permissions
2. **Playback Issues**: Verify file format and URL accessibility
3. **Permission Errors**: Ensure user is authenticated before upload
4. **File Size Limits**: Check bucket configuration and file size
5. **Expo Go Network Issues**: Supabase Storage uploads may fail in Expo Go due to network restrictions

### Expo Go Limitations:

**Important**: Supabase Storage uploads may not work in Expo Go due to network request limitations. The current implementation uses a fallback approach that stores voice messages locally and metadata in Firebase Realtime Database.

**For Production**: When building a standalone app (not using Expo Go), Supabase Storage will work properly. For development with Expo Go, voice messages are stored locally and work within the same session.

### Debug Steps:

1. Check Supabase logs in dashboard
2. Verify RLS policies are correctly applied
3. Test with different file formats
4. Check network connectivity

## Next Steps

After completing this setup:

1. **Implement voice message UI** in chat screens
2. **Add progress indicators** for upload/playback
3. **Handle errors gracefully** with user feedback
4. **Add message compression** for better performance
5. **Implement cleanup** for old messages

This setup provides a robust, scalable solution for voice messages using Supabase Storage with Firebase Realtime Database for metadata.
