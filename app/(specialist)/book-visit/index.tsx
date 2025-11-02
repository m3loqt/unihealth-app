import React, { useState, useEffect } from 'react';
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
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  ChevronLeft,
  Search,
  ChevronRight,
  Stethoscope,
  Syringe,
  HeartPulse,
  Shield,
  User,
  PlusCircle,
  Filter as FilterIcon,
  Check,
  Phone,
  Mail,
  AlertTriangle,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { databaseService, Clinic } from '../../../src/services/database/firebase';
import { safeDataAccess } from '../../../src/utils/safeDataAccess';
import { formatClinicAddress } from '../../../src/utils/formatting';

// Color constants (match booking process screens)
const BLUE = '#1E40AF';
const LIGHT_BLUE = '#DBEAFE';

// Map services to icons
const SERVICE_ICONS = {
  'General Medicine': Stethoscope,
  'Cardiology': HeartPulse,
  'Dermatology': Shield,
  'Pediatrics': User,
  'Orthopedics': Shield,
  'Neurology': HeartPulse,
  'Psychiatry': User,
  'Ophthalmology': Shield,
  'Dental': Stethoscope,
  'Gynecology': User,
  'Urology': Shield,
  'Oncology': HeartPulse,
  'Emergency Medicine': Shield,
  'Radiology': Shield,
  'Pathology': Stethoscope,
  'Anesthesiology': Shield,
  'Physical Therapy': User,
  'Nutrition': User,
  'Laboratory': Stethoscope,
  'Pharmacy': Syringe,
};

interface ClinicWithSpecialists extends Clinic {
  hasSpecialistDoctors?: boolean;
  contactNumber?: string;
}

