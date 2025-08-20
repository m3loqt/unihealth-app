import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Modal, Alert, Pressable, Dimensions, StatusBar, SafeAreaView } from 'react-native';
import { useRouter, usePathname, type Href } from 'expo-router';
import { Home, Users, Calendar, User, QrCode, X, AlertCircle as AlertCircleIcon, User as UserIcon, Phone, Mail, MapPin, Heart, Calendar as CalendarIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../../hooks/data/useNotifications';
import { CameraView, Camera } from 'expo-camera';
import { BlurView } from 'expo-blur';
import { databaseService } from '../../services/database/firebase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SpecialistTabBarProps {
  activeTab?: string;
}

// Icon prop shape for lucide-react-native components
type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

// Strongly-typed route union for expo-router
type RoutePath =
  | '/(specialist)/tabs'
  | '/(specialist)/tabs/patients'
  | '/(specialist)/tabs/appointments'
  | '/(specialist)/tabs/profile';

type Tab = {
  name: 'index' | 'patients' | 'qr-code' | 'appointments' | 'profile';
  icon: IconComponent;
  route: RoutePath | null; // null for action button
  isAction?: boolean;
};

export default function SpecialistTabBar({ activeTab }: SpecialistTabBarProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { unreadCount } = useNotifications();

  // QR Code state
  const [showQRModal, setShowQRModal] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [scannedPatient, setScannedPatient] = useState<any>(null);

  // Debug logging
  useEffect(() => {
    console.log('🔔 Specialist TabBar - Unread count:', unreadCount);
  }, [unreadCount]);

  // QR Code permission effect
  useEffect(() => {
    if (showQRModal) {
      const getCameraPermissions = async () => {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
      };
      getCameraPermissions();
    }
  }, [showQRModal]);

  // QR Scanner Functions
  const handleScanQR = () => {
    setShowQRModal(true);
    setScanned(false);
  };

  const handleCloseQRModal = () => {
    setShowQRModal(false);
    setScanned(false);
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return; // Prevent multiple scans
    
    setScanned(true);
    
    try {
      // Parse the QR code data
      const qrData = JSON.parse(data);
      
      // Validate that this is a patient QR code
      if (qrData.type === 'patient' && qrData.id) {
        console.log('Scanned patient QR code:', qrData);
        
        // Fetch additional patient information from database
        let patientDetails = null;
        try {
          patientDetails = await databaseService.getPatientById(qrData.id);
        } catch (error) {
          console.log('Could not fetch patient details from database:', error);
        }
        
        // Combine QR data with database data
        const enhancedPatientData = {
          ...qrData,
          ...patientDetails,
          // Ensure we have the most complete information
          name: patientDetails?.name || patientDetails?.patientFirstName + ' ' + patientDetails?.patientLastName || qrData.name || 'Unknown Patient',
          email: patientDetails?.email || qrData.email || '',
          phone: patientDetails?.phone || patientDetails?.contactNumber || qrData.phone || '',
          address: patientDetails?.address || qrData.address || '',
          dateOfBirth: patientDetails?.dateOfBirth || '',
          gender: patientDetails?.gender || '',
          bloodType: patientDetails?.bloodType || '',
          emergencyContact: patientDetails?.emergencyContact || null,
          createdAt: patientDetails?.createdAt || '',
          lastVisit: patientDetails?.lastVisit || '',
          specialty: patientDetails?.specialty || '',
          status: patientDetails?.status || ''
        };
        
        // Set the enhanced patient data and show the modal
        setScannedPatient(enhancedPatientData);
        setShowPatientModal(true);
        handleCloseQRModal();
      } else {
        Alert.alert(
          'Invalid QR Code',
          'This QR code is not a valid patient QR code. Please try scanning a different code.',
          [
            {
              text: 'Scan Again',
              onPress: () => {
                setScanned(false);
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error parsing QR code data:', error);
      Alert.alert(
        'Invalid QR Code',
        'The scanned QR code could not be read. Please try scanning a different code.',
        [
          {
            text: 'Scan Again',
            onPress: () => {
              setScanned(false);
            },
          },
        ]
      );
    }
  };

  const handleScanAgain = () => {
    setScanned(false);
  };

  const handleViewPatient = () => {
    if (scannedPatient) {
      setShowPatientModal(false);
      // Navigate to patient overview with the patient ID
      router.push(`/patient-overview?id=${scannedPatient.id}`);
    }
  };

  const handleClosePatientModal = () => {
    setShowPatientModal(false);
    setScannedPatient(null);
  };

  const TABS: Readonly<Tab[]> = [
    { name: 'index',        icon: Home,     route: '/(specialist)/tabs' },
    { name: 'patients',     icon: Users,    route: '/(specialist)/tabs/patients' },
    { name: 'qr-code',      icon: QrCode,   route: null, isAction: true },
    { name: 'appointments', icon: Calendar, route: '/(specialist)/tabs/appointments' },
    { name: 'profile',      icon: User,     route: '/(specialist)/tabs/profile' },
  ] as const;

  const getActiveTab = (): Tab['name'] | undefined => {
    if (activeTab) return activeTab as Tab['name'];
    if (pathname === '/(specialist)/tabs' || pathname === '/(specialist)/tabs/') return 'index';
    return pathname.split('/').pop() as Tab['name'] | undefined;
  };

  const currentActiveTab = getActiveTab();

  return (
    <>
      <View style={[styles.tabContainer, { paddingBottom: Math.max(insets.bottom * 0.1, 0) }]}>
        {TABS.map(({ name, icon: Icon, route, isAction }) => {
          const isFocused = currentActiveTab === name;
          const showBadge = name === 'profile' && (unreadCount ?? 0) > 0;

          if (isAction) {
            // QR Code button - now matches other buttons
            return (
              <TouchableOpacity
                key={name}
                onPress={handleScanQR}
                style={styles.tab}
                activeOpacity={0.9}
              >
                <View style={styles.iconWrapper}>
                  <Icon size={22} color="#FFFFFF" strokeWidth={2} />
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={name}
              onPress={() => {
                if (route) router.push(route as Href);
              }}
              style={styles.tab}
              activeOpacity={0.9}
            >
              <View style={styles.iconWrapper}>
                <Icon size={22} color="#FFFFFF" strokeWidth={isFocused ? 2.5 : 2} />
                {showBadge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {(unreadCount ?? 0) > 99 ? '99+' : String(unreadCount ?? 0)}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* === QR SCANNER MODAL === */}
      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseQRModal}
      >
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        {/* Backdrop/Blur */}
        <Pressable style={qrModalStyles.backdrop} onPress={handleCloseQRModal}>
          <BlurView intensity={22} style={qrModalStyles.blurView}>
            <View style={qrModalStyles.backdropOverlay} />
          </BlurView>
        </Pressable>
        {/* Modal Content */}
        <View style={qrModalStyles.modalContainer}>
          <SafeAreaView style={qrModalStyles.safeArea}>
            <View style={qrModalStyles.modalContent}>
              {/* Header */}
              <View style={qrModalStyles.header}>
                <View style={qrModalStyles.headerLeft}>
                  <Text style={qrModalStyles.headerTitle}>Scan Patient QR Code</Text>
                  <Text style={qrModalStyles.headerSubtitle}>Position the QR code within the frame</Text>
                </View>
                <TouchableOpacity style={qrModalStyles.closeButton} onPress={handleCloseQRModal}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              {/* Divider */}
              <View style={qrModalStyles.divider} />
              
              {/* Scanner Content */}
              {hasPermission === null ? (
                <View style={qrModalStyles.loadingContainer}>
                  <Text style={qrModalStyles.loadingText}>Requesting camera permission...</Text>
                </View>
              ) : hasPermission === false ? (
                <View style={qrModalStyles.permissionContainer}>
                  <AlertCircleIcon size={64} color="#EF4444" />
                  <Text style={qrModalStyles.permissionTitle}>Camera Permission Required</Text>
                  <Text style={qrModalStyles.permissionText}>
                    To scan patient QR codes, this app needs access to your camera.
                  </Text>
                  <TouchableOpacity style={qrModalStyles.permissionButton} onPress={handleCloseQRModal}>
                    <Text style={qrModalStyles.permissionButtonText}>Go Back</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={qrModalStyles.scannerContainer}>
                  <CameraView
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                    barcodeScannerSettings={{
                      barcodeTypes: ['qr'], // Specify to only scan QR codes
                    }}
                    style={qrModalStyles.scanner}
                  />
                  
                  {/* Scanner Overlay */}
                  <View style={qrModalStyles.overlay}>
                    {/* Corner indicators - now white and larger */}
                    <View style={qrModalStyles.cornerTopLeft} />
                    <View style={qrModalStyles.cornerTopRight} />
                    <View style={qrModalStyles.cornerBottomLeft} />
                    <View style={qrModalStyles.cornerBottomRight} />
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              {scanned && (
                <View style={qrModalStyles.actions}>
                  <TouchableOpacity
                    style={qrModalStyles.secondaryButton}
                    onPress={handleScanAgain}
                  >
                    <Text style={qrModalStyles.secondaryButtonText}>Scan Again</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* === PATIENT VIEW MODAL === */}
      <Modal
        visible={showPatientModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleClosePatientModal}
      >
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        {/* Backdrop */}
        <Pressable style={patientModalStyles.backdrop} onPress={handleClosePatientModal}>
          <View style={patientModalStyles.backdropOverlay} />
        </Pressable>
        {/* Modal Content */}
        <View style={patientModalStyles.modalContainer}>
          <SafeAreaView style={patientModalStyles.safeArea}>
            <View style={patientModalStyles.modalContent}>
              {/* Header */}
              <View style={patientModalStyles.header}>
                <View style={patientModalStyles.headerLeft}>
                  <Text style={patientModalStyles.headerTitle}>Patient Found</Text>
                  <Text style={patientModalStyles.headerSubtitle}>QR code scanned successfully</Text>
                </View>
                <TouchableOpacity style={patientModalStyles.closeButton} onPress={handleClosePatientModal}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
              {/* Divider */}
              <View style={patientModalStyles.divider} />
              
              {/* Patient Info */}
              {scannedPatient && (
                <View style={patientModalStyles.patientInfo}>
                  {/* Patient Name */}
                  <Text style={patientModalStyles.patientName}>
                    {scannedPatient.firstName + " " + scannedPatient.lastName}
                  </Text>
                  
                  {/* Basic Info Grid */}
                  <View style={patientModalStyles.infoGrid}>
                    {scannedPatient.dateOfBirth && (
                      <View style={patientModalStyles.infoItem}>
                        <CalendarIcon size={16} color="#6B7280" />
                        <Text style={patientModalStyles.infoText}>
                          {(() => {
                            try {
                              // Handle YYYY-MM-DD format specifically
                              const dateString = scannedPatient.dateOfBirth;
                              if (dateString && typeof dateString === 'string') {
                                // Check if it's in YYYY-MM-DD format
                                if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                                  const date = new Date(dateString + 'T00:00:00');
                                  if (!isNaN(date.getTime())) {
                                    return date.toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    });
                                  }
                                }
                                // Fallback for other date formats
                                const date = new Date(dateString);
                                if (!isNaN(date.getTime())) {
                                  return date.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  });
                                }
                              }
                              return scannedPatient.dateOfBirth;
                            } catch (error) {
                              console.log('Error formatting dateOfBirth:', error);
                              return scannedPatient.dateOfBirth;
                            }
                          })()}
                        </Text>
                      </View>
                    )}
                    {scannedPatient.gender && (
                      <View style={patientModalStyles.infoItem}>
                        <UserIcon size={16} color="#6B7280" />
                        <Text style={patientModalStyles.infoText}>{scannedPatient.gender}</Text>
                      </View>
                    )}
                    {scannedPatient.bloodType && (
                      <View style={patientModalStyles.infoItem}>
                        <Heart size={16} color="#6B7280" />
                        <Text style={patientModalStyles.infoText}>Blood Type: {scannedPatient.bloodType}</Text>
                      </View>
                    )}
                    {scannedPatient.email && (
                      <View style={patientModalStyles.infoItem}>
                        <Mail size={16} color="#6B7280" />
                        <Text style={patientModalStyles.infoText}>{scannedPatient.email}</Text>
                      </View>
                    )}
                    {scannedPatient.phone && (
                      <View style={patientModalStyles.infoItem}>
                        <Phone size={16} color="#6B7280" />
                        <Text style={patientModalStyles.infoText}>{scannedPatient.phone}</Text>
                      </View>
                    )}
                    {scannedPatient.address && (
                      <View style={patientModalStyles.infoItem}>
                        <MapPin size={16} color="#6B7280" />
                        <Text style={patientModalStyles.infoText}>{scannedPatient.address}</Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Emergency Contact */}
                  {scannedPatient.emergencyContact && (
                    <View style={patientModalStyles.emergencyContactSection}>
                      <Text style={patientModalStyles.sectionTitle}>Emergency Contact</Text>
                      <View style={patientModalStyles.emergencyContactCard}>
                        <Text style={patientModalStyles.emergencyContactName}>
                          {scannedPatient.emergencyContact.name}
                        </Text>
                        <Text style={patientModalStyles.emergencyContactPhone}>
                          {scannedPatient.emergencyContact.phone}
                        </Text>
                        <Text style={patientModalStyles.emergencyContactRelationship}>
                          {scannedPatient.emergencyContact.relationship}
                        </Text>
                      </View>
                    </View>
                  )}
                                    
                </View>
              )}
              
              {/* Action Buttons */}
              <View style={patientModalStyles.actions}>
                <TouchableOpacity
                  style={patientModalStyles.secondaryButton}
                  onPress={handleClosePatientModal}
                >
                  <Text style={patientModalStyles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={patientModalStyles.primaryButton}
                  onPress={handleViewPatient}
                >
                  <Text style={patientModalStyles.primaryButtonText}>View Patient</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    flexDirection: 'row',
    backgroundColor: '#1E40AF',
    borderRadius: 20,
    height: 70,
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
    zIndex: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'red',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

// QR Modal Styles - Cloned from specialist index
const qrModalStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
  },
  blurView: { flex: 1 },
  backdropOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.34)' },
  modalContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 2,
  },
  safeArea: { width: SCREEN_WIDTH * 0.92, maxWidth: 410 },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 26,
    alignItems: 'stretch',
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22,
  },
  headerLeft: { flex: 1 },
  headerTitle: {
    fontSize: 20, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14, fontFamily: 'Inter-Regular', color: '#6B7280',
  },
  closeButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', marginLeft: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 18,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  permissionContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  permissionTitle: {
    color: '#1F2937',
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionText: {
    color: '#6B7280',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  scannerContainer: {
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 18,
  },
  scanner: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cornerTopLeft: {
    position: 'absolute',
    top: 40,
    left: 40,
    width: 30,
    height: 30,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
    borderTopLeftRadius: 12,
  },
  cornerTopRight: {
    position: 'absolute',
    top: 40,
    right: 40,
    width: 30,
    height: 30,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
    borderTopRightRadius: 12,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    width: 30,
    height: 30,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
    borderBottomLeftRadius: 12,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 40,
    right: 40,
    width: 30,
    height: 30,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
    borderBottomRightRadius: 12,
  },
  actions: { 
    flexDirection: 'row', 
    gap: 12 
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: { 
    color: '#374151', 
    fontSize: 15, 
    fontFamily: 'Inter-SemiBold' 
  },
});

// Patient Modal Styles - Cloned from specialist index
const patientModalStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
  },
  backdropOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)' 
  },
  modalContainer: {
    flex: 1, justifyContent: 'flex-end', zIndex: 2,
  },
  safeArea: { 
    width: '100%',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    alignItems: 'stretch',
    minHeight: SCREEN_HEIGHT * 0.4,
  },
  header: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 20,
  },
  headerLeft: { 
    flex: 1 
  },
  headerTitle: {
    fontSize: 20, 
    fontFamily: 'Inter-Bold', 
    color: '#1F2937', 
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14, 
    fontFamily: 'Inter-Regular', 
    color: '#6B7280',
  },
  closeButton: {
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#E5E7EB', 
    marginLeft: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 24,
  },
  patientInfo: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  patientName: {
    marginTop: -20,
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  infoGrid: {
    width: '100%',
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    flex: 1,
  },
  emergencyContactSection: {
    width: '100%',
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 12,
  },
  emergencyContactCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emergencyContactName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  emergencyContactPhone: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 4,
  },
  emergencyContactRelationship: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  actions: { 
    flexDirection: 'row', 
    gap: 12,
    marginTop: 32,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: { 
    color: '#374151', 
    fontSize: 16, 
    fontFamily: 'Inter-SemiBold' 
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#1E40AF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontFamily: 'Inter-SemiBold' 
  },
});
