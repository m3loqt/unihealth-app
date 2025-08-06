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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CertificateDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [certificate, setCertificate] = useState<Certificate | null>(null);
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
      const certificateData = await databaseService.getCertificateById(id as string);
      
      if (certificateData) {
        setCertificate(certificateData);
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
        return {
          bg: '#EFF6FF',
          text: '#1E40AF',
          border: '#93C5FD',
        };
      case 'Expired':
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading certificate...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!certificate) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Certificate not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to save files to your device.');
        return;
      }

      // Download the file
      const fileUri = FileSystem.documentDirectory + `${certificate.type.replace(/\s+/g, '_')}_${certificate.certificateNumber}.jpg`;
      const downloadResult = await FileSystem.downloadAsync(certificate.documentUrl, fileUri);

      if (downloadResult.status === 200) {
        // Save to media library
        await MediaLibrary.saveToLibraryAsync(downloadResult.uri);
        Alert.alert('Success', 'Certificate downloaded successfully to your device!');
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to download certificate. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${certificate.type} - Issued by ${certificate.doctor} on ${certificate.issuedDate}`,
        url: certificate.documentUrl,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share certificate.');
    }
  };

  const statusColors = getStatusColors(certificate.status);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#1E40AF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Certificate Details</Text>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <ShareIcon size={24} color="#1E40AF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Certificate Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.certificateHeader}>
            <View style={styles.certificateIconContainer}>
              <FileText size={24} color="#1E40AF" />
            </View>
            <View style={styles.certificateInfo}>
              <Text style={styles.certificateType}>{certificate.type}</Text>
              <Text style={styles.certificateNumber}>#{certificate.certificateNumber}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg, borderColor: statusColors.border }]}>
              <Text style={[styles.statusText, { color: statusColors.text }]}>{certificate.status}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailsSection}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Issued by:</Text>
              <Text style={styles.detailValue}>{certificate.specialistId}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Clinic:</Text>
              <Text style={styles.detailValue}>{certificate.clinicName || 'General Clinic'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Issued Date:</Text>
              <Text style={styles.detailValue}>
                {new Date(certificate.issueDate).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Issued Time:</Text>
              <Text style={styles.detailValue}>{certificate.issueTime || 'N/A'}</Text>
            </View>
            {certificate.expiryDate && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Valid Until:</Text>
                <Text style={styles.detailValue}>
                  {new Date(certificate.expiryDate).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>

          {certificate.description && (
            <>
              <View style={styles.divider} />
              <View style={styles.descriptionSection}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.descriptionText}>{certificate.description}</Text>
              </View>
            </>
          )}

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
        </View>

        {/* Document Preview */}
        <View style={styles.documentSection}>
          <Text style={styles.sectionTitle}>Certificate Document</Text>
          <TouchableOpacity
            style={styles.documentPreview}
            onPress={() => setShowFullView(true)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: certificate.documentUrl || 'https://via.placeholder.com/400x600?text=Certificate+Document' }}
              style={styles.documentImage}
              resizeMode="cover"
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
      </ScrollView>

      {/* Download Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.downloadButton, isDownloading && styles.downloadButtonDisabled]}
          onPress={handleDownload}
          disabled={isDownloading}
        >
          <Download size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.downloadButtonText}>
            {isDownloading ? 'Downloading...' : 'Download Certificate'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Full View Modal */}
      <Modal
        visible={showFullView}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFullView(false)}
      >
        <View style={styles.fullViewContainer}>
          <TouchableOpacity
            style={styles.fullViewBackdrop}
            onPress={() => setShowFullView(false)}
            activeOpacity={1}
          />
          <SafeAreaView style={styles.fullViewContent}>
            <View style={styles.fullViewHeader}>
              <Text style={styles.fullViewTitle}>{certificate.type}</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowFullView(false)}
              >
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.fullViewScroll}
              maximumZoomScale={3}
              minimumZoomScale={1}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
            >
              <Image
                source={{ uri: certificate.documentUrl }}
                style={styles.fullViewImage}
                resizeMode="contain"
              />
            </ScrollView>
          </SafeAreaView>
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scrollView: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 24,
    marginTop: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  certificateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  certificateIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  certificateInfo: {
    flex: 1,
  },
  certificateType: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  certificateNumber: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  detailsSection: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  descriptionSection: {
    marginTop: 4,
  },
  findingsSection: {
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
  },
  findingsText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
  },
  restrictionsText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
  },
  documentSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  documentPreview: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  documentImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#F3F4F6',
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
    backgroundColor: 'rgba(30, 64, 175, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  viewFullText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    marginLeft: 6,
  },
  zoomIcon: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  downloadButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadButtonDisabled: {
    opacity: 0.6,
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  // Full View Modal Styles
  fullViewContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  fullViewBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fullViewContent: {
    flex: 1,
  },
  fullViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  fullViewTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    flex: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullViewScroll: {
    flex: 1,
  },
  fullViewImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    fontSize: 18,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
});