export default function SpecialistBookVisitScreen() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  
  // Extract referral parameters
  const patientId = params.patientId as string;
  const patientFirstName = params.patientFirstName as string;
  const patientLastName = params.patientLastName as string;
  const originalAppointmentId = params.originalAppointmentId as string;
  const isReferral = params.isReferral as string;
  const reasonForReferral = params.reasonForReferral as string;
  const sourceType = params.sourceType as string; // New parameter for tracking source type
  const referralType = params.referralType as string; // New parameter for referral type (specialist/generalist)

  // Debug: Log all referral parameters
  console.log('🔍 Specialist book-visit index parameters:', {
    originalAppointmentId,
    sourceType,
    isReferral,
    referralType,
    patientId,
    patientFirstName,
    patientLastName,
    reasonForReferral
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClinic, setSelectedClinic] = useState<ClinicWithSpecialists | null>(null);
  const [clinics, setClinics] = useState<ClinicWithSpecialists[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadClinics();
  }, []);

  const loadClinics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let clinicsData;
      
      // Load clinics based on referral type
      if (referralType === 'generalist') {
        // For generalist referrals, get clinics with generalist doctors
        clinicsData = await databaseService.getClinicsWithGeneralistDoctors();
      } else {
        // For specialist referrals (default), get clinics with specialist doctors
        clinicsData = await databaseService.getClinics();
      }
      
      // Filter out clinics where the logged-in specialist is the only specialist available
      const filteredClinics = await Promise.all(
        clinicsData.map(async (clinic) => {
          if (referralType === 'generalist') {
            // For generalist referrals, just check if clinic has generalist doctors
            return clinic.hasGeneralistDoctors ? clinic : null;
          } else {
            // For specialist referrals, filter out clinics where logged-in specialist is the only one
            if (!clinic.hasSpecialistDoctors) {
              return null; // Skip clinics without specialists
            }
            
            // Get all specialists for this clinic
            const specialists = await databaseService.getSpecialistDoctorsByClinic(clinic.id);
            
            // Filter out the logged-in specialist
            const otherSpecialists = specialists.filter(specialist => specialist.id !== user?.uid);
            
            // Only include clinic if there are other specialists available
            if (otherSpecialists.length > 0) {
              return clinic;
            }
            
            return null;
          }
        })
      );
      
      // Remove null values and set the filtered clinics
      const validClinics = filteredClinics.filter(Boolean) as ClinicWithSpecialists[];
      setClinics(validClinics);
    } catch (error) {
      console.error('Failed to load clinics:', error);
      setError('Failed to load clinics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredClinics = clinics
    // Apply search filter (clinics are already filtered for available specialists in loadClinics)
    .filter(clinic =>
      clinic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (clinic.address && clinic.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (clinic.city && clinic.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (clinic.addressLine && clinic.addressLine.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (clinic.contactNumber && clinic.contactNumber.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      // Sort alphabetically by name
      return a.name.localeCompare(b.name);
    });

  const handleClinicSelect = (clinic: ClinicWithSpecialists) => {
    setSelectedClinic(clinic);
    console.log('🔍 Navigating to select-doctor with clinic:', clinic.name);
    console.log('🔍 Passing originalAppointmentId:', originalAppointmentId);
    console.log('🔍 Passing sourceType:', sourceType);
    
    router.push({
      pathname: '/(specialist)/book-visit/select-doctor',
      params: {
        clinicId: clinic.id,
        clinicName: clinic.name,
        patientId,
        patientFirstName,
        patientLastName,
        originalAppointmentId,
        isReferral,
        referralType,
        reasonForReferral,
        sourceType,
      }
    });
  };

  const formatClinicAddress = (clinic: ClinicWithSpecialists): string => {
    if (clinic.address && clinic.city && clinic.province) {
      return `${clinic.address}, ${clinic.city}, ${clinic.province}`;
    }
    if (clinic.addressLine) {
      return clinic.addressLine;
    }
    return 'Address not available';
  };

  const getClinicTypeDisplay = (type: string) => {
    const typeMap: { [key: string]: string } = {
      'hospital': 'Hospital',
      'private_clinic': 'Private Clinic',
      'specialty_clinic': 'Specialty Clinic',
      'medical_center': 'Medical Center',
    };
    return typeMap[type] || 'Clinic';
  };

  const getServiceIcon = (clinicType: string) => {
    const iconMap: { [key: string]: any } = {
      'hospital': Stethoscope,
      'private_clinic': Shield,
      'specialty_clinic': HeartPulse,
      'medical_center': User,
    };
    return iconMap[clinicType] || Stethoscope;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Clinic</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={styles.loadingText}>Loading clinics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Book Visit</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadClinics}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color={BLUE} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Visit</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarRoot}>
        <View style={styles.progressBarBg} />
        <View style={[styles.progressBarActive, { width: '17%' }]} />
        <View style={styles.progressDotsRow}>
          <View style={[styles.progressDotNew, styles.progressDotActiveNew, { left: 0 }]} />
          <View style={[styles.progressDotNew, styles.progressDotInactiveNew, { left: '45%' }]} />
          <View style={[styles.progressDotNew, styles.progressDotInactiveNew, { left: '90%' }]} />
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search a clinic"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>

      {/* Clinics List */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Clinics</Text>
          <Text style={styles.sectionSubtitle}>
            {filteredClinics.length} clinic{filteredClinics.length !== 1 ? 's' : ''} found
          </Text>
        </View>

        {filteredClinics.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Stethoscope size={48} color="#E5E7EB" />
            <Text style={styles.emptyText}>No clinics found</Text>
            <Text style={styles.emptySubtext}>
              Try adjusting your search terms
            </Text>
          </View>
        ) : (
          <View style={styles.clinicsList}>
            {filteredClinics.map((clinic) => {
              const IconComponent = getServiceIcon(clinic.type);
              return (
                <TouchableOpacity
                  key={clinic.id}
                  style={styles.clinicCard}
                  onPress={() => handleClinicSelect(clinic)}
                  activeOpacity={0.7}
                >
                  <View style={styles.clinicHeader}>
                    <View style={styles.clinicIconContainer}>
                      <IconComponent size={24} color={BLUE} />
                    </View>
                    <View style={styles.clinicInfo}>
                      <Text style={styles.clinicName}>{clinic.name || 'Unknown Clinic'}</Text>
                      <Text style={styles.clinicType}>{getClinicTypeDisplay(clinic.type || 'Unknown')}</Text>
                    </View>
                    <ChevronRight size={20} color={BLUE} />
                  </View>
                  
                  <View style={styles.clinicDetails}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Contact:</Text>
                      <Text style={styles.detailValue}>{clinic.contactNumber || 'Phone not available'}</Text>
                    </View>
                    
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Address:</Text>
                      <Text style={styles.detailValue}>
                        {formatClinicAddress(clinic) || 'Address not available'}
                      </Text>
                    </View>
                    
                    <View style={styles.availableRow}>
                      <Check size={16} color={BLUE} />
                      <Text style={styles.availableText}>Specialist doctors available</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 10,
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
  headerSpacer: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    fontFamily: 'Inter-Regular',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  section: {
    marginTop: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  clinicsList: {
    gap: 16,
  },
  clinicCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#00000022',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  clinicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  clinicIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: LIGHT_BLUE,
  },
  clinicInfo: {
    flex: 1,
  },
  clinicName: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  clinicType: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  clinicDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 2,
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    minWidth: 60,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    textAlign: 'right',
    flex: 1,
    lineHeight: 20,
    marginLeft: 12,
  },
  availableRow: {
    backgroundColor: LIGHT_BLUE,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: BLUE,
  },
  availableText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: BLUE,
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: BLUE,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },

  // Progress Bar (matching booking process screens)
  progressBarRoot: {
    height: 26,
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: -6,
    paddingHorizontal: 36,
    position: 'relative',
  },
  progressBarBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    top: '50%',
    marginTop: -2,
  },
  progressBarActive: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: BLUE,
    top: '50%',
    marginTop: -2,
    zIndex: 1,
  },
  progressDotsRow: {
    position: 'absolute',
    top: '50%',
    left: 50,
    right: 0,
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
    marginTop: -9,
    pointerEvents: 'none',
    paddingHorizontal: 16,
  },
  progressDotNew: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'absolute',
  },
  progressDotActiveNew: {
    backgroundColor: BLUE,
    borderColor: BLUE,
    zIndex: 10,
  },
  progressDotInactiveNew: {
    backgroundColor: '#E5E7EB',
    borderColor: '#E5E7EB',
    zIndex: 10,
  },
});
