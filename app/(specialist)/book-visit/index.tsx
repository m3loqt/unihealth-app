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
  TextInput,
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  MapPin,
  Phone,
  Check,
  Building2,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { databaseService, Clinic } from '../../../src/services/database/firebase';

const BLUE = '#1E40AF';

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
      const clinicsData = await databaseService.getClinics();
      
      // Filter out clinics where the logged-in specialist is the only specialist available
      const filteredClinics = await Promise.all(
        clinicsData.map(async (clinic) => {
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
        reasonForReferral,
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

  const getClinicTypeDisplay = (type: string): string => {
    const typeMap: { [key: string]: string } = {
      'general': 'General Practice',
      'specialist': 'Specialist Clinic',
      'hospital': 'Hospital',
      'clinic': 'Medical Clinic',
      'health_center': 'Health Center',
    };
    return typeMap[type.toLowerCase()] || type;
  };

  const getServiceIcon = (type: string) => {
    return Building2; // Default icon for all clinic types
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
          <Text style={styles.headerTitle}>Select Clinic</Text>
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
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Clinic</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clinics..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.patientInfo}>
          <Text style={styles.patientInfoTitle}>Referring Patient:</Text>
          <Text style={styles.patientInfoText}>
            {patientFirstName} {patientLastName}
          </Text>
          {/* {reasonForReferral && (
            <>
              <Text style={styles.patientInfoTitle}>Reason for Referral:</Text>
              <Text style={styles.patientInfoText}>{reasonForReferral}</Text>
            </>
          )} */}
        </View>

        {filteredClinics.length === 0 ? (
          <View style={styles.emptyState}>
            <Building2 size={48} color="#9CA3AF" />
            <Text style={styles.emptyStateTitle}>No Clinics Found</Text>
            <Text style={styles.emptyStateDescription}>
              {searchQuery 
                ? 'No clinics match your search criteria.'
                : 'No clinics with available specialists found.'
              }
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
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
    fontWeight: '600',
    color: '#1F2937',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 20,
    marginBottom: 20,
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
  },
  patientInfo: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  patientInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369A1',
    marginBottom: 4,
  },
  patientInfoText: {
    fontSize: 16,
    color: '#0C4A6E',
    marginBottom: 8,
  },
  clinicsList: {
    flex: 1,
  },
  clinicCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  clinicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  clinicIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clinicInfo: {
    flex: 1,
  },
  clinicName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  clinicType: {
    fontSize: 14,
    color: '#6B7280',
  },
  clinicDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    width: 80,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  availableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  availableText: {
    fontSize: 14,
    color: BLUE,
    fontWeight: '500',
    marginLeft: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: BLUE,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
