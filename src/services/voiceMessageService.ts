import { Audio } from 'expo-av';
import { supabase } from '@/config/supabase';
import { databaseService } from '@/services/database/firebase';

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

  async stopRecording(): Promise<{ uri: string; duration: number; waveform?: number[] }> {
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

      const duration = status.durationMillis ? status.durationMillis / 1000 : 0; // Convert to seconds
      
      // Generate waveform data based on duration
      const waveform = this.generateWaveform(duration);
      
      console.log('Voice recording stopped:', { uri, duration, waveformLength: waveform.length });
      
      return { uri, duration, waveform };
    } catch (error) {
      console.error('Error stopping recording:', error);
      throw error;
    } finally {
      this.recording = null;
    }
  }

  private generateWaveform(duration: number): number[] {
    // Generate a realistic waveform based on duration
    // More bars for longer recordings, fewer for shorter ones
    const barCount = Math.max(10, Math.min(30, Math.floor(duration * 2)));
    const waveform: number[] = [];
    
    for (let i = 0; i < barCount; i++) {
      // Create a more realistic waveform pattern
      // Higher bars in the middle, lower at the ends
      const progress = i / (barCount - 1);
      const centerPeak = Math.sin(progress * Math.PI); // Peak in the middle
      const randomVariation = (Math.random() - 0.5) * 0.4; // Add some randomness
      const baseHeight = 0.3 + centerPeak * 0.4 + randomVariation;
      
      // Ensure minimum height and cap maximum
      const height = Math.max(0.1, Math.min(1, baseHeight));
      waveform.push(height);
    }
    
    return waveform;
  }

  async uploadVoiceMessage(uri: string, threadId: string, messageId: string, userId: string): Promise<string> {
    try {
      console.log('Starting voice message upload...', { uri, threadId, messageId, userId });
      
      // Try Supabase upload first with a different approach
      try {
        const fileName = `${userId}/${threadId}/${messageId}.m4a`;
        console.log('Attempting Supabase upload with file:', fileName);
        
        // Convert to base64 for Supabase (this works better with Expo Go)
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        
        console.log('Converted to base64, size:', base64.length);
        
        // Try uploading as base64 string to a custom endpoint or use a different method
        // For now, let's store the base64 data in Firebase and use Supabase for metadata
        const { data, error } = await supabase.storage
          .from('voice-messages')
          .upload(fileName, new Blob([arrayBuffer], { type: 'audio/m4a' }), {
            contentType: 'audio/m4a',
            upsert: false,
          });

        if (error) {
          console.log('Supabase upload failed, using fallback:', error.message);
          throw error;
        }

        const { data: urlData } = supabase.storage
          .from('voice-messages')
          .getPublicUrl(fileName);

        console.log('Supabase upload successful:', urlData.publicUrl);
        return urlData.publicUrl;
        
      } catch (supabaseError) {
        console.log('Supabase upload failed, using Firebase fallback:', supabaseError);
        
        // Fallback: Store base64 data in Firebase Realtime Database
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        
        const voiceMessageData = {
          audioData: base64,
          threadId: threadId,
          messageId: messageId,
          userId: userId,
          timestamp: Date.now(),
          type: 'voice_message',
          mimeType: 'audio/m4a'
        };
        
        // Store in Firebase Realtime Database
        await databaseService.setData(`voiceMessages/${messageId}`, voiceMessageData);
        console.log('Voice message stored in Firebase as base64');
        
        // Return a special Firebase URL
        return `firebase://voiceMessages/${messageId}`;
      }
      
    } catch (error) {
      console.error('Error uploading voice message:', error);
      // Final fallback to local URI
      console.log('Using local URI as final fallback');
      return uri;
    }
  }

  async playVoiceMessage(audioUrl: string): Promise<Audio.Sound> {
    try {
      let playUri = audioUrl;
      
      // Handle Firebase URLs
      if (audioUrl.startsWith('firebase://voiceMessages/')) {
        const messageId = audioUrl.replace('firebase://voiceMessages/', '');
        console.log('Loading voice message from Firebase:', messageId);
        
        try {
          const voiceData = await databaseService.getData(`voiceMessages/${messageId}`);
          if (voiceData && voiceData.audioData) {
            // Convert base64 back to blob URL
            const binaryString = atob(voiceData.audioData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: voiceData.mimeType || 'audio/m4a' });
            playUri = URL.createObjectURL(blob);
            console.log('Created blob URL for Firebase voice message');
          } else {
            throw new Error('Voice message data not found in Firebase');
          }
        } catch (firebaseError) {
          console.error('Failed to load voice message from Firebase:', firebaseError);
          throw new Error('Failed to load voice message');
        }
      }
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: playUri },
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
