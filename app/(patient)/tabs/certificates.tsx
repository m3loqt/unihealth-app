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
} from 'react-native';
import {
  FileText, Search, Shield, Activity, Syringe, Heart, Stethoscope,
  Filter, ChevronDown, Check, X, Clock, CheckCircle, FileSignature
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/auth/useAuth';
import { useCertificateSignature } from '@/hooks/ui/useSignatureManager';
import { databaseService, Certificate } from '@/services/database/firebase';
import { safeDataAccess } from '@/utils/safeDataAccess';
import LoadingState from '@/components/ui/LoadingState';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { dataValidation } from '@/utils/dataValidation';
import { useDeepMemo } from '@/utils/performance';

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
  { key: 'doctor', label: 'By Doctor' },
  { key: 'validUntil', label: 'Valid Until' },
];

const VIEW_OPTIONS = [
  { key: 'certificates', label: 'Medical Certificates', icon: FileText },
  { key: 'prescriptions', label: 'E-Prescriptions', icon: FileSignature },
];

export default function CertificatesScreen() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showSort, setShowSort] = useState(false);
  const [sortDropdownPos, setSortDropdownPos] = useState({ top: 0, right: 0 });
  const sortBtnRef = useRef<View>(null);
  const [userCertificates, setUserCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'certificates' | 'prescriptions'>('certificates');
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [viewDropdownPos, setViewDropdownPos] = useState({ top: 0, right: 0 });
  const viewBtnRef = useRef<View>(null);
  const [ePrescriptions, setEPrescriptions] = useState<any[]>([]);

  // Header initials for logged in user
  const userInitials = (() => {
    const fullName = safeDataAccess.getUserFullName(user, user?.email || 'User');
    return fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || 'U';
  })();

  // Load certificates and e-prescriptions from database
  useEffect(() => {
    if (user && user.uid) {
      loadCertificates();
      loadEPrescriptions();
    }
  }, [user]);

  const loadCertificates = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use the new certificate structure
      const certificates = await databaseService.getCertificatesByPatientNew(user.uid);
      
      console.log('📋 Loaded certificates:', certificates);
      
      // Validate certificates data
      const validCertificates = dataValidation.validateArray(certificates, dataValidation.isValidCertificate);
      
      console.log('✅ Valid certificates:', validCertificates.length);
      setUserCertificates(validCertificates);
      
    } catch (error) {
      console.error('Error loading certificates:', error);
      setError('Failed to load certificates. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadEPrescriptions = async () => {
    try {
      // Get all appointments and referrals for the patient
      const [appointments, referrals] = await Promise.all([
        databaseService.getAppointmentsByPatient(user.uid),
        databaseService.getReferralsByPatient(user.uid)
      ]);
      
      const ePrescriptionData = [];
      
      // Process appointments
      for (const appointment of appointments) {
        // Only process completed appointments
        if (appointment.status?.toLowerCase() === 'completed') {
          try {
            // Try to get medical history for this appointment
            let medicalHistory = null;
            let prescriptions = [];
            
            if (appointment.appointmentConsultationId) {
              // Try to get medical history by consultation ID
              medicalHistory = await databaseService.getDocument(
                `patientMedicalHistory/${user.uid}/entries/${appointment.appointmentConsultationId}`
              );
              prescriptions = medicalHistory?.prescriptions || [];
            }
            
            // If no prescriptions from medical history, try to get prescriptions by appointment ID
            if (!prescriptions.length && appointment.id) {
              prescriptions = await databaseService.getPrescriptionsByAppointment(appointment.id);
            }
            
            // If we found prescriptions, create an e-prescription entry
            if (prescriptions.length > 0) {
              ePrescriptionData.push({
                id: `eprescription_appt_${appointment.id}`,
                type: 'E-Prescription',
                consultationId: appointment.appointmentConsultationId || appointment.id,
                issueDate: appointment.appointmentDate,
                status: 'Valid',
                doctorDetails: {
                  firstName: appointment.doctorFirstName || 'Dr.',
                  lastName: appointment.doctorLastName || 'Unknown'
                },
                specialistId: appointment.doctorId,
                description: `Prescription from ${appointment.clinicName || 'Clinic'}`,
                prescriptions: prescriptions,
                appointmentId: appointment.id,
                clinicName: appointment.clinicName,
                source: 'appointment'
              });
            }
          } catch (error) {
            console.log(`Could not load prescriptions for appointment ${appointment.id}:`, error);
          }
        }
      }
      
      // Process referrals
      for (const referral of referrals) {
        // Only process completed referrals
        if (referral.status?.toLowerCase() === 'completed') {
          try {
            let prescriptions = [];
            
            // Try to get prescriptions from referral consultation ID
            if (referral.referralConsultationId) {
              try {
                const medicalHistory = await databaseService.getDocument(
                  `patientMedicalHistory/${user.uid}/entries/${referral.referralConsultationId}`
                );
                prescriptions = medicalHistory?.prescriptions || [];
              } catch (error) {
                console.log(`Could not load medical history for referral ${referral.id}:`, error);
              }
            }
            
            // If no prescriptions from medical history, try to get prescriptions by clinic appointment ID
            if (!prescriptions.length && referral.clinicAppointmentId) {
              try {
                prescriptions = await databaseService.getPrescriptionsByAppointment(referral.clinicAppointmentId);
              } catch (error) {
                console.log(`Could not load prescriptions by appointment ID for referral ${referral.id}:`, error);
              }
            }
            
            // If we found prescriptions, create an e-prescription entry
            if (prescriptions.length > 0) {
              ePrescriptionData.push({
                id: `eprescription_ref_${referral.id}`,
                type: 'E-Prescription',
                consultationId: referral.referralConsultationId || referral.clinicAppointmentId || referral.id,
                issueDate: referral.appointmentDate,
                status: 'Valid',
                doctorDetails: {
                  firstName: referral.assignedSpecialistFirstName || 'Dr.',
                  lastName: referral.assignedSpecialistLastName || 'Unknown'
                },
                specialistId: referral.assignedSpecialistId,
                description: `Prescription from referral to ${referral.assignedSpecialistFirstName || ''} ${referral.assignedSpecialistLastName || ''}`.trim() || 'Specialist',
                prescriptions: prescriptions,
                referralId: referral.id,
                clinicName: referral.referringClinicName,
                source: 'referral'
              });
            }
          } catch (error) {
            console.log(`Could not load prescriptions for referral ${referral.id}:`, error);
          }
        }
      }
      
      console.log('💊 Loaded e-prescriptions from appointments and referrals:', ePrescriptionData);
      setEPrescriptions(ePrescriptionData);
      
    } catch (error) {
      console.error('Error loading e-prescriptions:', error);
    }
  };

  const handleRetry = () => {
    setError(null);
    loadCertificates();
  };

  // Performance optimization: memoize filtered and sorted certificates/e-prescriptions
  const filteredData = useDeepMemo(() => {
    const data = currentView === 'certificates' ? userCertificates : ePrescriptions;
    
    return data
      .filter((item) => {
        const doctorName = item.doctorDetails ? 
          `Dr. ${item.doctorDetails.firstName || ''} ${item.doctorDetails.lastName || ''}`.trim() :
          item.specialistId || '';
        const matchesSearch =
          item.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus =
          statusFilter === 'all' || 
          (statusFilter === 'valid' && item.status?.toLowerCase() === 'active') ||
          item.status?.toLowerCase() === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'date':
            return new Date(b.issueDate || '').getTime() - new Date(a.issueDate || '').getTime();
          case 'type':
            return (a.type || '').localeCompare(b.type || '');
          case 'doctor':
            const aDoctorName = a.doctorDetails ? 
              `Dr. ${a.doctorDetails.firstName || ''} ${a.doctorDetails.lastName || ''}`.trim() :
              a.specialistId || '';
            const bDoctorName = b.doctorDetails ? 
              `Dr. ${b.doctorDetails.firstName || ''} ${b.doctorDetails.lastName || ''}`.trim() :
              b.specialistId || '';
            return aDoctorName.localeCompare(bDoctorName);
          case 'validUntil':
            return new Date(b.expiryDate || '').getTime() - new Date(a.expiryDate || '').getTime();
          default:
            return 0;
        }
      });
  }, [userCertificates, ePrescriptions, currentView, searchQuery, statusFilter, sortBy]);

  const getStatusColors = (status: string) => {
    return {
      bg: '#F9FAFB',
      text: '#374151',
      border: '#D1D5DB',
    };
  };

  // --- Improved Sort Dropdown ---
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
        }]}>
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

  // --- View Dropdown ---
  const renderViewDropdown = () => {
    if (!showViewDropdown) return null;
    return (
      <Pressable
        style={styles.dropdownBackdrop}
        onPress={() => setShowViewDropdown(false)}
      >
        <View style={[styles.viewDropdown, {
          top: viewDropdownPos.top,
          right: viewDropdownPos.right
        }]}>
          {VIEW_OPTIONS.map((option) => {
            const IconComponent = option.icon;
            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.viewDropdownItem,
                  currentView === option.key && styles.viewDropdownActiveItem,
                ]}
                onPress={() => {
                  setCurrentView(option.key as 'certificates' | 'prescriptions');
                  setShowViewDropdown(false);
                }}
              >
                <IconComponent size={18} color={currentView === option.key ? "#1E40AF" : "#6B7280"} />
                <Text
                  style={[
                    styles.viewDropdownText,
                    currentView === option.key && styles.viewDropdownActiveText,
                  ]}
                >
                  {option.label}
                </Text>
                {currentView === option.key && (
                  <Check size={16} color="#1E40AF" style={{ marginLeft: 6 }} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </Pressable>
    );
  };

  // Handle dropdown position calculation
  const handleShowSort = () => {
    if (sortBtnRef.current) {
      sortBtnRef.current.measureInWindow((x, y, w, h) => {
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

  const handleShowViewDropdown = () => {
    if (viewBtnRef.current) {
      viewBtnRef.current.measureInWindow((x, y, w, h) => {
        setViewDropdownPos({
          top: y + h - 50,
          right: screenWidth - (x + w),
        });
        setShowViewDropdown(true);
      });
    } else {
      setShowViewDropdown(true);
    }
  };

  const renderPDFThumbnail = (certificate: Certificate) => {
    const statusColors = getStatusColors(certificate.status);
    return (
      <View style={styles.pdfThumbnail}>
        <View style={styles.pdfPages}>
          <View style={[styles.pdfPage, styles.pdfPageMain]}>
            <View style={styles.pdfHeader}>
              <View style={styles.pdfHeaderLine} />
              <View style={[styles.pdfHeaderLine, { width: '60%' }]} />
            </View>
            <View style={styles.pdfContent}>
              <View style={styles.pdfLine} />
              <View style={[styles.pdfLine, { width: '80%' }]} />
              <View style={[styles.pdfLine, { width: '90%' }]} />
              <View style={[styles.pdfLine, { width: '70%' }]} />
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
          <View style={[styles.pdfPage, styles.pdfPageShadow]} />
        </View>
        <View
          style={[
            styles.statusLabel,
            {
              backgroundColor: statusColors.bg,
              borderColor: statusColors.border,
              zIndex: 99,
            },
          ]}
        >
          <Text style={styles.statusLabelText}>
            {certificate.status?.toLowerCase() === 'active' ? 'Valid' : certificate.status}
          </Text>
        </View>
      </View>
    );
  };

  const renderCertificateCard = (item: any) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.certificateCard, { width: cardWidth }]}
      activeOpacity={0.7}
      onPress={() => {
        if (currentView === 'prescriptions') {
          // Route to e-prescription page using the appropriate ID based on source
          let ePrescriptionId = item.consultationId;
          
          if (item.source === 'appointment' && item.appointmentId) {
            ePrescriptionId = item.appointmentId;
          } else if (item.source === 'referral' && item.referralId) {
            ePrescriptionId = item.referralId;
          }
          
          router.push(`/e-prescription?id=${ePrescriptionId}` as any);
        } else {
          // Route to the appropriate e-certificate based on type
          let route = '/e-certificate-fit-to-work'; // default fallback
          
          if (item.type === 'Fit to Work Certificate') {
            route = '/e-certificate-fit-to-work';
          } else if (item.type === 'Medical/Sickness Certificate' || item.type === 'Medical Certificate') {
            route = '/e-certificate-medical-sickness';
          } else if (item.type === 'Fit to Travel Certificate') {
            route = '/e-certificate-fit-to-travel';
          }
          // Pass the consultation ID and certificate ID for proper data loading
          router.push(route + `?id=${item.consultationId}&certificateId=${item.id}` as any);
        }
      }}
    >
      {renderPDFThumbnail(item)}
      <View style={styles.cardContent}>
        <Text style={styles.certificateType} numberOfLines={2}>
          {item.type || 'Medical Certificate'}
        </Text>
        <Text style={styles.issuedByLabel} numberOfLines={1}>
          Issued by
        </Text>
        <Text style={styles.doctorName} numberOfLines={1}>
          {item.doctorDetails ? 
            `Dr. ${item.doctorDetails.firstName || ''} ${item.doctorDetails.lastName || ''}`.trim() || 'Dr. Unknown Doctor' :
            item.specialistId || 'Dr. Unknown Doctor'
          }
        </Text>
        <Text style={styles.issuedDate}>
          {item.issueDate ? new Date(item.issueDate).toLocaleDateString() : 'Date not specified'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    const isPrescriptions = currentView === 'prescriptions';
    const IconComponent = isPrescriptions ? FileSignature : FileText;
    
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}>
          <IconComponent size={48} color="#9CA3AF" />
        </View>
        <Text style={styles.emptyTitle}>
          {loading ? `Loading ${isPrescriptions ? 'e-prescriptions' : 'certificates'}...` : `No ${isPrescriptions ? 'e-prescriptions' : 'certificates'} found`}
        </Text>
        <Text style={styles.emptyDescription}>
          {loading 
            ? `Please wait while we load your ${isPrescriptions ? 'e-prescriptions' : 'certificates'}...`
            : `Your ${isPrescriptions ? 'e-prescriptions' : 'medical certificates'} will appear here once they're issued by healthcare providers.`
          }
        </Text>
      </View>
    );
  };

  const renderGrid = () => {
    const rows = [];
    for (let i = 0; i < filteredData.length; i += 2) {
      const leftCard = filteredData[i];
      const rightCard = filteredData[i + 1];
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
    <SafeAreaView style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            style={styles.titleDropdown}
            onPress={handleShowViewDropdown}
            ref={viewBtnRef}
          >
            <Text style={styles.headerTitle}>
              {currentView === 'certificates' ? 'Medical Certificates' : 'E-Prescriptions'}
            </Text>
            <ChevronDown size={20} color="#1F2937" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={styles.profileButton}
          onPress={() => router.push('/(patient)/tabs/profile')}
        >
          <Text style={styles.profileInitialsText}>{userInitials}</Text>
        </TouchableOpacity>
      </View>

      {/* Filters Container */}
      <View style={styles.filtersContainer}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputContainer}>
            <Search size={18} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={`Search ${currentView === 'certificates' ? 'certificates' : 'e-prescriptions'}`}
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
            <View style={styles.sortButtonContainer}>
              <Filter size={18} color="#6B7280" />
              <ChevronDown size={16} color="#6B7280" />
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.filtersBarRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContent}
          >
            <View style={styles.filtersLeft}>
              {FILTERS.map((filter) => {
                const getFilterIcon = (filterValue: string) => {
                  switch (filterValue.toLowerCase()) {
                    case 'all':
                      return <Search size={14} color={statusFilter === filter.value ? "#FFFFFF" : "#6B7280"} />;
                    case 'valid':
                      return <CheckCircle size={14} color={statusFilter === filter.value ? "#FFFFFF" : "#6B7280"} />;
                    case 'expired':
                      return <X size={14} color={statusFilter === filter.value ? "#FFFFFF" : "#6B7280"} />;
                    default:
                      return null;
                  }
                };

                return (
                  <TouchableOpacity
                    key={filter.value}
                    style={[
                      styles.filterButton,
                      statusFilter === filter.value && styles.activeFilterButton,
                    ]}
                    onPress={() => setStatusFilter(filter.value)}
                  >
                    {getFilterIcon(filter.value)}
                    <Text
                      style={[
                        styles.filterText,
                        statusFilter === filter.value && styles.activeFilterText,
                      ]}
                    >
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
        {renderSortDropdown()}
        {renderViewDropdown()}
      </View>

      {/* Certificates List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }} // <--- Added here
      >
        <View style={styles.certificatesList}>
          {loading && error ? (
            <LoadingState message={error} />
          ) : filteredData.length === 0 ? renderEmptyState() : renderGrid()}
        </View>
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flex: 1,
  },
  titleDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  headerTitle: {
    fontSize: 24,
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  profileInitialsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
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
    paddingVertical: 0,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 64,
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
    gap: 8,
    alignItems: 'center',
    paddingVertical: 2,
  },
  filtersLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 6,
    gap: 6,
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
    height: 64, // Match search bar height
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -4 }], // Move up 4 pixels to align with search bar
  },
  sortButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 4,
    minHeight: 64,
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
  },
  statusLabelText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.1,
    color: '#374151',
  },
  cardContent: {
    alignItems: 'flex-start',
  },
  certificateType: {
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 4,
    lineHeight: 18,
  },
  issuedByLabel: {
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
  // View Dropdown Styles
  viewDropdown: {
    position: 'absolute',
    minWidth: 200,
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
  viewDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  viewDropdownText: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
  },
  viewDropdownActiveItem: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  viewDropdownActiveText: {
    color: '#1E40AF',
    fontFamily: 'Inter-Medium',
  },
});

 
 