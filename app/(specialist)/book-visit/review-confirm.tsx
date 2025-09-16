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
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  Check,
  Calendar,
  Clock,
  MapPin,
  User,
  Stethoscope,
  Phone,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { databaseService } from '../../../src/services/database/firebase';
import { getReferralDataWithClinicAndRoom } from '../../../src/utils/referralUtils';

const BLUE = '#1E40AF';

export default function SpecialistReviewConfirmScreen() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  
  // Extract parameters
  const clinicId = params.clinicId as string;
  const clinicName = params.clinicName as string;
  const doctorId = params.doctorId as string;
  const doctorName = params.doctorName as string;
  const doctorSpecialty = params.doctorSpecialty as string;
  const selectedDate = params.selectedDate as string;
  const selectedTime = params.selectedTime as string;
  const patientId = params.patientId as string;
  const patientFirstName = params.patientFirstName as string;
  const patientLastName = params.patientLastName as string;
  const originalAppointmentId = params.originalAppointmentId as string;
  const isReferral = params.isReferral as string;
  const reasonForReferral = params.reasonForReferral as string;

  const [loading, setLoading] = useState(false);
  const [createdAppointmentId, setCreatedAppointmentId] = useState<string | null>(null);
  const [doctorData, setDoctorData] = useState<any>(null);
  const [clinicData, setClinicData] = useState<any>(null);

  useEffect(() => {
    loadAdditionalData();
  }, []);

  const loadAdditionalData = async () => {
    try {
      // Fetch doctor details from users node
      const userData = await databaseService.getDocument(`users/${doctorId}`);
      
      // Fetch clinic contact information
      const clinicInfo = await databaseService.getDocument(`clinics/${clinicId}`);
      
      setDoctorData(userData);
      setClinicData(clinicInfo);
    } catch (error) {
      console.error('Error loading additional data:', error);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return 'Not specified';
    if (timeString.includes('AM') || timeString.includes('PM')) {
      return timeString;
    }
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleBookAppointment = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to book an appointment.');
      return;
    }

    try {
      setLoading(true);

      // Get proper clinic and room information
      const referralData = await getReferralDataWithClinicAndRoom(
        user.uid, // referring specialist ID
        doctorId, // assigned specialist ID
        selectedDate,
        selectedTime
      );

      // Get referring specialist name from users node
      const referringSpecialistData = await databaseService.getUserById(user.uid);
      const referringSpecialistFirstName = referringSpecialistData?.firstName || referringSpecialistData?.first_name || '';
      const referringSpecialistLastName = referringSpecialistData?.lastName || referringSpecialistData?.last_name || '';

      const appointmentData = {
        appointmentDate: selectedDate,
        appointmentTime: selectedTime,
        assignedSpecialistId: doctorId,
        clinicAppointmentId: originalAppointmentId, // Link to original appointment
        additionalNotes: reasonForReferral || 'Specialist referral',
        lastUpdated: new Date().toISOString(),
        patientId: patientId,
        practiceLocation: {
          clinicId: referralData.referringClinicId, // Use referring specialist's clinic
          roomOrUnit: referralData.roomOrUnit // Use room from schedule
        },
        referralTimestamp: new Date().toISOString(),
        referringClinicId: referralData.assignedClinicId, // Use assigned specialist's clinic
        referringClinicName: referralData.referringClinicName,
        referringSpecialistId: user.uid,
        referringSpecialistFirstName: referringSpecialistFirstName,
        referringSpecialistLastName: referringSpecialistLastName,
        sourceSystem: 'UniHealth_Specialist_App',
        status: 'pending' as const,
        specialistScheduleId: referralData.scheduleId, // Store the schedule ID for reference
      };

      // Save to database as referral
      const referralId = await databaseService.createReferral(appointmentData);
      console.log('Specialist referral created successfully with ID:', referralId);
      setCreatedAppointmentId(referralId);

      Alert.alert(
        'Appointment Booked Successfully!',
        `Your referral appointment for ${patientFirstName} ${patientLastName} has been booked for ${formatDate(selectedDate)} at ${formatTime(selectedTime)}.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to appointments screen
              router.push('/(specialist)/tabs/appointments');
            }
          }
        ]
      );

    } catch (error) {
      console.error('Error booking appointment:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to book appointment. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('referring specialist clinic')) {
          errorMessage = 'Unable to determine your clinic information. Please ensure you have an active schedule.';
        } else if (error.message.includes('room from specialist schedule')) {
          errorMessage = 'Unable to find available room for the selected date and time. Please select a different time slot.';
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (createdAppointmentId) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/(specialist)/tabs/appointments')} style={styles.backButton}>
            <ChevronLeft size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Appointment Confirmed</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Check size={48} color="#FFFFFF" />
          </View>
          <Text style={styles.successTitle}>Appointment Booked!</Text>
          <Text style={styles.successDescription}>
            Your referral appointment has been successfully booked.
          </Text>
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
        <Text style={styles.headerTitle}>Review & Confirm</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Referral Summary Card */}
        <View style={styles.summaryCard}>
          {/* <Text style={styles.summaryTitle}>Referral Summary</Text> */}
          
          {/* Clinic Info */}
          <View style={styles.clinicSection}>
            <Text style={styles.clinicName}>{clinicName}</Text>
            {clinicData && (
              <Text style={styles.clinicAddress}>
                {clinicData.addressLine || `${clinicData.address || ''}, ${clinicData.city || ''}, ${clinicData.province || ''}`.replace(/^,\s*|,\s*$/g, '')}
              </Text>
            )}
          </View>

          <View style={styles.dividerLine} />

          {/* Patient Information */}
          <View style={styles.appointmentDetailRow}>
            <Text style={styles.appointmentDetailLabel}>Patient:</Text>
            <Text style={styles.appointmentDetailValue}>{patientFirstName} {patientLastName}</Text>
          </View>

          {/* Specialist Information */}
          <View style={styles.appointmentDetailRow}>
            <Text style={styles.appointmentDetailLabel}>Specialist:</Text>
            <Text style={styles.appointmentDetailValue}>
              {doctorData 
                ? `Dr. ${[doctorData.firstName || doctorData.first_name, doctorData.middleName || doctorData.middle_name, doctorData.lastName || doctorData.last_name].filter(Boolean).join(' ')}`
                : `Dr. ${doctorName}`
              }
            </Text>
          </View>

          <View style={styles.appointmentDetailRow}>
            <Text style={styles.appointmentDetailLabel}>Specialty:</Text>
            <Text style={styles.appointmentDetailValue}>{doctorData?.specialty || doctorData?.specialization || doctorSpecialty}</Text>
          </View>

          {/* Appointment Details */}
          <View style={styles.appointmentDetailRow}>
            <Text style={styles.appointmentDetailLabel}>Date:</Text>
            <Text style={styles.appointmentDetailValue}>{formatDate(selectedDate)}</Text>
          </View>

          <View style={styles.appointmentDetailRow}>
            <Text style={styles.appointmentDetailLabel}>Time:</Text>
            <Text style={styles.appointmentDetailValue}>{formatTime(selectedTime)}</Text>
          </View>

          <View style={styles.appointmentDetailRow}>
            <Text style={styles.appointmentDetailLabel}>Purpose of Visit:</Text>
            <Text style={styles.appointmentDetailValue}>Referral</Text>
          </View>

          {reasonForReferral && (
            <View style={styles.appointmentDetailRow}>
              <Text style={styles.appointmentDetailLabel}>Reason for Referral:</Text>
              <Text style={styles.appointmentDetailValue}>{reasonForReferral}</Text>
            </View>
          )}

          {/* Referring Specialist */}
          <View style={styles.appointmentDetailRow}>
            <Text style={styles.appointmentDetailLabel}>Referring Specialist:</Text>
            <Text style={styles.appointmentDetailValue}>
              Dr. {user?.firstName} {user?.lastName}
            </Text>
          </View>
        </View>

        {/* Confirm Button */}
        <TouchableOpacity 
          style={[styles.confirmButton, loading && styles.confirmButtonDisabled]} 
          onPress={handleBookAppointment}
          disabled={loading}
        >
          <Text style={styles.confirmButtonText}>
            {loading ? 'Booking Appointment...' : 'Confirm Referral'}
          </Text>
          <Check size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </ScrollView>
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
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: BLUE,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  confirmButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  successDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginVertical: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  clinicSection: {
    marginBottom: 16,
  },
  clinicName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  clinicAddress: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  appointmentDetailRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  appointmentDetailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    width: 140,
    flexShrink: 0,
  },
  appointmentDetailValue: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
    lineHeight: 20,
  },
});
