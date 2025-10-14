import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Check, RotateCcw, Trash2 } from 'lucide-react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import { databaseService } from '@/services/database/firebase';
import { useAuth } from '@/hooks/auth/useAuth';
import { useSignaturePage } from '@/hooks/ui/useSignatureManager';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SignaturePage() {
  const params = useLocalSearchParams();
  const { certificateData, consultationId, referralId, patientId, fromSpecialist } = params;
  
  const signatureRef = useRef<any>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentSessionSignature, setCurrentSessionSignature] = useState<string | null>(null);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  // Use the new signature management hook
  const {
    signature,
    isLoading: signatureLoading,
    hasSignature,
    saveSignature,
    clearSignature,
    handleSignatureCapture,
    addSignatureToCertificate,
  } = useSignaturePage();

  // Parse certificate data from params
  const parsedCertificateData = certificateData ? JSON.parse(certificateData as string) : {};

  // Clear signature and reset state on mount for fresh start
  useEffect(() => {
    // Clear local state to start fresh (without showing alert)
    setCurrentSessionSignature(null);
    setHasDrawnSignature(false);
    console.log('Signature page mounted - ready for new signature');
  }, []);

  // Set landscape orientation on mount and restore on unmount
  useEffect(() => {
    // Lock to landscape orientation
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    
    // Cleanup: restore to portrait when component unmounts
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    };
  }, []);

  const handleSignature = (signature: string) => {
    console.log('📝 handleSignature called with data:', {
      hasSignature: !!signature,
      signatureLength: signature ? signature.length : 0,
      signatureStart: signature ? signature.substring(0, 50) : 'none'
    });
    
    // Check if signature is valid and not empty
    if (signature && signature.length > 100) {  // Base64 images are usually quite long
      setCurrentSessionSignature(signature);
      setHasDrawnSignature(true);
      handleSignatureCapture(signature);
      console.log('✅ Signature stored in currentSessionSignature');
    } else {
      // Canvas is empty or signature is too small
      console.log('⚠️ Signature data is empty or too small, clearing state');
      setCurrentSessionSignature(null);
      // Don't set hasDrawnSignature to false here, as user may have started drawing
    }
    setIsSigning(false);
  };

  const handleSignatureEnd = () => {
    console.log('🖊️ User finished drawing (onEnd triggered)');
    setIsSigning(false);
    
    // Try to read signature when drawing ends
    if (signatureRef.current) {
      console.log('Calling readSignature() to capture the drawing...');
      signatureRef.current.readSignature();
    }
  };

  const handleEmpty = () => {
    console.log('⚠️ handleEmpty called - canvas is empty');
    // Signature cleared
    setCurrentSessionSignature(null);
    setHasDrawnSignature(false);
  };

  const handleClear = () => {
    console.log('🗑️ User clicked clear button');
    signatureRef.current?.clearSignature();
    clearSignature();
    setCurrentSessionSignature(null);
    setHasDrawnSignature(false);
  };

  const handleUndo = () => {
    console.log('↩️ User clicked undo button');
    signatureRef.current?.undo();
    
    // After undo, try to read the signature to see if there's still content
    setTimeout(() => {
      if (signatureRef.current) {
        signatureRef.current.readSignature();
      }
    }, 100);
  };

  const showSavePromptForSpecialist = (currentSignature: string) => {
    Alert.alert(
      'Save Signature',
      'Would you like to save this signature for future certificates and prescriptions?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            console.log('User cancelled the save prompt, staying on signature page');
            // Stay on signature page, do nothing
          }
        },
        {
          text: 'Not Now',
          onPress: () => proceedWithSignature(currentSignature, false)
        },
        {
          text: 'Save',
          onPress: () => proceedWithSignature(currentSignature, true)
        }
      ],
      { cancelable: true }
    );
  };

  const proceedWithSignature = async (currentSignature: string, saveToFirebase: boolean) => {
    setIsSaving(true);

    try {
      // If specialist chose to save, store in Firebase doctors node
      if (saveToFirebase && user?.uid) {
        await databaseService.saveDoctorSignature(user.uid, currentSignature);
        console.log('✅ Signature saved to Firebase doctors node');
      }

      // Always save signature using the context for immediate use
      const success = await saveSignature(currentSignature);
      
      if (!success) {
        return; // Error handling is done in the hook
      }
      
      // Add signature to certificate data using the hook
      const updatedCertificateData = addSignatureToCertificate(parsedCertificateData);
      
      console.log('Updated certificate data:', {
        hasDigitalSignature: !!updatedCertificateData.digitalSignature,
        signatureLength: updatedCertificateData.digitalSignature ? updatedCertificateData.digitalSignature.length : 0,
        certificateType: updatedCertificateData.type
      });

      // Check if this is from specialist certificate creation
      if (fromSpecialist === 'true' && user?.uid && patientId) {
        console.log('Saving certificate directly to database from specialist flow (no appointmentId)');
        
        // Save certificate directly to database WITHOUT appointmentId
        // This is a standalone certificate, not linked to any consultation
        const certificateId = await databaseService.createCertificateInNewStructure(
          updatedCertificateData,
          patientId as string,
          user.uid
          // No appointmentId parameter - this is standalone
        );
        
        console.log('Certificate saved successfully with ID (standalone):', certificateId);
        
        // Navigate back to specialist certificates page
        router.replace('/(specialist)/tabs/certificates');
        
        // Show success confirmation
        Alert.alert(
          'Certificate Issued Successfully', 
          'Your certificate has been created and signed. It will appear in the certificates list.',
          [{ text: 'OK' }]
        );
      } else {
        // Original flow - navigate back to consultation
        const navigationParams = {
          certificateData: JSON.stringify(updatedCertificateData),
          ...(consultationId && { consultationId }),
          ...(referralId && { referralId }),
          ...(patientId && { patientId }),
          signatureAdded: 'true',
        };

        router.replace({
          pathname: '/(patient)/patient-consultation',
          params: navigationParams,
        });
        
        // Navigation itself confirms success, no need for additional alert
      }
    } catch (error) {
      console.error('Error saving signature:', error);
      Alert.alert(
        'Save Failed', 
        'Failed to save your signature. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSignature = async () => {
    console.log('Attempting to save signature - initial state:', {
      hasDrawnSignature,
      hasCurrentSessionSignature: !!currentSessionSignature,
      currentSessionSignatureLength: currentSessionSignature ? currentSessionSignature.length : 0,
      fromSpecialist: fromSpecialist === 'true'
    });
    
    // Try to read signature from canvas if not captured yet
    let signatureToUse = currentSessionSignature;
    
    if (!signatureToUse) {
      console.log('Attempting to read signature from canvas...');
      try {
        if (signatureRef.current) {
          // Try to call readSignature to get the current signature data
          signatureRef.current.readSignature();
          
          // Wait a bit for the callback to fire
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Check again if signature was captured
          if (currentSessionSignature) {
            signatureToUse = currentSessionSignature;
            console.log('✅ Signature read from canvas successfully');
          }
        }
      } catch (error) {
        console.error('Error reading signature from canvas:', error);
      }
    }
    
    console.log('Final signature check:', {
      hasSignatureToUse: !!signatureToUse,
      signatureLength: signatureToUse ? signatureToUse.length : 0
    });
    
    // Validate that we have a valid signature (not empty and sufficient length)
    if (!signatureToUse || signatureToUse.length < 100) {
      Alert.alert(
        'No Signature', 
        'Please provide your signature before continuing.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Check if this is a specialist - show save prompt
    if (fromSpecialist === 'true') {
      showSavePromptForSpecialist(signatureToUse);
    } else {
      // For patients, proceed without the save prompt
      proceedWithSignature(signatureToUse, false);
    }
  };

  const handleBack = () => {
    if (hasDrawnSignature) {
      Alert.alert(
        'Unsaved Signature',
        'You have an unsaved signature. Are you sure you want to go back?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go Back', style: 'destructive', onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  const style = `
    .m-signature-pad {
      box-shadow: none !important;
      border: none !important;
      border-radius: 8px;
      background-color: #FFFFFF;
      outline: none !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .m-signature-pad--body {
      border: none !important;
      outline: none !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .m-signature-pad--footer {
      display: none !important;
    }
    .m-signature-pad canvas {
      border: none !important;
      outline: none !important;
    }
  `;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ChevronLeft size={24} color="#1E40AF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Digital Signature</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionButton} onPress={handleUndo}>
            <RotateCcw size={16} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionButton} onPress={handleClear}>
            <Trash2 size={16} color="#EF4444" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.saveButtonCompact, isSaving && styles.saveButtonDisabled]} 
            onPress={handleSaveSignature}
            disabled={isSaving}
          >
            <Check size={16} color={isSaving ? "#9CA3AF" : "#FFFFFF"} />
            <Text style={[styles.saveButtonTextCompact, isSaving && styles.saveButtonTextDisabled]}>
              {isSaving ? 'Processing...' : 'Done'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Please sign below</Text>
        <Text style={styles.instructionsText}>
          Use your finger or stylus to provide your digital signature for the medical certificate. After drawing your signature, click "Done" to continue.
        </Text>
      </View>

      {/* Signature Canvas */}
      <View style={styles.signatureContainer}>
        <SignatureCanvas
          ref={signatureRef}
          onOK={handleSignature}
          onEmpty={handleEmpty}
          onBegin={() => {
            setIsSigning(true);
            setHasDrawnSignature(true);
            console.log('✏️ User started drawing signature - setting hasDrawnSignature = true');
          }}
          onEnd={handleSignatureEnd}
          descriptionText=""
          clearText=""
          confirmText=""
          webStyle={style}
          autoClear={false}
          imageType="image/png"
          style={styles.signatureCanvas}
          backgroundColor="rgba(255,255,255,0)"
          penColor="rgb(0,0,0)"
          minWidth={2}
          maxWidth={4}
          onGetData={(data) => {
            console.log('📥 onGetData callback triggered:', {
              hasData: !!data,
              dataLength: data ? data.length : 0,
              dataStart: data ? data.substring(0, 50) : 'none'
            });
            if (data) {
              handleSignature(data);
            } else {
              console.log('⚠️ onGetData received empty data');
            }
          }}
        />
      </View>

      {/* Footer Info */}
      <View style={styles.footerContainer}>
        <Text style={styles.footerText}>
          Your signature will be securely stored and associated with this medical certificate.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    height: 32,
    gap: 4,
    marginRight: 30,
  },
  saveButtonTextCompact: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  saveButtonDisabled: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  saveButtonTextDisabled: {
    color: '#9CA3AF',
  },
  instructionsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
  },
  instructionsTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  instructionsText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  signatureStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 6,
  },
  signatureStatusText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#166534',
  },
  signatureContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    minHeight: 300,
    maxHeight: 400,
  },
  signatureCanvas: {
    flex: 1,
    width: '100%',
  },
  footerContainer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  footerText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 16,
  },
});
