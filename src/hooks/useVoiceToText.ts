import { useState, useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { freeSpeechToTextService, initializeFreeSpeechToText } from '../services/freeSpeechToText';

interface UseVoiceToTextReturn {
  isRecording: boolean;
  transcript: string;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  resetTranscript: () => void;
  setActiveField: (field: string) => void;
  activeField: string | null;
}

export const useVoiceToText = (): UseVoiceToTextReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Initialize free speech-to-text service for mobile
    if (Platform.OS !== 'web') {
      // AssemblyAI API key configured
      const apiKey = 'cd0a65c1fcc247f885f379ee354ef1c0';
      
      console.log('🎤 Initializing AssemblyAI voice-to-text service...');
      initializeFreeSpeechToText(apiKey);
    }

    return () => {
      cleanupVoice();
    };
  }, []);

  const cleanupVoice = async () => {
    if (Platform.OS === 'web' && recognitionRef.current) {
      recognitionRef.current.abort();
    } else if (Platform.OS !== 'web' && freeSpeechToTextService) {
      await freeSpeechToTextService.cleanup();
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      setTranscript('');
      setIsRecording(true); // optimistically set to prevent double-tap race

      if (Platform.OS === 'web') {
        // Web Speech API for web platform
        console.log('Web Platform - Starting Web Speech API recording');
        
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
          throw new Error('Speech recognition not supported in this browser');
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onstart = () => {
          console.log('Web Platform - Recording started');
          setIsRecording(true);
        };

        recognitionRef.current.onresult = (event: any) => {
          let finalTranscript = '';
          let interimTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          const newTranscript = finalTranscript + interimTranscript;
          console.log('Web Platform - Transcript updated:', newTranscript);
          setTranscript(newTranscript);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Web Platform - Speech recognition error:', event.error);
          setError(`Speech recognition error: ${event.error}`);
          setIsRecording(false);
        };

        recognitionRef.current.onend = () => {
          console.log('Web Platform - Recording ended');
          setIsRecording(false);
        };

        recognitionRef.current.start();
      } else {
        // AssemblyAI for mobile platforms
        console.log('Mobile Platform - Starting AssemblyAI recording');
        
        if (!freeSpeechToTextService) {
          throw new Error('Voice-to-text service not initialized. Please try again.');
        }

        await freeSpeechToTextService.startRecording();
      }
    } catch (error) {
      console.error('Start recording error:', error);
      setError(error instanceof Error ? error.message : 'Failed to start recording');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      if (Platform.OS === 'web' && recognitionRef.current) {
        console.log('Web Platform - Stopping Web Speech API recording');
        recognitionRef.current.stop();
        setIsRecording(false);
      } else if (Platform.OS !== 'web' && freeSpeechToTextService) {
        console.log('Mobile Platform - Stopping AssemblyAI recording');
        // Guard: avoid calling stop if service is not currently recording
        if (!freeSpeechToTextService.isCurrentlyRecording()) {
          console.log('Mobile Platform - stopRecording called but no active recording; ignoring');
          setIsRecording(false);
          return;
        }
        
        setIsRecording(false); // Set recording to false immediately
        const result = await freeSpeechToTextService.stopRecording();
        
        if (result.success && result.text) {
          console.log('Mobile Platform - Final transcription result:', result.text);
          setTranscript(result.text);
        } else {
          console.error('Mobile Platform - Transcription failed:', result.error);
          // Do not surface the benign 'No recording in progress' to the UI
          if (result.error && result.error !== 'No recording in progress') {
            setError(result.error);
          }
        }
      } else {
        setIsRecording(false);
      }
    } catch (error) {
      console.error('Stop recording error:', error);
      setError(error instanceof Error ? error.message : 'Failed to stop recording');
      setIsRecording(false);
    }
  };

  const resetTranscript = () => {
    setTranscript('');
    setError(null);
  };

  return {
    isRecording,
    transcript,
    error,
    startRecording,
    stopRecording,
    resetTranscript,
    setActiveField,
    activeField,
  };
}; 