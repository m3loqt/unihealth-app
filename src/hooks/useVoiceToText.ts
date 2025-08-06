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
      // Using your AssemblyAI API key
      initializeFreeSpeechToText('61cbee4c74db45528001e951a5ea3b97');
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
          throw new Error('Free speech-to-text service not initialized');
        }

        await freeSpeechToTextService.startRecording();
        setIsRecording(true);
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
      } else if (Platform.OS !== 'web' && freeSpeechToTextService) {
        console.log('Mobile Platform - Stopping AssemblyAI recording');
        const result = await freeSpeechToTextService.stopRecording();
        
        if (result.success && result.text) {
          console.log('Mobile Platform - Final transcription result:', result.text);
          setTranscript(result.text);
        } else {
          console.error('Mobile Platform - Transcription failed:', result.error);
          setError(result.error || 'Transcription failed');
        }
      }
      
      setIsRecording(false);
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