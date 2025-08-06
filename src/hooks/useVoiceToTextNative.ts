import { useState, useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import { Audio } from 'expo-av';

interface UseVoiceToTextNativeReturn {
  isRecording: boolean;
  isAvailable: boolean;
  error: string | null;
  startRecording: (fieldName: string) => Promise<void>;
  stopRecording: () => Promise<void>;
  transcript: string;
  resetTranscript: () => void;
}

export const useVoiceToTextNative = (): UseVoiceToTextNativeReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [activeField, setActiveField] = useState<string | null>(null);
  
  const recordingRef = useRef<Audio.Recording | null>(null);
  const isComponentMounted = useRef(true);

  useEffect(() => {
    isComponentMounted.current = true;
    initializeAudio();
    
    return () => {
      isComponentMounted.current = false;
      cleanupAudio();
    };
  }, []);

  const initializeAudio = async () => {
    try {
      // Request microphone permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setIsAvailable(false);
        setError('Microphone permission denied');
        return;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      setIsAvailable(true);
      setError(null);
    } catch (audioError) {
      console.error('Audio initialization error:', audioError);
      setIsAvailable(false);
      setError('Failed to initialize audio recording');
    }
  };

  const cleanupAudio = async () => {
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
    } catch (error) {
      console.error('Audio cleanup error:', error);
    }
  };

  const startRecording = async (fieldName: string) => {
    if (!isAvailable) {
      Alert.alert(
        'Voice Recording Unavailable', 
        error || 'Voice recording is not available on this device.'
      );
      return;
    }

    if (isRecording) {
      await stopRecording();
      return;
    }

    try {
      if (!isComponentMounted.current) return;
      
      setActiveField(fieldName);
      setTranscript('');
      setError(null);
      
      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      recordingRef.current = recording;
      setIsRecording(true);
      
      // For demo purposes, we'll simulate transcription after 3 seconds
      setTimeout(() => {
        if (isComponentMounted.current && isRecording) {
          // This is a placeholder - in a real app, you'd send the audio to a speech-to-text service
          setTranscript("This is a demo transcription. In the full app, this would be the actual transcribed text from your voice recording.");
          stopRecording();
        }
      }, 3000);
      
    } catch (error) {
      console.error('Start recording error:', error);
      
      if (isComponentMounted.current) {
        setIsRecording(false);
        setActiveField(null);
        setError('Failed to start voice recording. Please try again.');
      }
    }
  };

  const stopRecording = async () => {
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
    } catch (error) {
      console.error('Stop recording error:', error);
    } finally {
      if (isComponentMounted.current) {
        setIsRecording(false);
        setActiveField(null);
      }
    }
  };

  const resetTranscript = () => {
    setTranscript('');
  };

  return {
    isRecording,
    isAvailable,
    error,
    startRecording,
    stopRecording,
    transcript,
    resetTranscript,
  };
}; 