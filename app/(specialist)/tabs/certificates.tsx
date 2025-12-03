import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Dimensions,
  Pressable,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import {
  FileText, Search, Download, Eye, ChevronDown, Check, Bell, RefreshCw, Trash2, CheckCircle, Filter, Plus, X
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { useCertificateSignature } from '../../../src/hooks/ui/useSignatureManager';
import { useRealtimeNotificationContext } from '../../../src/contexts/RealtimeNotificationContext';
import { getSafeNotifications, getSafeUnreadCount } from '../../../src/utils/notificationUtils';
import { databaseService, Certificate } from '../../../src/services/database/firebase';
import { safeDataAccess } from '../../../src/utils/safeDataAccess';
import LoadingState from '../../../src/components/ui/LoadingState';
import ErrorBoundary from '../../../src/components/ui/ErrorBoundary';
import { dataValidation } from '../../../src/utils/dataValidation';
import { useDeepMemo } from '../../../src/utils/performance';
import SpecialistHeader from '../../../src/components/navigation/SpecialistHeader';
import { GlobalNotificationModal } from '../../../src/components/shared';
import { BlurView } from 'expo-blur';

const { width: screenWidth } = Dimensions.get('window');
const cardWidth = (screenWidth - 64) / 2;

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Valid', value: 'valid' },
  { label: 'Expired', value: 'expired' },
];

const SORT_OPTIONS = [
  { key: 'date', label: 'By Date' },
  { key: 'type', label: 'Alphabetical' },
  { key: 'patient', label: 'By Patient' },
  { key: 'validUntil', label: 'Valid Until' },
];

