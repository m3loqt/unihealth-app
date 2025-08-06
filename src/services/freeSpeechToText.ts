import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

interface SpeechToTextResult {
  success: boolean;
  text?: string;
  error?: string;
}

export class FreeSpeechToTextService {
  private recording: Audio.Recording | null = null;
  private isRecording = false;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async startRecording(): Promise<void> {
    try {
      console.log('Free Speech-to-Text: Starting recording...');
      
      // Request permissions
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new Error('Microphone permission not granted');
      }

      // Configure audio
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      this.recording = recording;
      this.isRecording = true;
      console.log('Free Speech-to-Text: Recording started');
    } catch (error) {
      console.error('Free Speech-to-Text: Start recording error:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<SpeechToTextResult> {
    try {
      console.log('Free Speech-to-Text: Stopping recording...');
      
      if (!this.recording) {
        return { success: false, error: 'No recording in progress' };
      }

      // Stop recording
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;
      this.isRecording = false;

      if (!uri) {
        return { success: false, error: 'Failed to get recording URI' };
      }

      console.log('Free Speech-to-Text: Recording stopped, transcribing...');
      
      // Transcribe using AssemblyAI
      const result = await this.transcribeWithAssemblyAI(uri);
      
      // Clean up the audio file
      try {
        await FileSystem.deleteAsync(uri);
      } catch (cleanupError) {
        console.warn('Free Speech-to-Text: Failed to cleanup audio file:', cleanupError);
      }

      return result;
    } catch (error) {
      console.error('Free Speech-to-Text: Stop recording error:', error);
      this.isRecording = false;
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to stop recording' 
      };
    }
  }

  private async transcribeWithAssemblyAI(audioUri: string): Promise<SpeechToTextResult> {
    try {
      console.log('Free Speech-to-Text: Using AssemblyAI for transcription...');
      
      // Read audio file as base64
      const audioData = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to binary for upload
      const binaryData = atob(audioData);
      const bytes = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        bytes[i] = binaryData.charCodeAt(i);
      }

      // Upload to AssemblyAI
      const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/octet-stream',
        },
        body: bytes,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('AssemblyAI upload response:', uploadResponse.status, errorText);
        throw new Error(`AssemblyAI upload error: ${uploadResponse.status} - ${errorText}`);
      }

      const uploadData = await uploadResponse.json();
      console.log('AssemblyAI upload successful:', uploadData.upload_url);

      // Submit transcription request
      const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio_url: uploadData.upload_url,
          language_code: 'en',
          punctuate: true,
          format_text: true,
        }),
      });

      if (!transcriptResponse.ok) {
        const errorText = await transcriptResponse.text();
        console.error('AssemblyAI transcript response:', transcriptResponse.status, errorText);
        throw new Error(`AssemblyAI transcript error: ${transcriptResponse.status} - ${errorText}`);
      }

      const transcriptData = await transcriptResponse.json();
      console.log('AssemblyAI transcript submitted:', transcriptData.id);

      // Poll for completion
      const transcriptId = transcriptData.id;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max wait

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
          headers: {
            'Authorization': this.apiKey,
          },
        });

        if (!statusResponse.ok) {
          throw new Error(`AssemblyAI status check error: ${statusResponse.status}`);
        }

        const statusData = await statusResponse.json();
        console.log('AssemblyAI status:', statusData.status);

        if (statusData.status === 'completed') {
          console.log('AssemblyAI transcription completed:', statusData.text);
          return { success: true, text: statusData.text };
        } else if (statusData.status === 'error') {
          throw new Error(`AssemblyAI transcription error: ${statusData.error}`);
        }

        attempts++;
      }

      throw new Error('AssemblyAI transcription timeout');
    } catch (error) {
      console.error('AssemblyAI transcription error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'AssemblyAI transcription failed' 
      };
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
        console.warn('Free Speech-to-Text: Cleanup error:', error);
      }
      this.recording = null;
    }
    this.isRecording = false;
  }
}

export let freeSpeechToTextService: FreeSpeechToTextService | null = null;
export const initializeFreeSpeechToText = (apiKey: string) => {
  freeSpeechToTextService = new FreeSpeechToTextService(apiKey);
  return freeSpeechToTextService;
}; 