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
  TextInput,
} from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  MapPin,
  User,
  Stethoscope,
  Phone,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { databaseService, Doctor } from '../../../src/services/database/firebase';

const BLUE = '#1E40AF';

interface SpecialistDoctor extends Doctor {
  isSpecialist?: boolean;
}

export default function SpecialistSelectDateTimeScreen() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  
  // Extract parameters
  const clinicId = params.clinicId as string;
  const clinicName = params.clinicName as string;
  const doctorId = params.doctorId as string;
  const doctorName = params.doctorName as string;
  const doctorSpecialty = params.doctorSpecialty as string;
  const patientId = params.patientId as string;
  const patientFirstName = params.patientFirstName as string;
  const patientLastName = params.patientLastName as string;
  const originalAppointmentId = params.originalAppointmentId as string;
  const isReferral = params.isReferral as string;

  const [doctor, setDoctor] = useState<SpecialistDoctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<Array<{time: string; minutes: number}>>([]);
  const [bookedTimeSlots, setBookedTimeSlots] = useState<string[]>([]);
  const [selectedPurpose, setSelectedPurpose] = useState<string>('Referral');
  const [reasonForReferral, setReasonForReferral] = useState<string>(params.reasonForReferral as string || '');
  const [specialistAvailableDays, setSpecialistAvailableDays] = useState<number[]>([]);
  const [specialistDaysLoaded, setSpecialistDaysLoaded] = useState(false);

  // Generate available dates (next 30 days)
  const AVAILABLE_DATES = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    date.setHours(0, 0, 0, 0); // Ensure consistent time
    
    // Format date as YYYY-MM-DD using local date components to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    return {
      date: dateString,
      dayOfWeek: date.getDay(),
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: date.getDate(),
      monthName: date.toLocaleDateString('en-US', { month: 'short' })
    };
  });

  useEffect(() => {
    loadDoctorData();
  }, [doctorId]);

  useEffect(() => {
    if (doctor && selectedDate) {
      loadSpecialistTimeSlots();
    }
  }, [doctor, selectedDate]);

  const loadDoctorData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch doctor details from users node
      const userData = await databaseService.getDocument(`users/${doctorId}`);
      
      // Fetch clinic contact information
      const clinicData = await databaseService.getDocument(`clinics/${clinicId}`);
      
      if (!userData) {
        setError('Doctor not found');
        return;
      }

      // Create doctor object with all the fetched information
      const specialistData = {
        id: doctorId,
        firstName: userData.firstName || userData.first_name || doctorName.split(' ')[0] || '',
        middleName: userData.middleName || userData.middle_name || '',
        lastName: userData.lastName || userData.last_name || doctorName.split(' ').slice(1).join(' ') || '',
        fullName: userData 
          ? `${[userData.firstName || userData.first_name, userData.middleName || userData.middle_name, userData.lastName || userData.last_name].filter(Boolean).join(' ')}`
          : doctorName,
        specialty: userData.specialty || userData.specialization || doctorSpecialty,
        isSpecialist: true,
        contactNumber: clinicData?.phone || clinicData?.contactNumber || userData.contactNumber || userData.phoneNumber || userData.phone || '',
        email: userData.email || '',
        clinicAffiliations: [clinicId],
        availability: userData.availability || {
          lastUpdated: new Date().toISOString(),
          weeklySchedule: {}
        }
      };
      
      setDoctor(specialistData);
      
      // Load available days for date filtering - use specialist schedule logic
      if (specialistData.isSpecialist) {
        await loadSpecialistAvailableDays(doctorId);
      }
      
    } catch (error) {
      console.error('Error loading doctor data:', error);
      setError('Failed to load doctor data');
    } finally {
      setLoading(false);
    }
  };

  const loadSpecialistAvailableDays = async (specialistId?: string) => {
    const idToUse = specialistId || doctor?.id;
    if (!idToUse) return;
    
    setSpecialistDaysLoaded(false);
    
    try {
      console.log('🔍 Loading specialist available days for:', idToUse);
      
      // Get specialist schedules
      const specialistSchedules = await databaseService.getSpecialistSchedules(idToUse);
      if (!specialistSchedules) {
        console.log('🔍 No specialist schedules found');
        return;
      }

      console.log('🔍 Raw specialist schedules:', specialistSchedules);

      // Find all active schedules and collect their available days
      const allAvailableDays = new Set<number>();
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day for consistent comparison
      
      // The structure is specialistSchedules[scheduleId] = { specialistId, recurrence, ... }
      Object.values(specialistSchedules).forEach((schedule: any) => {
        console.log('🔍 Processing schedule:', schedule);
        // Check if this schedule belongs to the specialist we're looking for
        // Use consistent date comparison - schedule is valid if validFrom is today or earlier
        const scheduleValidFrom = new Date(schedule.validFrom);
        scheduleValidFrom.setHours(0, 0, 0, 0); // Reset time to start of day
        
        if (schedule.specialistId === idToUse && schedule.isActive && scheduleValidFrom <= today) {
          if (schedule.recurrence && schedule.recurrence.dayOfWeek) {
            console.log('🔍 Found valid schedule with days:', schedule.recurrence.dayOfWeek);
            schedule.recurrence.dayOfWeek.forEach((day: number) => {
              allAvailableDays.add(day);
            });
          }
        }
      });

      const availableDaysArray = Array.from(allAvailableDays).sort();
      setSpecialistAvailableDays(availableDaysArray);
      setSpecialistDaysLoaded(true);
      console.log('🔍 Specialist available days loaded:', availableDaysArray);

    } catch (error) {
      console.error('❌ Error loading specialist available days:', error);
    }
  };

  const loadSpecialistTimeSlots = async () => {
    try {
      console.log('🔍 Loading specialist schedules for:', doctor?.id);
      
      // Get specialist schedules
      const specialistSchedules = await databaseService.getSpecialistSchedules(doctor!.id);
      if (!specialistSchedules) {
        setError('Specialist schedule functionality is not available yet. Please contact support.');
        setAvailableTimeSlots([]);
        setBookedTimeSlots([]);
        return;
      }

      // Get specialist referrals to check for booked slots
      const specialistReferrals = await databaseService.getSpecialistReferrals(doctor!.id);
      console.log('🔍 Specialist referrals:', specialistReferrals);

      // Find active schedule for the selected date
      // Parse date string as local date to avoid timezone issues
      const [year, month, day] = selectedDate!.split('-').map(Number);
      const selectedDateObj = new Date(year, month - 1, day); // month is 0-indexed
      selectedDateObj.setHours(0, 0, 0, 0); // Reset time to start of day for consistent comparison
      const dayOfWeek = selectedDateObj.getDay();
      
      // Additional debugging for date parsing
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      // Validate that the parsed date matches the expected day of week from the original date generation
      const expectedDayOfWeek = AVAILABLE_DATES.find(d => d.date === selectedDate)?.dayOfWeek;
      
      console.log('🔍 DEBUG - Selected date string:', selectedDate);
      console.log('🔍 DEBUG - Parsed components:', { year, month, day });
      console.log('🔍 DEBUG - Selected date object:', selectedDateObj);
      console.log('🔍 DEBUG - Day of week (number):', dayOfWeek);
      console.log('🔍 DEBUG - Day of week (name):', dayNames[dayOfWeek]);
      console.log('🔍 DEBUG - Expected day of week:', expectedDayOfWeek);
      console.log('🔍 DEBUG - Day of week match:', dayOfWeek === expectedDayOfWeek);
      console.log('🔍 DEBUG - All specialist schedules:', specialistSchedules);
      
      // If there's a mismatch, use the expected day of week from the original date generation
      const finalDayOfWeek = (dayOfWeek === expectedDayOfWeek) ? dayOfWeek : expectedDayOfWeek;
      console.log('🔍 DEBUG - Using day of week:', finalDayOfWeek, '(' + dayNames[finalDayOfWeek] + ')');
      
      // The structure is specialistSchedules[scheduleId] = { specialistId, recurrence, ... }
      let activeSchedule = null;
      
      activeSchedule = Object.values(specialistSchedules).find((schedule: any) => {
        // Use consistent date comparison - schedule is valid if validFrom is selected date or earlier
        const scheduleValidFrom = new Date(schedule.validFrom);
        scheduleValidFrom.setHours(0, 0, 0, 0); // Reset time to start of day
        
        console.log('🔍 DEBUG - Checking schedule:', {
          scheduleId: Object.keys(specialistSchedules).find(key => specialistSchedules[key] === schedule),
          specialistId: schedule.specialistId,
          doctorId: doctor!.id,
          isActive: schedule.isActive,
          validFrom: schedule.validFrom,
          validFromDate: scheduleValidFrom,
          selectedDateObj: selectedDateObj,
          validFromCheck: scheduleValidFrom > selectedDateObj,
          recurrence: schedule.recurrence,
          dayOfWeek: finalDayOfWeek,
          includesCheck: schedule.recurrence.dayOfWeek.includes(finalDayOfWeek)
        });
        
        if (schedule.specialistId !== doctor!.id || !schedule.isActive || scheduleValidFrom > selectedDateObj) return false;
        return schedule.recurrence.dayOfWeek.includes(finalDayOfWeek);
      });

      if (!activeSchedule) {
        // Provide more detailed error information for debugging
        const availableSchedules = Object.values(specialistSchedules).filter((schedule: any) => 
          schedule.specialistId === doctor!.id && schedule.isActive
        );
        
        console.log('❌ No active schedule found for date:', {
          selectedDate,
          dayOfWeek,
          availableSchedulesCount: availableSchedules.length,
          availableSchedules: availableSchedules.map((s: any) => ({
            validFrom: s.validFrom,
            validFromDate: new Date(s.validFrom),
            dayOfWeek: s.recurrence?.dayOfWeek,
            isActive: s.isActive
          }))
        });
        
        setError(`No available schedule for ${selectedDate} (${dayNames[finalDayOfWeek]}). Please select a different date.`);
        setAvailableTimeSlots([]);
        setBookedTimeSlots([]);
        return;
      }

      console.log('🔍 Found active schedule:', activeSchedule);

      // Generate time slots from specialist's slotTemplate
      const schedule = activeSchedule as any; // Type assertion for schedule object
      const specialistTimeSlots = Object.keys(schedule.slotTemplate || {}).map(time => ({
        time,
        minutes: schedule.slotTemplate[time]?.durationMinutes || 0
      }));

      // Check for booked slots from referrals
      const bookedSlotsFromReferrals = specialistReferrals
        .filter((referral: any) => 
          referral.assignedSpecialistId === doctor!.id &&
          referral.appointmentDate === selectedDate &&
          (referral.status === 'pending' || referral.status === 'confirmed' || referral.status === 'completed')
        )
        .map((referral: any) => referral.appointmentTime);

      // Also check for booked slots from appointments
      const specialistAppointments = await databaseService.getAppointments(doctor!.id, 'specialist');
      const bookedSlotsFromAppointments = specialistAppointments
        .filter((appointment: any) => 
          appointment.doctorId === doctor!.id &&
          appointment.appointmentDate === selectedDate &&
          appointment.status !== 'cancelled'
        )
        .map((appointment: any) => appointment.appointmentTime);

      // Combine both sources of booked slots
      const allBookedSlots = [...new Set([...bookedSlotsFromReferrals, ...bookedSlotsFromAppointments])];

      console.log('🔍 Specialist time slots:', specialistTimeSlots);
      console.log('🔍 Booked slots from referrals:', bookedSlotsFromReferrals);
      console.log('🔍 Booked slots from appointments:', bookedSlotsFromAppointments);
      console.log('🔍 All booked slots:', allBookedSlots);

      setAvailableTimeSlots(specialistTimeSlots);
      setBookedTimeSlots(allBookedSlots);

    } catch (error) {
      console.error('❌ Error loading specialist time slots:', error);
      setError('Specialist schedule functionality is not available yet. Please contact support.');
      setAvailableTimeSlots([]);
      setBookedTimeSlots([]);
    }
  };

  // Filter dates based on specialist availability
  const filteredDates = AVAILABLE_DATES.filter(date => {
    if (!specialistDaysLoaded) {
      return true; // Show all dates while loading
    }
    
    if (specialistAvailableDays.length === 0) {
      return false; // No availability
    }
    
    return specialistAvailableDays.includes(date.dayOfWeek);
  });

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedTime(null);
  };

  const handleTimeSelect = (time: string) => {
    if (bookedTimeSlots.includes(time)) {
      Alert.alert('Time Slot Booked', 'This time slot is already booked. Please select another time.');
      return;
    }
    setSelectedTime(time);
  };

  const handleContinue = () => {
    if (!selectedDate || !selectedTime) {
      Alert.alert('Missing Information', 'Please select both date and time for the appointment.');
      return;
    }

    if (!reasonForReferral.trim()) {
      Alert.alert('Missing Information', 'Please provide a reason for the referral.');
      return;
    }

    // Navigate to review-confirm screen
    router.push({
      pathname: '/(specialist)/book-visit/review-confirm',
      params: {
        clinicId,
        clinicName,
        doctorId,
        doctorName,
        doctorSpecialty,
        selectedDate,
        selectedTime,
        patientId,
        patientFirstName,
        patientLastName,
        originalAppointmentId,
        isReferral,
        reasonForReferral: reasonForReferral.trim(),
      }
    });
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Date & Time</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading doctor information...</Text>
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
          <Text style={styles.headerTitle}>Select Date & Time</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadDoctorData}>
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
        <Text style={styles.headerTitle}>Select Date & Time</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Doctor Information */}
        <View style={styles.doctorInfo}>
          <View style={styles.doctorHeader}>
            <View style={styles.doctorIconContainer}>
              <Stethoscope size={24} color={BLUE} />
            </View>
            <View style={styles.doctorDetails}>
              <Text style={styles.doctorName}>{doctor?.fullName || doctorName}</Text>
              <Text style={styles.doctorSpecialty}>{doctor?.specialty || doctorSpecialty}</Text>
            </View>
          </View>
          
          <View style={styles.clinicInfo}>
            <MapPin size={16} color="#6B7280" />
            <Text style={styles.clinicText}>{clinicName}</Text>
          </View>
          
          {doctor?.contactNumber && (
            <View style={styles.contactInfo}>
              <Phone size={16} color="#6B7280" />
              <Text style={styles.contactText}>{doctor.contactNumber}</Text>
            </View>
          )}
        </View>

        {/* Patient Information */}
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

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <View style={styles.datesContainer}>
            {filteredDates.map((date) => (
              <TouchableOpacity
                key={date.date}
                style={[
                  styles.dateCard,
                  selectedDate === date.date && styles.selectedDateCard
                ]}
                onPress={() => handleDateSelect(date.date)}
              >
                <Text style={[
                  styles.dateDayName,
                  selectedDate === date.date && styles.selectedDateText
                ]}>
                  {date.dayName}
                </Text>
                <Text style={[
                  styles.dateNumber,
                  selectedDate === date.date && styles.selectedDateText
                ]}>
                  {date.dayNumber}
                </Text>
                <Text style={[
                  styles.dateMonth,
                  selectedDate === date.date && styles.selectedDateText
                ]}>
                  {date.monthName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Time Selection */}
        {selectedDate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Time</Text>
            <View style={styles.timesContainer}>
              {availableTimeSlots.map((slot) => {
                const isBooked = bookedTimeSlots.includes(slot.time);
                const isSelected = selectedTime === slot.time;
                
                return (
                  <TouchableOpacity
                    key={slot.time}
                    style={[
                      styles.timeCard,
                      isBooked && styles.bookedTimeCard,
                      isSelected && styles.selectedTimeCard
                    ]}
                    onPress={() => handleTimeSelect(slot.time)}
                    disabled={isBooked}
                  >
                    <Text style={[
                      styles.timeText,
                      isBooked && styles.bookedTimeText,
                      isSelected && styles.selectedTimeText
                    ]}>
                      {formatTime(slot.time)}
                    </Text>
                    {isBooked && (
                      <Text style={styles.bookedLabel}>Booked</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Appointment Purpose */}
        {selectedTime && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Appointment Purpose</Text>
            <View style={styles.purposeContainer}>
              <View style={styles.purposeDisplay}>
                <Text style={styles.purposeText}>{selectedPurpose}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Reason for Referral */}
        {selectedTime && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reason for Referral</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Please describe the reason for this referral..."
              value={reasonForReferral}
              onChangeText={setReasonForReferral}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        )}

        {/* Continue Button */}
        {selectedDate && selectedTime && reasonForReferral.trim() && (
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueButtonText}>Continue</Text>
            <ChevronRight size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
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
  doctorInfo: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
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
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  doctorDetails: {
    flex: 1,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0C4A6E',
    marginBottom: 4,
  },
  doctorSpecialty: {
    fontSize: 14,
    color: '#0369A1',
  },
  clinicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clinicText: {
    fontSize: 14,
    color: '#0C4A6E',
    marginLeft: 8,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#0C4A6E',
    marginLeft: 8,
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  datesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dateCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedDateCard: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  dateDayName: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  dateNumber: {
    fontSize: 20,
    color: '#1F2937',
    fontWeight: '600',
    marginBottom: 4,
  },
  dateMonth: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  selectedDateText: {
    color: '#FFFFFF',
  },
  timesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  timeCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedTimeCard: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  bookedTimeCard: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
    opacity: 0.6,
  },
  timeText: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  selectedTimeText: {
    color: '#FFFFFF',
  },
  bookedTimeText: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  bookedLabel: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '500',
    marginTop: 2,
  },
  continueButton: {
    backgroundColor: BLUE,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  purposeContainer: {
    marginTop: 8,
  },
  purposeDisplay: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  purposeText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  reasonInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 16,
    color: '#1F2937',
    marginTop: 8,
    minHeight: 100,
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
});
