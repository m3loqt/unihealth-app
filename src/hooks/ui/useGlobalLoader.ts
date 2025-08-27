import { useState, useCallback } from 'react';

interface UseGlobalLoaderReturn {
  visible: boolean;
  message: string;
  showProgress: boolean;
  progress: number;
  show: (message?: string) => void;
  hide: () => void;
  showWithProgress: (message?: string) => void;
  updateProgress: (progress: number) => void;
  updateMessage: (message: string) => void;
}

export const useGlobalLoader = (): UseGlobalLoaderReturn => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('Loading...');
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);

  const show = useCallback((customMessage?: string) => {
    setMessage(customMessage || 'Loading...');
    setShowProgress(false);
    setProgress(0);
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
    setProgress(0);
  }, []);

  const showWithProgress = useCallback((customMessage?: string) => {
    setMessage(customMessage || 'Loading...');
    setShowProgress(true);
    setProgress(0);
    setVisible(true);
  }, []);

  const updateProgress = useCallback((newProgress: number) => {
    setProgress(Math.max(0, Math.min(1, newProgress))); // Clamp between 0 and 1
  }, []);

  const updateMessage = useCallback((newMessage: string) => {
    setMessage(newMessage);
  }, []);

  return {
    visible,
    message,
    showProgress,
    progress,
    show,
    hide,
    showWithProgress,
    updateProgress,
    updateMessage,
  };
};
