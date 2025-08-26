import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Image,
  Modal,
  Dimensions,
  Alert,
  Share,
  RefreshControl,
} from 'react-native';
import {
  ChevronLeft,
  Download,
  Eye,
  X,
  ZoomIn,
  Share as ShareIcon,
  FileText,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useAuth } from '../../src/hooks/auth/useAuth';
import { databaseService, Certificate } from '../../src/services/database/firebase';
import { safeDataAccess } from '../../src/utils/safeDataAccess';
import SpecialistHeader from '../../src/components/navigation/SpecialistHeader';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SpecialistCertificateDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [patientName, setPatientName] = useState<string>('');
  const [showFullView, setShowFullView] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load certificate data from Firebase
  useEffect(() => {
    if (id) {
      loadCertificateData();
    }
  }, [id]);

  const loadCertificateData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      
      // Get all certificates for the specialist and find the one with matching ID
      const specialistCertificates = await databaseService.getCertificatesBySpecialist(user?.uid || '');
      const certificateData = specialistCertificates.find(cert => cert.id === id);
      
      if (certificateData) {
        setCertificate(certificateData);
        
        // Get patient name
        try {
          const patientProfile = await databaseService.getPatientProfile(certificateData.patientId);
          const patientName = patientProfile 
            ? `${patientProfile.firstName || ''} ${patientProfile.lastName || ''}`.trim() || 'Unknown Patient'
            : 'Unknown Patient';
          setPatientName(patientName);
        } catch (error) {
          console.error('Error fetching patient profile:', error);
          setPatientName('Unknown Patient');
        }
      }
    } catch (error) {
      console.error('Error loading certificate data:', error);
      Alert.alert('Error', 'Failed to load certificate data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCertificateData();
    setRefreshing(false);
  };

  const getStatusColors = (status: string) => {
    switch (status) {
      case 'Valid':
      case 'active':
        return {
          bg: '#EFF6FF',
          text: '#1E40AF',
          border: '#93C5FD',
        };
      case 'Expired':
      case 'expired':
        return {
          bg: '#FEF2F2',
          text: '#EF4444',
          border: '#FCA5A5',
        };
      default:
        return {
          bg: '#F3F4F6',
          text: '#6B7280',
          border: '#E5E7EB',
        };
    }
  };

  const handleDownload = async () => {
    if (!certificate?.documentUrl) {
      Alert.alert('Error', 'No document available for download.');
      return;
    }

    try {
      setIsDownloading(true);
      
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access media library is required to download the certificate.');
        return;
      }

      // Download the file
      const downloadResumable = FileSystem.createDownloadResumable(
        certificate.documentUrl,
        FileSystem.documentDirectory + `certificate_${certificate.id}.pdf`,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          console.log(`Downloaded: ${progress * 100}%`);
        }
      );

      const { uri } = await downloadResumable.downloadAsync();
      
      // Save to media library
      await MediaLibrary.saveToLibraryAsync(uri);
      
      Alert.alert('Success', 'Certificate downloaded successfully!');
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download certificate. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!certificate?.documentUrl) {
      Alert.alert('Error', 'No document available to share.');
      return;
    }

    try {
      await Share.share({
        url: certificate.documentUrl,
        title: `${certificate.type} - ${patientName}`,
        message: `Medical certificate for ${patientName}`,
      });
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share certificate.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle="dark-content"
        />
        <SpecialistHeader title="Certificate Details" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading certificate details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!certificate) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle="dark-content"
        />
        <SpecialistHeader title="Certificate Details" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Certificate not found</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusColors = getStatusColors(certificate.status);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      
      {/* Header */}
      <SpecialistHeader title="Certificate Details" />
      
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Certificate Header */}
        <View style={styles.headerSection}>
          <View style={styles.certificateHeader}>
            <View style={styles.certificateIcon}>
              <FileText size={32} color="#1E40AF" />
            </View>
            <View style={styles.certificateInfo}>
              <Text style={styles.certificateTitle}>{certificate.type}</Text>
              <Text style={styles.patientName}>Patient: {patientName}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColors.bg, borderColor: statusColors.border }]}>
                <Text style={[styles.statusText, { color: statusColors.text }]}>
                  {certificate.status === 'active' ? 'Valid' : 'Expired'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Certificate Details */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Certificate Information</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Certificate ID:</Text>
            <Text style={styles.detailValue}>{certificate.id}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Patient ID:</Text>
            <Text style={styles.detailValue}>{certificate.patientId}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Issued Date:</Text>
            <Text style={styles.detailValue}>
              {certificate.issueDate ? new Date(certificate.issueDate).toLocaleDateString() : 'Not specified'}
            </Text>
          </View>
          
          {certificate.expiryDate && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Valid Until:</Text>
              <Text style={styles.detailValue}>
                {new Date(certificate.expiryDate).toLocaleDateString()}
              </Text>
            </View>
          )}
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Description:</Text>
            <Text style={styles.detailValue}>{certificate.description}</Text>
          </View>
        </View>

        {/* Medical Findings */}
        {certificate.medicalFindings && (
          <>
            <View style={styles.divider} />
            <View style={styles.findingsSection}>
              <Text style={styles.sectionTitle}>Medical Findings</Text>
              <Text style={styles.findingsText}>{certificate.medicalFindings}</Text>
              {certificate.restrictions && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Restrictions</Text>
                  <Text style={styles.restrictionsText}>{certificate.restrictions}</Text>
                </>
              )}
            </View>
          </>
        )}

        {/* Document Preview */}
        {certificate.documentUrl && (
          <View style={styles.documentSection}>
            <Text style={styles.sectionTitle}>Certificate Document</Text>
            <TouchableOpacity
              style={styles.documentPreview}
              onPress={() => setShowFullView(true)}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: certificate.documentUrl }}
                style={styles.documentImage}
                resizeMode="cover"
                defaultSource={require('../../assets/images/icon.png')}
              />
              <View style={styles.documentOverlay}>
                <View style={styles.viewFullButton}>
                  <Eye size={20} color="#FFFFFF" />
                  <Text style={styles.viewFullText}>Tap to view full document</Text>
                </View>
                <View style={styles.zoomIcon}>
                  <ZoomIn size={24} color="#FFFFFF" />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShare}
        >
          <ShareIcon size={20} color="#374151" />
          <Text style={styles.shareButtonText}>Share</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.downloadButton, isDownloading && styles.downloadButtonDisabled]}
          onPress={handleDownload}
          disabled={isDownloading}
        >
          <Download size={20} color="#FFFFFF" />
          <Text style={styles.downloadButtonText}>
            {isDownloading ? 'Downloading...' : 'Download'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Full Document Modal */}
      <Modal
        visible={showFullView}
        animationType="fade"
        presentationStyle="fullScreen"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowFullView(false)}
            >
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Certificate Document</Text>
          </View>
          
          {certificate.documentUrl && (
            <Image
              source={{ uri: certificate.documentUrl }}
              style={styles.fullDocumentImage}
              resizeMode="contain"
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  headerSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: '#F9FAFB',
  },
  certificateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  certificateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  certificateInfo: {
    flex: 1,
  },
  certificateTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  patientName: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.1,
  },
  detailsSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#1F2937',
    flex: 2,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 24,
  },
  findingsSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  findingsText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  restrictionsText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  documentSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  documentPreview: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  documentImage: {
    width: '100%',
    height: 200,
  },
  documentOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewFullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  viewFullText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 8,
  },
  zoomIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    padding: 8,
  },
  bottomContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  shareButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginLeft: 8,
  },
  downloadButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    paddingVertical: 12,
    borderRadius: 8,
  },
  downloadButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  downloadButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#000000',
  },
  closeButton: {
    padding: 8,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginRight: 40,
  },
  fullDocumentImage: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});
