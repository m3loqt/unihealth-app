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
  Modal,
  Pressable,
} from 'react-native';
import {
  ChevronLeft,
  Check,
  Calendar,
  Clock,
  User,
  Stethoscope,
  Phone,
  CircleCheck as CheckCircle,
  X,
  MapPin,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { databaseService } from '../../../src/services/database/firebase';
import { getReferralDataWithClinicAndRoom, getReferringSpecialistClinic } from '../../../src/utils/referralUtils';
import { emailService } from '../../../src/services/email/emailService';
import { formatClinicAddress } from '../../../src/utils/formatting';

const BLUE = '#1E40AF';
const LIGHT_BLUE = '#DBEAFE';

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
  const selectedPurpose = params.selectedPurpose as string;
  const reasonForReferral = params.reasonForReferral as string;
  const sourceType = params.sourceType as string; // New parameter for tracking source type
  const referralType = params.referralType as string;
  const isTraceBack = params.isTraceBack as string; // Flag to indicate trace-back referral

  // Debug: Log all referral parameters
  console.log(' Review-confirm referral parameters:', {
    originalAppointmentId,
    sourceType,
    isReferral,
    referralType,
    isTraceBack,
    patientId,
    patientFirstName,
    patientLastName,
    doctorId,
    doctorName,
    clinicId,
    clinicName,
    reasonForReferral
  });

  const [loading, setLoading] = useState(false);
  const [createdAppointmentId, setCreatedAppointmentId] = useState<string | null>(null);
  const [doctorData, setDoctorData] = useState<any>(null);
  const [clinicData, setClinicData] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [referralConfirmed, setReferralConfirmed] = useState(false);

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

  const handleCloseModal = () => {
    setShowSuccessModal(false);
    router.push('/(specialist)/tabs');
  };


  const formatDate = (dateString: string) => {
    try {
      // Parse the date string as local date to avoid timezone issues
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day); // month is 0-indexed
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
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

    setIsBooking(true);
    try {
      // Get referring specialist name from users node
      const referringSpecialistData = await databaseService.getUserById(user.uid);
      const referringSpecialistFirstName = referringSpecialistData?.firstName || referringSpecialistData?.first_name || '';
      const referringSpecialistLastName = referringSpecialistData?.lastName || referringSpecialistData?.last_name || '';

      // Validate and prepare clinicAppointmentId for specialist-to-specialist referrals
      let clinicAppointmentId = '';
      let clinicAppointmentIdSource = '';
      
      if (originalAppointmentId && originalAppointmentId !== 'undefined' && originalAppointmentId !== '') {
        clinicAppointmentId = originalAppointmentId;
        clinicAppointmentIdSource = sourceType || 'unknown';
        console.log(' Using originalAppointmentId as clinicAppointmentId:', {
          clinicAppointmentId,
          sourceType: clinicAppointmentIdSource,
          originalAppointmentId
        });
      } else {
        console.warn(' No originalAppointmentId provided - creating referral without clinicAppointmentId');
        console.log(' This may indicate a direct specialist referral without a source appointment/referral');
      }

      // Track the created ID for email sending (state updates are async, so we need a local variable)
      let createdId: string | null = null;

      // Determine if this is a generalist referral - check early to prevent any room lookups
      // Use case-insensitive and flexible checking to handle any parameter variations
      const referralTypeLower = String(referralType || '').toLowerCase();
      const isTraceBackStr = String(isTraceBack || '').toLowerCase();
      const isGeneralistReferral = referralTypeLower.includes('generalist') && 
                                    (isTraceBackStr === 'true');
      
      console.log(' Referral type check:', {
        referralType,
        referralTypeLower,
        isTraceBack,
        isTraceBackStr,
        isGeneralistReferral,
        willSkipRoomLookup: isGeneralistReferral,
        'CHECK: If true, should skip ALL room lookups': isGeneralistReferral
      });
      
      // If this is a generalist referral, log it clearly
      if (isGeneralistReferral) {
        console.log(' CONFIRMED: This is a GENERALIST referral - ALL room lookups will be SKIPPED');
      } else {
        console.log(' CONFIRMED: This is a SPECIALIST referral - room lookups will be performed');
      }

      // Check if this is a generalist referral (trace-back)
      if (isGeneralistReferral) {
        console.log(' Creating appointment for generalist referral (trace-back)');
        console.log(' IMPORTANT: No room lookup required for generalist referrals - creating appointment directly');
        
        // For generalist referrals: NO room lookup, NO schedule lookup, NO practiceLocation required
        // Generalists don't have scheduled rooms like specialists do, so we create the appointment
        // directly without any room or schedule requirements
        
        // Create appointment data for generalist
        // NOTE: practiceLocation is intentionally omitted - generalists don't require room information
        const appointmentData = {
          appointmentDate: selectedDate,
          appointmentTime: selectedTime,
          clinicId: clinicId, // Use the generalist's clinic ID from params
          clinicName: clinicName,
          createdAt: new Date().toISOString(),
          doctorId: doctorId,
          doctorFirstName: doctorData?.firstName || doctorData?.first_name || '',
          doctorLastName: doctorData?.lastName || doctorData?.last_name || '',
          doctorSpecialty: doctorData?.specialty || 'General Medicine',
          lastUpdated: new Date().toISOString(),
          appointmentPurpose: selectedPurpose,
          additionalNotes: reasonForReferral?.replace(/^Additional Notes:\s*/, '') || 'Return to Generalist',
          patientId: patientId,
          patientFirstName: patientFirstName,
          patientLastName: patientLastName,
          sourceSystem: 'UniHealth_Specialist_App',
          status: 'pending' as const,
          type: 'follow_up',
          // Add trace-back metadata
          isReferralFollowUp: true,
          originalAppointmentId: originalAppointmentId,
          // Add referring specialist information
          // NOTE: No referringClinicId/Name lookup needed - we skip all specialist schedule queries
          referringSpecialistId: user.uid,
          referringSpecialistFirstName: referringSpecialistFirstName,
          referringSpecialistLastName: referringSpecialistLastName,
          referralTimestamp: new Date().toISOString(),
          // practiceLocation is NOT included - generalist appointments don't require room data
        };

        // Save to database as appointment
        const appointmentId = await databaseService.createAppointment(appointmentData);
        console.log('Generalist appointment created successfully with ID:', appointmentId);
        createdId = appointmentId;
        setCreatedAppointmentId(appointmentId);
        setReferralConfirmed(true);
        
      } else {
        // Double-check: Ensure we're NOT processing a generalist referral here
        // Use same logic as above to detect generalist referrals
        const referralTypeLowerCheck = String(referralType || '').toLowerCase();
        const isTraceBackStrCheck = String(isTraceBack || '').toLowerCase();
        const isGeneralistReferralCheck = referralTypeLowerCheck.includes('generalist') && 
                                          (isTraceBackStrCheck === 'true');
        
        if (isGeneralistReferralCheck) {
          console.error(' ERROR: Generalist referral detected in specialist branch! This should not happen.');
          console.error(' Parameters:', { 
            referralType, 
            referralTypeLowerCheck,
            isTraceBack, 
            isTraceBackStrCheck,
            isGeneralistReferralCheck,
            referralTypeValue: typeof referralType, 
            isTraceBackValue: typeof isTraceBack 
          });
          throw new Error('Invalid referral flow: Generalist referral detected in specialist branch. Room lookup should be skipped for generalists.');
        }
        
        console.log(' Creating referral for specialist referral');
        
        // Get proper clinic and room information (only for specialist referrals)
        // IMPORTANT: This function will look up rooms - only call for specialist referrals!
        // Explicitly pass isGeneralistReferral=false to ensure room lookup is performed
        const referralData = await getReferralDataWithClinicAndRoom(
          user.uid, // referring specialist ID
          doctorId, // assigned specialist ID
          selectedDate,
          selectedTime,
          false // isGeneralistReferral - false for specialist referrals (room lookup required)
        );
        
        // Verify room data is present (should always be present for specialist referrals)
        if (!referralData.roomOrUnit || !referralData.scheduleId) {
          throw new Error('Room and schedule information is required for specialist referrals');
        }
        
        // Create referral data for specialist
        const specialistReferralData = {
          appointmentDate: selectedDate,
          appointmentTime: selectedTime,
          assignedSpecialistId: doctorId,
          clinicAppointmentId: clinicAppointmentId, // Now properly validated
          additionalNotes: reasonForReferral?.replace(/^Additional Notes:\s*/, '') || 'Specialist referral',
          lastUpdated: new Date().toISOString(),
          patientId: patientId,
          practiceLocation: {
            clinicId: referralData.assignedClinicId, // Use assigned specialist's clinic
            roomOrUnit: referralData.roomOrUnit // Use room from schedule (guaranteed to be present)
          },
          referralTimestamp: new Date().toISOString(),
          referringClinicId: referralData.referringClinicId, // Use referring specialist's clinic
          referringClinicName: referralData.referringClinicName,
          referringSpecialistId: user.uid,
          referringSpecialistFirstName: referringSpecialistFirstName,
          referringSpecialistLastName: referringSpecialistLastName,
          sourceSystem: 'UniHealth_Specialist_App',
          status: 'pending' as const,
          specialistScheduleId: referralData.scheduleId, // Store the schedule ID for reference
          // Add metadata for better tracking
          referralSourceType: clinicAppointmentIdSource, // Track what type of source this referral came from
          referralSourceId: clinicAppointmentId, // Track the source ID for debugging
        };

        // Save to database as referral
        const referralId = await databaseService.createReferral(specialistReferralData);
        console.log('Specialist referral created successfully with ID:', referralId);
        createdId = referralId;
        setCreatedAppointmentId(referralId);
        setReferralConfirmed(true);
      }

      // Send referral confirmation email (non-blocking for booking flow)
      try {
        if (emailService && typeof emailService.isEmailServiceReady === 'function' && emailService.isEmailServiceReady()) {
          const patientNameForEmail = `${patientFirstName} ${patientLastName}`.trim();
          const clinicAddressStr = clinicData ? formatClinicAddress(clinicData) : '';
          const doctorNameStr = doctorData 
            ? `Dr. ${[doctorData.firstName || doctorData.first_name, doctorData.middleName || doctorData.middle_name, doctorData.lastName || doctorData.last_name].filter(Boolean).join(' ')}`
            : `Dr. ${doctorName}`;

          await emailService.sendAppointmentConfirmationEmail({
            email: user.email || '',
            userName: `${referringSpecialistFirstName} ${referringSpecialistLastName}`,
            clinicName: clinicName || '',
            appointmentDate: formatDate(selectedDate),
            appointmentTime: selectedTime || '',
            appointmentPurpose: selectedPurpose || 'Specialist referral',
            doctorName: doctorNameStr,
            clinicAddress: clinicAddressStr,
            additionalNotes: `Patient: ${patientNameForEmail}`,
            appointmentId: String(createdId || ''),
          });
        } else {
          console.warn('Email service not ready; skipping referral confirmation email');
        }
      } catch (emailErr) {
        console.error('Failed to send referral confirmation email:', emailErr);
      }

      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error booking appointment:', error);
      
      // Determine if this is a generalist referral (need to recalculate here for error handling)
      // Use case-insensitive and flexible checking
      const referralTypeLower = String(referralType || '').toLowerCase();
      const isTraceBackStr = String(isTraceBack || '').toLowerCase();
      const isGeneralistReferral = referralTypeLower.includes('generalist') && 
                                    (isTraceBackStr === 'true');
      
      console.log(' Error handling - referral type:', {
        referralType,
        isTraceBack,
        isGeneralistReferral,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      // Provide more specific error messages based on referral type
      let errorMessage = 'Failed to book appointment. Please try again.';
      if (error instanceof Error) {
        const errorMsgLower = error.message.toLowerCase();
        
        // For generalist referrals, NEVER show room/schedule-related errors
        if (isGeneralistReferral) {
          // Generalist-friendly error messages (no room/schedule references)
          // Check for any room, schedule, or time slot related errors
          const isRoomRelatedError = 
            errorMsgLower.includes('room') || 
            errorMsgLower.includes('schedule') || 
            errorMsgLower.includes('time slot') ||
            errorMsgLower.includes('unable to find available') ||
            errorMsgLower.includes('select a different time') ||
            errorMsgLower.includes('select a different date') ||
            errorMsgLower.includes('no available schedule') ||
            errorMsgLower.includes('room from specialist');
          
          if (isRoomRelatedError) {
            console.log(' Filtering out room/schedule-related error for generalist referral');
            console.log(' Original error message:', error.message);
            errorMessage = 'Unable to create the appointment. Please try again.';
          } else {
            errorMessage = error.message || 'Failed to create appointment. Please try again.';
          }
        } else {
          // Specialist referral error messages (only show for specialist referrals)
          if (errorMsgLower.includes('referring specialist clinic')) {
            errorMessage = 'Unable to determine your clinic information. Please ensure you have an active schedule.';
          } else if (errorMsgLower.includes('room from specialist schedule') || 
                     errorMsgLower.includes('unable to find available room')) {
            errorMessage = 'Unable to find available room for the selected date and time. Please select a different time slot.';
          } else {
            errorMessage = error.message;
          }
        }
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsBooking(false);
    }
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
        {/* Referral Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Referral Summary</Text>
          
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
            <Text style={styles.appointmentDetailValue}>{selectedPurpose}</Text>
          </View>

          {reasonForReferral && (
            <View style={styles.appointmentDetailRow}>
              <Text style={styles.appointmentDetailLabel}>Additional Notes:</Text>
              <Text style={styles.appointmentDetailValue}>
                {reasonForReferral.replace(/^Additional Notes:\s*/, '')}
              </Text>
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

        {/* Important Information */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Before the Referral Appointment</Text>
          <View style={styles.infoList}>
            <Text style={styles.infoItem}>• Patient should arrive 15 minutes early for check-in</Text>
            <Text style={styles.infoItem}>• Patient should bring valid ID and insurance card (if applicable)</Text>
            <Text style={styles.infoItem}>• Referral can be rescheduled up to 24 hours before the appointment</Text>
            {/* <Text style={styles.infoItem}>• Both specialists will be notified of the referral</Text> */}
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
              <Text style={styles.stepText}>Assigned specialist will review and confirm the referral</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>Patient will receive a confirmation notification</Text>
            </View>
            {/* <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>You'll be notified when the consultation is completed</Text>
            </View> */}
          </View>
        </View>
      </ScrollView>

      {/* Confirm Referral Button - Only show if referral hasn't been confirmed yet */}
      {!referralConfirmed && (
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[styles.bookButton, isBooking && styles.bookButtonDisabled]}
            onPress={handleBookAppointment}
            disabled={isBooking}
          >
            <Text style={styles.bookButtonText}>
              {isBooking ? 'Booking Referral...' : 'Confirm Referral'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={handleCloseModal}>
          <View style={styles.modalOverlay} />
        </Pressable>
        
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.successIconContainer}>
              <CheckCircle size={64} color="#2563EB" />
            </View>
            <Text style={styles.successTitle}>Referral Requested!</Text>
            <Text style={styles.successMessage}>
              Your referral request has been submitted to {clinicName}. 
              The assigned specialist will review and confirm the referral.
            </Text>
            <View style={styles.modalDetailsCard}>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Patient:</Text>
                <Text style={styles.modalDetailValue}>{patientFirstName} {patientLastName}</Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Clinic:</Text>
                <Text style={styles.modalDetailValue}>{clinicName}</Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Date:</Text>
                <Text style={styles.modalDetailValue}>{formatDate(selectedDate)}</Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Time:</Text>
                <Text style={styles.modalDetailValue}>{formatTime(selectedTime)}</Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Purpose:</Text>
                <Text style={styles.modalDetailValue}>{selectedPurpose}</Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Specialist:</Text>
                <Text style={styles.modalDetailValue}>
                  {doctorData 
                    ? `Dr. ${[doctorData.firstName || doctorData.first_name, doctorData.middleName || doctorData.middle_name, doctorData.lastName || doctorData.last_name].filter(Boolean).join(' ')}`
                    : `Dr. ${doctorName}`
                  }
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={handleCloseModal}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalXButton}
              onPress={handleCloseModal}
            >
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
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
    shadowColor: '#00000022',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 18,
    letterSpacing: 0.2,
  },
  clinicSection: {
    marginBottom: 16,
  },
  clinicName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  clinicAddress: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 18,
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },
  appointmentDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 2,
  },
  appointmentDetailLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    width: 140,
    flexShrink: 0,
  },
  appointmentDetailValue: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },

  // Info Card
  infoCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    shadowColor: '#00000022',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#0C4A6E',
    marginBottom: 10,
  },
  infoList: {
    gap: 7,
  },
  infoItem: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#0C4A6E',
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
    shadowColor: '#00000022',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
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
    width: 20,
    height: 20,
    borderRadius: 12,
    backgroundColor: BLUE,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
    shadowColor: '#00000022',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
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
  successTitle: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
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
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 2,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#00000022',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successMessage: {
    fontSize: 14,
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
    shadowColor: '#00000022',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalDetailLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  modalDetailValue: {
    fontSize: 14,
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
