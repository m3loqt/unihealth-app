import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { ChevronLeft, Calendar, Clock, FileText, MapPin, CircleCheck as CheckCircle, X, Building } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { databaseService } from '../../../src/services/database/firebase';

// Color constants (match previous screens)
const BLUE = '#2563EB';
const LIGHT_BLUE = '#DBEAFE';

export default function ReviewConfirmScreen() {
  const { 
    clinicId, 
    clinicName, 
    doctorId, 
    doctorName, 
    doctorSpecialty, 
    selectedDate, 
    selectedTime, 
    selectedPurpose, 
    notes 
  } = useLocalSearchParams();
  const { user } = useAuth();
  
  // Create clinic object from individual parameters
  const clinic = {
    id: clinicId,
    name: clinicName,
    specialty: doctorSpecialty
  };
  
  // State for clinic data
  const [clinicData, setClinicData] = useState<any>(null);
  const [loadingClinic, setLoadingClinic] = useState(true);
  
  // Helper function to safely get doctor name parts
  const getDoctorNameParts = (name: string | string[] | undefined) => {
    if (!name) return { firstName: 'Dr.', lastName: 'General' };
    const nameStr = Array.isArray(name) ? name[0] : name;
    const parts = nameStr.split(' ');
    return {
      firstName: parts[0] || 'Dr.',
      lastName: parts.slice(1).join(' ') || 'General'
    };
  };
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isBooking, setIsBooking] = useState(false);

  // Load clinic data to get address
  React.useEffect(() => {
    const loadClinicData = async () => {
      if (clinicId) {
        try {
          const clinic = await databaseService.getClinicById(clinicId as string);
          setClinicData(clinic);
        } catch (error) {
          console.error('Error loading clinic data:', error);
        } finally {
          setLoadingClinic(false);
        }
      } else {
        setLoadingClinic(false);
      }
    };

    loadClinicData();
  }, [clinicId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleBookAppointment = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in to book an appointment.');
      return;
    }

    setIsBooking(true);
    try {
      // Create appointment data matching your database structure
      const doctorNameParts = getDoctorNameParts(doctorName);
      const appointmentData = {
        appointmentDate: selectedDate as string,
        appointmentTime: selectedTime as string,
        bookedByUserFirstName: user.name ? user.name.split(' ')[0] : '',
        bookedByUserId: user.uid,
        bookedByUserLastName: user.name ? user.name.split(' ').slice(1).join(' ') : '',
        clinicId: clinicId as string,
        clinicName: clinicName as string,
        createdAt: new Date().toISOString(),
        doctorFirstName: doctorNameParts.firstName,
        doctorId: doctorId as string,
        doctorLastName: doctorNameParts.lastName,
        lastUpdated: new Date().toISOString(),
        notes: (notes as string) || '',
        patientComplaint: [selectedPurpose as string],
        patientFirstName: user.name ? user.name.split(' ')[0] : '',
        patientId: user.uid,
        patientLastName: user.name ? user.name.split(' ').slice(1).join(' ') : '',
        sourceSystem: 'UniHealth_Patient_App',
        specialty: doctorSpecialty as string,
        status: 'pending' as const,
        type: 'general_consultation'
      };

      // Save to database
      const appointmentId = await databaseService.createAppointment(appointmentData);
      console.log('Appointment created successfully with ID:', appointmentId);
      
      Alert.alert(
        'Success!', 
        'Your appointment has been booked successfully. You can view it in the Appointments tab.',
        [
          {
            text: 'View Appointments',
            onPress: () => router.push('/(patient)/tabs/appointments?filter=pending')
          },
          {
            text: 'OK',
            onPress: () => setShowSuccessModal(true)
          }
        ]
      );
    } catch (error) {
      console.error('Error booking appointment:', error);
      Alert.alert('Error', 'Failed to book appointment. Please try again.');
    } finally {
      setIsBooking(false);
    }
  };

  const handleCloseModal = () => {
    setShowSuccessModal(false);
    router.push('/(patient)/tabs');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color={BLUE} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review & Confirm</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarRoot}>
        <View style={styles.progressBarBg} />
        <View style={[styles.progressBarActive, { width: '200%' }]} />
        <View style={styles.progressDotsRow}>
          <View style={[styles.progressDotNew, styles.progressDotActiveNew, { left: 0 }]} />
          <View style={[styles.progressDotNew, styles.progressDotActiveNew, { left: '45%' }]} />
          <View style={[styles.progressDotNew, styles.progressDotActiveNew, { left: '90%' }]} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Appointment Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Appointment Summary</Text>
          
          {/* Clinic Info */}
          <View style={styles.clinicSection}>
            <View style={styles.clinicIconContainer}>
              <Building size={26} color={BLUE} />
            </View>
            <View style={styles.clinicInfo}>
              <Text style={styles.clinicName}>{clinic.name}</Text>
              {clinicData?.address && (
                <View style={styles.locationContainer}>
                  <MapPin size={14} color="#6B7280" />
                  <Text style={styles.locationText}>{clinicData.address}</Text>
                </View>
              )}
              {clinicData?.operatingHours && (
                <View style={styles.hoursContainer}>
                  <Clock size={14} color="#6B7280" />
                  <Text style={styles.hoursText}>{clinicData.operatingHours}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.dividerSubtle} />

          {/* Appointment Details */}
          <View style={styles.detailsSection}>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Calendar size={20} color={BLUE} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{formatDate(selectedDate as string)}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Clock size={20} color={BLUE} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Time</Text>
                <Text style={styles.detailValue}>{selectedTime}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <FileText size={20} color={BLUE} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Purpose of Visit</Text>
                <Text style={styles.detailValue}>{selectedPurpose}</Text>
              </View>
            </View>

            {notes ? (
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <FileText size={20} color={BLUE} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Additional Notes</Text>
                  <Text style={styles.detailValue}>{notes}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* Important Information */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Before Your Appointment</Text>
          <View style={styles.infoList}>
            <Text style={styles.infoItem}>• Please arrive 15 minutes early for check-in</Text>
            <Text style={styles.infoItem}>• Bring a valid ID and insurance card (if applicable)</Text>
            <Text style={styles.infoItem}>• You can reschedule up to 24 hours before your appointment</Text>
            {/* <Text style={styles.infoItem}>• Cancellation fees may apply for late cancellations</Text> */}
          </View>
        </View>

        {/* Next Steps */}
        <View style={styles.nextStepsCard}>
          <Text style={styles.nextStepsTitle}>What Happens Next?</Text>
          <View style={styles.stepsList}>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>Clinic will review and confirm your appointment</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>You'll receive a confirmation notification</Text>
            </View>
            {/* <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>Healthcare provider will be assigned to your case</Text>
            </View> */}
          </View>
        </View>
      </ScrollView>

      {/* Book Appointment Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.bookButton, isBooking && styles.bookButtonDisabled]}
          onPress={handleBookAppointment}
          disabled={isBooking}
        >
          <Text style={styles.bookButtonText}>
            {isBooking ? 'Booking...' : 'Book Appointment'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={handleCloseModal}>
          <BlurView intensity={20} style={styles.blurView}>
            <View style={styles.modalOverlay} />
          </BlurView>
        </Pressable>
        
        <View style={styles.modalContainer}>
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalContent}>
              <View style={styles.successIconContainer}>
                <CheckCircle size={64} color="#10B981" />
              </View>
              <Text style={styles.successTitle}>Appointment Requested!</Text>
              <Text style={styles.successMessage}>
                Your appointment request has been submitted to {clinic.name}. 
                You'll receive a confirmation notification once the clinic reviews and approves your request.
              </Text>
              <View style={styles.modalDetailsCard}>
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Clinic:</Text>
                  <Text style={styles.modalDetailValue}>{clinic.name}</Text>
                </View>
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Date:</Text>
                  <Text style={styles.modalDetailValue}>{formatDate(selectedDate as string)}</Text>
                </View>
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Time:</Text>
                  <Text style={styles.modalDetailValue}>{selectedTime}</Text>
                </View>
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Purpose:</Text>
                  <Text style={styles.modalDetailValue}>{selectedPurpose}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={handleCloseModal}
              >
                <Text style={styles.modalCloseButtonText}>Return to homepage</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalXButton}
                onPress={handleCloseModal}
              >
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
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
  scrollView: {
    flex: 1,
  },

  // Progress Bar
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

  // Card
  summaryCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 18,
    letterSpacing: 0.2,
  },
  clinicSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  clinicIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: LIGHT_BLUE,
  },
  clinicInfo: { flex: 1 },
  clinicName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 7,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  locationText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 5,
    flex: 1,
    lineHeight: 19,
  },
  hoursContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hoursText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 5,
    flex: 1,
    lineHeight: 19,
  },
  dividerSubtle: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 17,
  },
  detailsSection: {
    gap: 13,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: LIGHT_BLUE,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    lineHeight: 22,
  },

  // Info Card
  infoCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  infoTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
    marginBottom: 10,
  },
  infoList: {
    gap: 7,
  },
  infoItem: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#92400E',
    lineHeight: 18,
  },
  // Next Steps
  nextStepsCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 24,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  nextStepsTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#0C4A6E',
    marginBottom: 12,
  },
  stepsList: {
    gap: 11,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BLUE,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  stepNumberText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  stepText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#0C4A6E',
    flex: 1,
    lineHeight: 18,
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
  bookButton: {
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  bookButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  // Modal Styles
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  modalSafeArea: {
    width: '90%',
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 22,
  },
  modalDetailsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalDetailLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  modalDetailValue: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  modalCloseButton: {
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
  },
  modalXButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
});
 