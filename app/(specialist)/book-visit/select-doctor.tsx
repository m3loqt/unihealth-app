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
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  Clock,
  MapPin,
  User,
  Phone,
  Mail,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { databaseService, Doctor } from '../../../src/services/database/firebase';
import { safeDataAccess } from '../../../src/utils/safeDataAccess';

// Color constants (match booking process screens)
const BLUE = '#1E40AF';
const LIGHT_BLUE = '#DBEAFE';

interface SpecialistDoctor extends Doctor {
  isSpecialist?: boolean;
}

export default function SpecialistSelectDoctorScreen() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const clinicId = params.clinicId as string;
  const clinicName = params.clinicName as string;
  const patientId = params.patientId as string;
  const patientFirstName = params.patientFirstName as string;
  const patientLastName = params.patientLastName as string;
  const originalAppointmentId = params.originalAppointmentId as string;
  const isReferral = params.isReferral as string;
  const reasonForReferral = params.reasonForReferral as string;
  
  const [doctors, setDoctors] = useState<SpecialistDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSpecialistDoctors();
  }, [clinicId]);

  const loadSpecialistDoctors = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get specialist doctors by clinic
      const doctorsData = await databaseService.getSpecialistDoctorsByClinic(clinicId);
      
      // Enrich each doctor with data from users node
      const enrichedDoctors = await Promise.all(
        doctorsData.map(async (doctor) => {
          try {
            // Fetch doctor details from users node
            const userData = await databaseService.getDocument(`users/${doctor.id}`);
            
            // Fetch clinic contact information
            const clinicData = await databaseService.getDocument(`clinics/${clinicId}`);
            
            return {
              ...doctor,
              firstName: userData?.firstName || userData?.first_name || doctor.firstName || '',
              middleName: userData?.middleName || userData?.middle_name || doctor.middleName || '',
              lastName: userData?.lastName || userData?.last_name || doctor.lastName || '',
              fullName: userData 
                ? `${[userData.firstName || userData.first_name, userData.middleName || userData.middle_name, userData.lastName || userData.last_name].filter(Boolean).join(' ')}`
                : doctor.fullName,
              contactNumber: clinicData?.phone || clinicData?.contactNumber || doctor.contactNumber || '',
              email: userData?.email || '',
            };
          } catch (error) {
            console.error('Error enriching doctor data:', error);
            return doctor; // Return original doctor data if enrichment fails
          }
        })
      );
      
      // Filter out the currently logged-in specialist
      const filteredDoctors = enrichedDoctors.filter(doctor => doctor.id !== user?.uid);
      
      setDoctors(filteredDoctors);
    } catch (error) {
      console.error('Failed to load specialist doctors:', error);
      setError('Failed to load specialist doctors. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorSelect = (doctor: SpecialistDoctor) => {
    router.push({
      pathname: '/(specialist)/book-visit/select-datetime',
      params: {
        clinicId,
        clinicName,
        doctorId: doctor.id,
        doctorName: safeDataAccess.getUserFullName(doctor, 'Unknown Doctor'),
        doctorSpecialty: doctor.specialty || 'Specialist Consultation',
        patientId,
        patientFirstName,
        patientLastName,
        originalAppointmentId,
        isReferral,
        reasonForReferral,
      }
    });
  };

  const formatAvailability = (doctor: SpecialistDoctor): string => {
    if (!doctor.availability?.weeklySchedule) {
      return 'Schedule not available';
    }

    const schedule = doctor.availability.weeklySchedule;
    const availableDays = [];
    
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    dayNames.forEach((day, index) => {
      if (schedule[day]?.enabled) {
        availableDays.push(dayLabels[index]);
      }
    });

    if (availableDays.length === 0) {
      return 'No availability';
    }

    return availableDays.join(', ');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Specialist</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={styles.loadingText}>Loading specialists...</Text>
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
          <Text style={styles.headerTitle}>Select Specialist</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadSpecialistDoctors}>
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
        <Text style={styles.headerTitle}>Select Specialist</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.clinicInfo}>
          <Text style={styles.clinicInfoTitle}>Clinic:</Text>
          <Text style={styles.clinicInfoText}>{clinicName}</Text>
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

        {doctors.length === 0 ? (
          <View style={styles.emptyState}>
            <Stethoscope size={48} color="#9CA3AF" />
            <Text style={styles.emptyStateTitle}>No Specialists Available</Text>
            <Text style={styles.emptyStateDescription}>
              No specialist doctors are available at this clinic.
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.doctorsList} showsVerticalScrollIndicator={false}>
            {doctors.map((doctor) => (
              <TouchableOpacity
                key={doctor.id}
                style={styles.doctorCard}
                onPress={() => handleDoctorSelect(doctor)}
                activeOpacity={0.7}
              >
                <View style={styles.doctorHeader}>
                  <View style={styles.doctorIconContainer}>
                    <Stethoscope size={24} color={BLUE} />
                  </View>
                  <View style={styles.doctorInfo}>
                    <Text style={styles.doctorName}>
                      {doctor.fullName || safeDataAccess.getUserFullName(doctor, 'Unknown Doctor')}
                    </Text>
                    <Text style={styles.doctorSpecialty}>
                      {doctor.specialty || 'Specialist Consultation'}
                    </Text>
                  </View>
                  <ChevronRight size={20} color={BLUE} />
                </View>
                
                <View style={styles.doctorDetails}>
                  {/* <View style={styles.detailRow}>
                    <Clock size={16} color="#6B7280" />
                    <Text style={styles.detailText}>
                      Available: {formatAvailability(doctor)}
                    </Text>
                  </View> */}
                  
                  {doctor.contactNumber && (
                    <View style={styles.detailRow}>
                      <Phone size={16} color="#6B7280" />
                      <Text style={styles.detailText}>
                        {doctor.contactNumber}
                      </Text>
                    </View>
                  )}
                  
                  {/* {doctor.email && (
                    <View style={styles.detailRow}>
                      <Mail size={16} color="#6B7280" />
                      <Text style={styles.detailText}>
                        {doctor.email}
                      </Text>
                    </View>
                  )} */}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
  clinicInfo: {
    backgroundColor: LIGHT_BLUE,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  clinicInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369A1',
    marginBottom: 4,
  },
  clinicInfoText: {
    fontSize: 16,
    color: '#0C4A6E',
  },
  patientInfo: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  patientInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 4,
  },
  patientInfoText: {
    fontSize: 16,
    color: '#14532D',
    marginBottom: 8,
  },
  doctorsList: {
    flex: 1,
  },
  doctorCard: {
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
  doctorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  doctorIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: LIGHT_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  doctorSpecialty: {
    fontSize: 14,
    color: '#6B7280',
  },
  doctorDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
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
