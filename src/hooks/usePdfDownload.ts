import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { loadLogoDataUri, downloadPdf } from '../utils/pdfTemplate';

export const usePdfDownload = () => {
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [downloadSavedPath, setDownloadSavedPath] = useState<string | null>(null);
  const [logoDataUri, setLogoDataUri] = useState<string>('');

  // Load logo for watermark
  useEffect(() => {
    (async () => {
      const logoUri = await loadLogoDataUri();
      setLogoDataUri(logoUri);
    })();
  }, []);

  const handleDownload = async (html: string, filename: string) => {
    await downloadPdf(html, filename, setDownloadSavedPath, setDownloadModalVisible);
  };

  return {
    downloadModalVisible,
    setDownloadModalVisible,
    downloadSavedPath,
    logoDataUri,
    handleDownload,
  };
};