export default function SpecialistCertificatesScreen() {
  const { user } = useAuth();
  const { 
    notifications: realtimeNotificationData,
  } = useRealtimeNotificationContext();
  
  // Safely extract notifications and unread count
  const notifications = getSafeNotifications(realtimeNotificationData.notifications);
  const unreadCount = getSafeUnreadCount(realtimeNotificationData.unreadCount);
  const notificationsLoading = realtimeNotificationData.loading;
  const notificationsError = realtimeNotificationData.error;
  const markAsRead = realtimeNotificationData.markAsRead;
  const markAllAsRead = realtimeNotificationData.markAllAsRead;
  const deleteNotification = realtimeNotificationData.deleteNotification;
  const refreshNotifications = realtimeNotificationData.refresh;
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showSort, setShowSort] = useState(false);
  const [sortDropdownPos, setSortDropdownPos] = useState({ top: 0, right: 0 });
  const sortBtnRef = useRef<any>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Notification Modal State
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  
  // Certificate Type Selection Modal State
  const [showCertificateTypeModal, setShowCertificateTypeModal] = useState(false);
  const [selectedCertificateType, setSelectedCertificateType] = useState('');
  const [showCertificateForm, setShowCertificateForm] = useState(false);
  
  // Certificate Form State
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [diagnosis, setDiagnosis] = useState('');
  const [description, setDescription] = useState('');
  const [examinationDate, setExaminationDate] = useState('');
  const [medicalAdvice, setMedicalAdvice] = useState('');
  
  // Fit to Work fields
  const [fitnessStatement, setFitnessStatement] = useState('');
  const [workRestrictions, setWorkRestrictions] = useState('');
  const [unfitPeriodStart, setUnfitPeriodStart] = useState('');
  const [unfitPeriodEnd, setUnfitPeriodEnd] = useState('');
  
  // Medical/Sickness fields
  const [reasonForUnfitness, setReasonForUnfitness] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  
  // Fit to Travel fields
  const [travelFitnessStatement, setTravelFitnessStatement] = useState('');
  const [travelMode, setTravelMode] = useState('');
  const [destination, setDestination] = useState('');
  const [travelDate, setTravelDate] = useState('');
  const [specialConditions, setSpecialConditions] = useState('');
  const [validityPeriod, setValidityPeriod] = useState('');
  
  // Notification Modal Actions
  const handleOpenNotifications = () => setShowNotificationModal(true);
  const handleCloseNotificationModal = () => setShowNotificationModal(false);
  
  // Handle marking notification as read
  const handleMarkAsRead = async (notificationId: string) => {
    await markAsRead(notificationId);
  };
  
  // Handle deleting notification
  const handleDeleteNotification = async (notificationId: string) => {
    await deleteNotification(notificationId);
  };
  
  // Handle marking all notifications as read
  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };
  
  // Handle certificate type selection
  const handleCertificateTypeSelect = async (certificateType: string) => {
    setSelectedCertificateType(certificateType);
    setShowCertificateForm(true);
    
    // Load patients
    await loadPatientsWithAppointments();
  };
  
  // Load patients who have appointments with this doctor
  const loadPatientsWithAppointments = async () => {
    if (!user?.uid) return;
    
    try {
      setLoadingPatients(true);
      const appointments = await databaseService.getAppointmentsByDoctor(user.uid);
      
      // Extract unique patients (using Map to deduplicate by patient ID)
      const uniquePatients = new Map();
      appointments.forEach((apt: any) => {
        if (apt.patientDetails && apt.patientDetails.id) {
          // Only add if not already in map, or update with more complete data
          const existingPatient = uniquePatients.get(apt.patientDetails.id);
          if (!existingPatient || 
              (apt.patientDetails.contactNumber && apt.patientDetails.contactNumber !== 'N/A')) {
            uniquePatients.set(apt.patientDetails.id, apt.patientDetails);
          }
        }
      });
      
      const patientList = Array.from(uniquePatients.values());
      console.log(` Extracted ${patientList.length} unique patients from ${appointments.length} appointments/referrals`);
      setPatients(patientList);
    } catch (error) {
      console.error('Error loading patients:', error);
      Alert.alert('Error', 'Failed to load patients. Please try again.');
    } finally {
      setLoadingPatients(false);
    }
  };
  
  // Handle continue to signature
  const handleContinueToSignature = async () => {
    // Validate required fields
    if (!selectedPatient) {
      Alert.alert('Patient Required', 'Please select a patient.');
      return;
    }
    if (!diagnosis.trim() || !description.trim()) {
      Alert.alert('Required Fields', 'Please fill in diagnosis and description.');
      return;
    }
    
    // Type-specific validation
    if (selectedCertificateType === 'Fit to Work Certificate' && !fitnessStatement.trim()) {
      Alert.alert('Required Fields', 'Please fill in fitness statement.');
      return;
    }
    if (selectedCertificateType === 'Medical/Sickness Certificate' && !reasonForUnfitness.trim()) {
      Alert.alert('Required Fields', 'Please fill in reason for unfitness.');
      return;
    }
    if (selectedCertificateType === 'Fit to Travel Certificate' && !travelFitnessStatement.trim()) {
      Alert.alert('Required Fields', 'Please fill in travel fitness statement.');
      return;
    }
    
    // Build certificate data
    const certificateData: any = {
      type: selectedCertificateType,
      diagnosis,
      description,
      examinationDate: examinationDate || new Date().toISOString().split('T')[0],
      medicalAdvice,
    };
    
    // Add type-specific fields
    if (selectedCertificateType === 'Fit to Work Certificate') {
      certificateData.fitnessStatement = fitnessStatement;
      certificateData.workRestrictions = workRestrictions;
      certificateData.unfitPeriodStart = unfitPeriodStart;
      certificateData.unfitPeriodEnd = unfitPeriodEnd;
    } else if (selectedCertificateType === 'Medical/Sickness Certificate') {
      certificateData.reasonForUnfitness = reasonForUnfitness;
      certificateData.unfitPeriodStart = unfitPeriodStart;
      certificateData.unfitPeriodEnd = unfitPeriodEnd;
      certificateData.medicalAdvice = medicalAdvice;
      certificateData.followUpDate = followUpDate;
    } else if (selectedCertificateType === 'Fit to Travel Certificate') {
      certificateData.travelFitnessStatement = travelFitnessStatement;
      certificateData.travelMode = travelMode;
      certificateData.destination = destination;
      certificateData.travelDate = travelDate;
      certificateData.specialConditions = specialConditions;
      certificateData.validityPeriod = validityPeriod;
    }
    
    // Close modals
    setShowCertificateTypeModal(false);
    setShowCertificateForm(false);
    
    try {
      // Check if doctor has a saved signature
      if (user?.uid) {
        const { signature: savedSignature, isSignatureSaved } = await databaseService.getDoctorSignature(user.uid);
        
        if (isSignatureSaved && savedSignature) {
          // Auto-use saved signature, skip signature page
          console.log(' Using saved signature, skipping signature page');
          
          const updatedCertificateData = {
            ...certificateData,
            digitalSignature: savedSignature,
            signatureKey: `signature_${Date.now()}`,
            signedAt: new Date().toISOString(),
          };
          
          // Save certificate directly to database
          const certificateId = await databaseService.createCertificateInNewStructure(
            updatedCertificateData,
            selectedPatient.id,
            user.uid
          );
          
          console.log(' Certificate saved successfully with ID (auto-signed):', certificateId);
          
          // Reset form
          resetForm();
          
          // Show success confirmation
          Alert.alert(
            'Certificate Issued Successfully', 
            'Your certificate has been created and signed automatically using your saved signature.',
            [{ text: 'OK' }]
          );
          
          // Refresh certificates
          await loadCertificates();
          
          return;
        }
      }
      
      // No saved signature, navigate to signature page
      router.push({
        pathname: '/(patient)/signature-page',
        params: {
          certificateData: JSON.stringify(certificateData),
          patientId: selectedPatient.id,
          fromSpecialist: 'true',
        }
      } as any);
      
      // Reset form
      resetForm();
    } catch (error) {
      console.error(' Error checking saved signature:', error);
      // On error, default to showing signature page
      router.push({
        pathname: '/(patient)/signature-page',
        params: {
          certificateData: JSON.stringify(certificateData),
          patientId: selectedPatient.id,
          fromSpecialist: 'true',
        }
      } as any);
      
      // Reset form
      resetForm();
    }
  };
  
  // Reset form
  const resetForm = () => {
    setSelectedCertificateType('');
    setSelectedPatient(null);
    setDiagnosis('');
    setDescription('');
    setExaminationDate('');
    setMedicalAdvice('');
    setFitnessStatement('');
    setWorkRestrictions('');
    setUnfitPeriodStart('');
    setUnfitPeriodEnd('');
    setReasonForUnfitness('');
    setFollowUpDate('');
    setTravelFitnessStatement('');
    setTravelMode('');
    setDestination('');
    setTravelDate('');
    setSpecialConditions('');
    setValidityPeriod('');
  };
  
  // Handle close modals
  const handleCloseCertificateModal = () => {
    setShowCertificateTypeModal(false);
    setShowCertificateForm(false);
    resetForm();
  };

  // Load certificates from Firebase
  useEffect(() => {
    if (user && user.uid) {
      loadCertificates();
    }
  }, [user]);

  const loadCertificates = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log(' Loading certificates for specialist:', user.uid);
      const specialistCertificates = await databaseService.getCertificatesBySpecialist(user.uid);
      console.log('📋 Raw certificates from database:', specialistCertificates);
      
      // Convert status for display (patient details are already included in the new structure)
      const enrichedCertificates = specialistCertificates.map((cert) => ({
        ...cert,
        // Convert status for display
        displayStatus: cert.status === 'active' ? 'Valid' : 'Expired'
      }));
      
      console.log('👥 Enriched certificates:', enrichedCertificates);
      
      // Validate certificates data
      const validCertificates = dataValidation.validateArray(enrichedCertificates, dataValidation.isValidCertificate);
      console.log(' Valid certificates after validation:', validCertificates.length);
      setCertificates(validCertificates);
    } catch (error) {
      console.error('Error loading certificates:', error);
      setError('Failed to load certificates. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCertificates();
    setRefreshing(false);
  };

  const handleRetry = () => {
    setError(null);
    loadCertificates();
  };

  // Performance optimization: memoize filtered and sorted certificates
  const filteredCertificates = useDeepMemo(() => {
    return certificates
      .filter((cert) => {
        const patientName = cert.patientDetails ? 
          `${cert.patientDetails.firstName || ''} ${cert.patientDetails.lastName || ''}`.trim() :
          (cert as any).patientName || '';
        const matchesSearch =
          cert.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
          patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cert.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus =
          statusFilter === 'all' || (cert as any).displayStatus.toLowerCase() === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'date':
            return new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime();
          case 'type':
            return a.type.localeCompare(b.type);
          case 'patient':
            const aPatientName = a.patientDetails ? 
              `${a.patientDetails.firstName || ''} ${a.patientDetails.lastName || ''}`.trim() :
              (a as any).patientName || '';
            const bPatientName = b.patientDetails ? 
              `${b.patientDetails.firstName || ''} ${b.patientDetails.lastName || ''}`.trim() :
              (b as any).patientName || '';
            return aPatientName.localeCompare(bPatientName);
          case 'validUntil':
            return new Date(b.expiryDate || '').getTime() - new Date(a.expiryDate || '').getTime();
          default:
            return 0;
        }
      });
  }, [certificates, searchQuery, statusFilter, sortBy]);

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

  const renderSortDropdown = () => {
    if (!showSort) return null;
    return (
      <Pressable
        style={styles.dropdownBackdrop}
        onPress={() => setShowSort(false)}
      >
        <View style={[styles.sortDropdown, {
          top: sortDropdownPos.top,
          right: sortDropdownPos.right
        }]}
        >
          {SORT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.sortDropdownItem,
                sortBy === option.key && styles.sortDropdownActiveItem,
              ]}
              onPress={() => {
                setSortBy(option.key);
                setShowSort(false);
              }}
            >
              <Text
                style={[
                  styles.sortDropdownText,
                  sortBy === option.key && styles.sortDropdownActiveText,
                ]}
              >
                {option.label}
              </Text>
              {sortBy === option.key && (
                <Check size={16} color="#1E40AF" style={{ marginLeft: 6 }} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    );
  };

  const handleShowSort = () => {
    if (sortBtnRef.current) {
      sortBtnRef.current.measureInWindow((x: number, y: number, w: number, h: number) => {
        setSortDropdownPos({
          top: y + h - 50,
          right: screenWidth - (x + w),
        });
        setShowSort(true);
      });
    } else {
      setShowSort(true);
    }
  };

  const renderCertificateCard = (certificate: Certificate) => {
    const statusColors = getStatusColors((certificate as any).displayStatus || certificate.status);
    return (
      <TouchableOpacity
        key={certificate.id}
        style={[styles.certificateCard, { width: cardWidth }]}
        activeOpacity={0.7}
        onPress={() => {
          // Route to the appropriate e-certificate based on type
          let route = '/e-certificate-fit-to-work'; // default fallback
          
          if (certificate.type === 'Fit to Work Certificate') {
            route = '/e-certificate-fit-to-work';
          } else if (certificate.type === 'Medical/Sickness Certificate') {
            route = '/e-certificate-medical-sickness';
          } else if (certificate.type === 'Fit to Travel Certificate') {
            route = '/e-certificate-fit-to-travel';
          }
          
          // Pass the consultation ID, certificate ID, and patient ID for proper data loading
          // The consultationId is the entry key from patientMedicalHistory
          router.push(`${route}?id=${certificate.consultationId}&certificateId=${certificate.id}&patientId=${certificate.patientId}` as any);
        }}
      >
                  <View style={styles.pdfThumbnail}>
            <View style={styles.pdfPages}>
              <View style={[styles.pdfPage, styles.pdfPageMain]} />
              <View style={[styles.pdfPage, styles.pdfPageShadow]} />
            </View>
            <View style={styles.statusLabel}>
              <View style={styles.statusBadge}>
                {((certificate as any).displayStatus || certificate.status) === 'Valid' ? (
                  <CheckCircle size={14} color="#6B7280" />
                ) : (
                  <FileText size={14} color="#6B7280" />
                )}
                <Text style={styles.statusLabelText}>
                  {(certificate as any).displayStatus || certificate.status}
                </Text>
              </View>
            </View>
          <View
            style={[
              styles.certificateIconOverlay,
              { backgroundColor: '#1E40AF15' },
            ]}
          >
            <FileText size={16} color="#1E40AF" />
          </View>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.certificateType} numberOfLines={2}>
            {certificate.type || 'Medical Certificate'}
          </Text>
          <Text style={styles.patientLabel} numberOfLines={1}>
            Patient
          </Text>
          <Text style={styles.doctorName} numberOfLines={1}>
            {certificate.patientDetails ? 
              `${certificate.patientDetails.firstName || ''} ${certificate.patientDetails.lastName || ''}`.trim() || 'Unknown Patient' :
              (certificate as any).patientName || 'Unknown Patient'
            }
          </Text>
          <Text style={styles.issuedDate}>
            {certificate.issueDate ? new Date(certificate.issueDate).toLocaleDateString() : 'Date not specified'}
          </Text>
          <View style={styles.gridActions}>
            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={() => {
                // Route to the appropriate e-certificate based on type
                let route = '/e-certificate-fit-to-work'; // default fallback
                
                if (certificate.type === 'Fit to Work Certificate') {
                  route = '/e-certificate-fit-to-work';
                } else if (certificate.type === 'Medical/Sickness Certificate' || certificate.type === 'Medical Certificate') {
                  route = '/e-certificate-medical-sickness';
                } else if (certificate.type === 'Fit to Travel Certificate') {
                  route = '/e-certificate-fit-to-travel';
                }
                
                // Pass the consultation ID, certificate ID, and patient ID for proper data loading
                // The consultationId is the entry key from patientMedicalHistory
                router.push(`${route}?id=${certificate.consultationId}&certificateId=${certificate.id}&patientId=${certificate.patientId}` as any);
              }}
            >
              <Eye size={20} color="#374151" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton}>
              <Download size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <FileText size={48} color="#9CA3AF" />
      </View>
      <Text style={styles.emptyTitle}>
        {'No certificates issued yet'}
      </Text>
      <Text style={styles.emptyDescription}>
        {'Certificates you issue for patients will appear here.'}
      </Text>
    </View>
  );

  const renderGrid = () => {
    const rows = [];
    for (let i = 0; i < filteredCertificates.length; i += 2) {
      const leftCard = filteredCertificates[i];
      const rightCard = filteredCertificates[i + 1];
      rows.push(
        <View key={i} style={styles.gridRow}>
          {renderCertificateCard(leftCard)}
          {rightCard && renderCertificateCard(rightCard)}
        </View>
      );
    }
    return rows;
  };

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      {/* Header */}
              <SpecialistHeader 
          title="Certificates Issued" 
          onNotificationPress={handleOpenNotifications}
          notificationCount={unreadCount}
        />
      {/* Filters Container */}
      <View style={styles.filtersContainer}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputContainer}>
            <Search size={18} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search certificates"
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={handleShowSort}
            ref={sortBtnRef}
          >
            <Filter size={22} color="#6B7280" />
            <ChevronDown size={20} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowCertificateTypeModal(true)}
          >
            <Plus size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.filtersBarRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContent}
          >
            <View style={styles.filtersLeft}>
              {FILTERS.map((filter) => (
                <TouchableOpacity
                  key={filter.value}
                  style={[
                    styles.filterButton,
                    statusFilter === filter.value && styles.activeFilterButton,
                  ]}
                  onPress={() => setStatusFilter(filter.value)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      statusFilter === filter.value && styles.activeFilterText,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
        {renderSortDropdown()}
      </View>
      {/* Certificates List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.certificatesList}>
          {loading ? (
            <LoadingState
              message="Loading certificates..."
              variant="inline"
              size="large"
            />
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : filteredCertificates.length === 0 ? (
            renderEmptyState()
          ) : (
            renderGrid()
          )}
        </View>
      </ScrollView>
      
      {/* === GLOBAL NOTIFICATION MODAL === */}
      <GlobalNotificationModal
        visible={showNotificationModal}
        onClose={handleCloseNotificationModal}
        userRole="specialist"
      />
      
      {/* === CERTIFICATE TYPE SELECTION MODAL === */}
      <Modal
        visible={showCertificateTypeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCertificateTypeModal(false)}
      >
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <Pressable 
          style={styles.modalBackdrop} 
          onPress={() => setShowCertificateTypeModal(false)}
        >
          <BlurView intensity={22} style={styles.blurView}>
            <View style={styles.modalBackdropOverlay} />
          </BlurView>
        </Pressable>
        <View style={styles.bottomSheetContainer}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.bottomSheetContent}>
            {/* Header */}
            <View style={styles.bottomSheetHeader}>
              <View style={styles.bottomSheetHeaderLeft}>
                <View style={styles.certificateAvatar}>
                  <FileText size={20} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.bottomSheetTitle}>
                    {showCertificateForm ? selectedCertificateType : 'Create Certificate'}
                  </Text>
                  <Text style={styles.bottomSheetSubtitle}>
                    {showCertificateForm ? 'Fill in certificate details' : 'Select certificate type'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={handleCloseCertificateModal}
              >
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            {/* Divider */}
            <View style={styles.bottomSheetDivider} />
            
            {/* Show either type selection or form */}
            {!showCertificateForm ? (
              /* Certificate Type Options */
              <View style={styles.certificateOptionsContainer}>
              <TouchableOpacity
                style={styles.certificateOption}
                onPress={() => handleCertificateTypeSelect('Fit to Work Certificate')}
                activeOpacity={0.7}
              >
                <View style={styles.certificateOptionContent}>
                  <View style={styles.certificateIconContainer}>
                    <FileText size={24} color="#1E40AF" />
                  </View>
                  <View style={styles.certificateTextContainer}>
                    <Text style={styles.certificateOptionTitle}>Fit to Work Certificate</Text>
                    <Text style={styles.certificateOptionDescription}>
                      Certify that a person is fit to work
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.certificateOption}
                onPress={() => handleCertificateTypeSelect('Medical/Sickness Certificate')}
                activeOpacity={0.7}
              >
                <View style={styles.certificateOptionContent}>
                  <View style={styles.certificateIconContainer}>
                    <FileText size={24} color="#1E40AF" />
                  </View>
                  <View style={styles.certificateTextContainer}>
                    <Text style={styles.certificateOptionTitle}>Medical/Sickness Certificate</Text>
                    <Text style={styles.certificateOptionDescription}>
                      Certify medical condition or sickness
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.certificateOption}
                onPress={() => handleCertificateTypeSelect('Fit to Travel Certificate')}
                activeOpacity={0.7}
              >
                <View style={styles.certificateOptionContent}>
                  <View style={styles.certificateIconContainer}>
                    <FileText size={24} color="#1E40AF" />
                  </View>
                  <View style={styles.certificateTextContainer}>
                    <Text style={styles.certificateOptionTitle}>Fit to Travel Certificate</Text>
                    <Text style={styles.certificateOptionDescription}>
                      Certify that a person is fit to travel
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
            ) : (
              /* Certificate Form */
              <ScrollView 
                style={styles.formContainer}
                showsVerticalScrollIndicator={false}
              >
                {/* Patient Selection */}
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Select Patient *</Text>
                  {loadingPatients ? (
                    <Text style={styles.loadingTextForm}>Loading patients...</Text>
                  ) : patients.length === 0 ? (
                    <TouchableOpacity style={styles.dropdownButton} disabled>
                      <Text style={styles.dropdownPlaceholder}>
                        No patients found. Patients must have appointments with you first.
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.dropdownButton}
                      onPress={() => setShowPatientDropdown(!showPatientDropdown)}
                    >
                      <View style={styles.dropdownContent}>
                        {selectedPatient ? (
                          <View style={styles.selectedPatientInfo}>
                            <Text style={styles.dropdownText}>
                              {selectedPatient.firstName} {selectedPatient.lastName}
                            </Text>
                            <Text style={styles.dropdownSubtext}>
                              {selectedPatient.age > 0 ? `${selectedPatient.age} yrs` : 'Age N/A'} • {selectedPatient.gender} • {selectedPatient.contactNumber}
                            </Text>
                          </View>
                        ) : (
                          <Text style={styles.dropdownPlaceholder}>Select a patient</Text>
                        )}
                        <ChevronDown size={20} color="#6B7280" />
                      </View>
                    </TouchableOpacity>
                  )}
                  
                  {/* Dropdown List */}
                  {showPatientDropdown && patients.length > 0 && (
                    <View style={styles.dropdownList}>
                      <ScrollView style={styles.dropdownScrollView} nestedScrollEnabled>
                        {patients.map((patient) => (
                          <TouchableOpacity
                            key={patient.id}
                            style={[
                              styles.dropdownItem,
                              selectedPatient?.id === patient.id && styles.dropdownItemSelected
                            ]}
                            onPress={() => {
                              setSelectedPatient(patient);
                              setShowPatientDropdown(false);
                            }}
                          >
                            <View style={styles.dropdownItemContent}>
                              <Text style={styles.dropdownItemName}>
                                {patient.firstName} {patient.lastName}
                              </Text>
                              <Text style={styles.dropdownItemDetails}>
                                {patient.age > 0 ? `${patient.age} yrs` : 'Age N/A'} • {patient.gender} • {patient.contactNumber}
                              </Text>
                            </View>
                            {selectedPatient?.id === patient.id && (
                              <Check size={20} color="#1E40AF" />
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Diagnosis */}
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Diagnosis *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Enter diagnosis"
                    placeholderTextColor="#9CA3AF"
                    value={diagnosis}
                    onChangeText={setDiagnosis}
                  />
                </View>

                {/* Description */}
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Medical Findings/Description *</Text>
                  <TextInput
                    style={[styles.formInput, styles.formTextArea]}
                    placeholder="Enter medical findings or description"
                    placeholderTextColor="#9CA3AF"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                {/* Examination Date */}
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Examination Date</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="YYYY-MM-DD (optional)"
                    placeholderTextColor="#9CA3AF"
                    value={examinationDate}
                    onChangeText={setExaminationDate}
                  />
                </View>

                {/* Type-specific fields */}
                {selectedCertificateType === 'Fit to Work Certificate' && (
                  <>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Fitness Statement *</Text>
                      <TextInput
                        style={[styles.formInput, styles.formTextArea]}
                        placeholder="e.g., Patient is medically fit to return to work"
                        placeholderTextColor="#9CA3AF"
                        value={fitnessStatement}
                        onChangeText={setFitnessStatement}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Work Restrictions</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="e.g., None, Light duty only"
                        placeholderTextColor="#9CA3AF"
                        value={workRestrictions}
                        onChangeText={setWorkRestrictions}
                      />
                    </View>
                  </>
                )}

                {selectedCertificateType === 'Medical/Sickness Certificate' && (
                  <>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Reason for Unfitness *</Text>
                      <TextInput
                        style={[styles.formInput, styles.formTextArea]}
                        placeholder="Describe the reason for medical unfitness"
                        placeholderTextColor="#9CA3AF"
                        value={reasonForUnfitness}
                        onChangeText={setReasonForUnfitness}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Unfit Period Start</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#9CA3AF"
                        value={unfitPeriodStart}
                        onChangeText={setUnfitPeriodStart}
                      />
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Unfit Period End</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#9CA3AF"
                        value={unfitPeriodEnd}
                        onChangeText={setUnfitPeriodEnd}
                      />
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Medical Advice</Text>
                      <TextInput
                        style={[styles.formInput, styles.formTextArea]}
                        placeholder="Enter medical advice"
                        placeholderTextColor="#9CA3AF"
                        value={medicalAdvice}
                        onChangeText={setMedicalAdvice}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Follow-up Date</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="YYYY-MM-DD (optional)"
                        placeholderTextColor="#9CA3AF"
                        value={followUpDate}
                        onChangeText={setFollowUpDate}
                      />
                    </View>
                  </>
                )}

                {selectedCertificateType === 'Fit to Travel Certificate' && (
                  <>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Travel Fitness Statement *</Text>
                      <TextInput
                        style={[styles.formInput, styles.formTextArea]}
                        placeholder="e.g., Patient is medically fit to travel"
                        placeholderTextColor="#9CA3AF"
                        value={travelFitnessStatement}
                        onChangeText={setTravelFitnessStatement}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Mode of Travel</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="e.g., Air, Sea, Land"
                        placeholderTextColor="#9CA3AF"
                        value={travelMode}
                        onChangeText={setTravelMode}
                      />
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Destination</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="e.g., International, Domestic"
                        placeholderTextColor="#9CA3AF"
                        value={destination}
                        onChangeText={setDestination}
                      />
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Travel Date</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#9CA3AF"
                        value={travelDate}
                        onChangeText={setTravelDate}
                      />
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Special Conditions</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="e.g., None, Wheelchair assistance"
                        placeholderTextColor="#9CA3AF"
                        value={specialConditions}
                        onChangeText={setSpecialConditions}
                      />
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Validity Period</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="e.g., 30 days from issue"
                        placeholderTextColor="#9CA3AF"
                        value={validityPeriod}
                        onChangeText={setValidityPeriod}
                      />
                    </View>
                  </>
                )}

                {/* Action Buttons */}
                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => setShowCertificateForm(false)}
                  >
                    <Text style={styles.backButtonText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.continueButton}
                    onPress={handleContinueToSignature}
                  >
                    <Text style={styles.continueButtonText}>Continue to Sign</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12,
    paddingTop: 0,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 36,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    paddingVertical: 0,
  },
  filtersBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
    position: 'relative',
    zIndex: 1,
  },
  filtersContent: {
    gap: 10,
    alignItems: 'center',
    paddingVertical: 2,
  },
  filtersLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 6,
  },
  activeFilterButton: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  filterText: {
    fontSize: 14,
    color: '#6B7280',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  sortButton: {
    height: 48, // Match search bar height (14 padding top + 14 padding bottom + minHeight 36 = ~48)
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    gap: 4,
  },
  addButton: {
    height: 48,
    width: 48,
    borderRadius: 10,
    backgroundColor: '#1E40AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  certificatesList: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  certificateCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'visible',
  },
  pdfThumbnail: {
    position: 'relative',
    height: 120,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfPages: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  pdfPage: {
    position: 'absolute',
    width: '80%',
    height: '90%',
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pdfPageMain: {
    top: 0,
    left: '10%',
    zIndex: 2,
    padding: 8,
  },
  pdfPageShadow: {
    top: 4,
    left: '15%',
    zIndex: 1,
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  pdfHeader: {
    marginBottom: 8,
  },
  pdfHeaderLine: {
    height: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 4,
    borderRadius: 1,
  },
  pdfContent: {
    flex: 1,
  },
  pdfLine: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 4,
    borderRadius: 0.5,
  },
  certificateIconOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusLabel: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 99,
    marginTop: 0,
    marginRight: 0,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 58,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusIcon: {
    marginRight: 0,
  },
  statusLabelText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    letterSpacing: 0.1,
  },
  cardContent: {
    alignItems: 'flex-start',
  },
  certificateType: {
    fontSize:16,
    color: '#1F2937',
    marginBottom: 4,
    lineHeight: 18,
  },
  patientLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 2,
    fontFamily: 'Inter-Regular',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  doctorName: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  issuedDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  gridActions: {
    flexDirection: 'row',
    marginTop: 16,
    alignSelf: 'stretch',
    justifyContent: 'space-between',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#1E40AF',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginLeft: 4,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'center',
    marginRight: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
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
  // Dropdown (improved)
  dropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 1000,
  },
  sortDropdown: {
    position: 'absolute',
    minWidth: 170,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 8,
    zIndex: 1100,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  sortDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  sortDropdownText: {
    fontSize: 15,
    color: '#374151',
  },
  sortDropdownActiveItem: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  sortDropdownActiveText: {
    color: '#1E40AF',
    fontFamily: 'Inter-Medium',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#DC2626',
    textAlign: 'center',
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
  // Bottom Sheet Modal Styles
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  blurView: {
    flex: 1,
  },
  modalBackdropOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.34)',
  },
  bottomSheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    zIndex: 2,
  },
  safeArea: {
    width: '100%',
  },
  bottomSheetContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    minHeight: 400,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  bottomSheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  certificateAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  bottomSheetSubtitle: {
    fontSize: 13,
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
  },
  bottomSheetDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 16,
  },
  certificateOptionsContainer: {
    gap: 12,
  },
  certificateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  certificateOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  certificateIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  certificateTextContainer: {
    flex: 1,
  },
  certificateOptionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  certificateOptionDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 18,
  },
  // Form styles
  formContainer: {
    maxHeight: 500,
    paddingBottom: 20,
  },
  formField: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  formTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dropdownButton: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedPatientInfo: {
    flex: 1,
  },
  dropdownText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  dropdownSubtext: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  dropdownPlaceholder: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  dropdownList: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownScrollView: {
    maxHeight: 250,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  dropdownItemContent: {
    flex: 1,
  },
  dropdownItemName: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  dropdownItemDetails: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  loadingTextForm: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    padding: 16,
    textAlign: 'center',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingBottom: 20,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  backButtonText: {
    color: '#374151',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  continueButton: {
    flex: 1,
    backgroundColor: '#1E40AF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
});
