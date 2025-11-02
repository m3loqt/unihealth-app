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
  User,
  Clock,
  Phone,
  Mail,
  ChevronRight,
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
  const sourceType = params.sourceType as string; // New parameter for tracking source type
  const referralType = params.referralType as string; // New parameter for referral type (specialist/generalist)
  
  // Debug: Log all referral parameters
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
      
      let doctorsData;
      
      // Get doctors based on referral type
      if (referralType === 'generalist') {
        // For generalist referrals, get generalist doctors by clinic
        doctorsData = await databaseService.getGeneralistDoctorsByClinic(clinicId);
      } else {
        // For specialist referrals (default), get specialist doctors by clinic
        doctorsData = await databaseService.getSpecialistDoctorsByClinic(clinicId);
      }
      
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
              specialty: doctor.specialty || doctor.specialization || (referralType === 'generalist' ? 'General Medicine' : 'Specialist Consultation'),
              isSpecialist: doctor.isSpecialist || false,
              isGeneralist: doctor.isGeneralist || false,
            };
          } catch (error) {
            console.error('Error enriching doctor data:', error);
            return {
              ...doctor,
              specialty: doctor.specialty || doctor.specialization || (referralType === 'generalist' ? 'General Medicine' : 'Specialist Consultation'),
              isSpecialist: doctor.isSpecialist || false,
              isGeneralist: doctor.isGeneralist || false,
            };
          }
        })
      );
      
      // Filter out the currently logged-in specialist for specialist referrals only
      const filteredDoctors = referralType === 'generalist' 
        ? enrichedDoctors 
        : enrichedDoctors.filter(doctor => doctor.id !== user?.uid);
      
      setDoctors(filteredDoctors);
    } catch (error) {
      console.error('Failed to load doctors:', error);
      setError('Failed to load doctors. Please try again.');
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
        doctorSpecialty: doctor.specialty || (referralType === 'generalist' ? 'General Medicine' : 'Specialist Consultation'),
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
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color={BLUE} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Doctor</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarRoot}>
        <View style={styles.progressBarBg} />
        <View style={[styles.progressBarActive, { width: '62%' }]} />
        <View style={styles.progressDotsRow}>
          <View style={[styles.progressDotNew, styles.progressDotActiveNew, { left: 0 }]} />
          <View style={[styles.progressDotNew, styles.progressDotActiveNew, { left: '45%' }]} />
          <View style={[styles.progressDotNew, styles.progressDotInactiveNew, { left: '90%' }]} />
        </View>
      </View>

      {/* Clinic Info Card */}
      <View style={styles.clinicCardContainer}>
        <View style={styles.clinicCardTopRow}>
          <View style={styles.clinicCardNameCol}>
            <Text style={styles.clinicName}>{clinicName}</Text>
            <Text style={styles.clinicSubtitle}>Available Doctors</Text>
          </View>
          <View style={styles.clinicCardIconContainer}>
            <User size={24} color={BLUE} />
          </View>
        </View>
      </View>

      {/* Doctors List */}
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {doctors.length === 0 ? (
          <View style={styles.emptyContainer}>
            <User size={48} color="#E5E7EB" />
            <Text style={styles.emptyText}>No doctors available</Text>
            <Text style={styles.emptySubtext}>
              No doctors are currently affiliated with this clinic
            </Text>
          </View>
        ) : (
          <View style={styles.doctorsList}>
            {doctors.map((doctor) => (
              <TouchableOpacity
                key={doctor.id}
                style={styles.doctorCard}
                onPress={() => handleDoctorSelect(doctor)}
                activeOpacity={0.7}
              >
                <View style={styles.doctorHeader}>
                  <View style={styles.doctorIconContainer}>
                    <User size={24} color={BLUE} />
                  </View>
                  <View style={styles.doctorInfo}>
                    <Text style={styles.doctorName}>{doctor.fullName}</Text>
                    <Text style={styles.doctorSpecialty}>{doctor.specialty || 'General Medicine'}</Text>
                  </View>
                  <ChevronRight size={20} color={BLUE} />
                </View>
                
                <View style={styles.doctorDetails}>
                  {doctor.contactNumber && (
                    <View style={styles.detailRow}>
                      <Phone size={16} color="#6B7280" />
                      <Text style={styles.detailLabel}>Contact Number:</Text>
                      <Text style={styles.detailValue}>{doctor.contactNumber}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
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
  headerRight: {
    width: 40,
  },

  // Progress Bar (matching select-datetime.tsx)
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

  // Clinic Info Card (matching select-datetime.tsx style)
  clinicCardContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginHorizontal: 24,
    marginBottom: 22,
    padding: 18,
    minHeight: 80,
    position: 'relative',
  },
  clinicCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  clinicCardNameCol: {
    flex: 1,
    marginRight: 12,
  },
  clinicCardIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clinicName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  clinicSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },

  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  doctorsList: {
    gap: 16,
  },
  doctorCard: {
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
  doctorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  doctorIconContainer: {
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
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  doctorSpecialty: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  doctorDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginLeft: 8,
    minWidth: 100,
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
    lineHeight: 20,
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
});
