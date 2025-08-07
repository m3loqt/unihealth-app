import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  NativeSyntheticEvent,
  NativeScrollEvent,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  ChevronDown,
  Stethoscope,
  Syringe,
  HeartPulse,
  Shield,
  User,
  PlusCircle,
  Clock,
  Calendar,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { databaseService } from '../../../src/services/database/firebase';

// ---- Constants ----
const BLUE = '#2563EB';
const LIGHT_BLUE = '#DBEAFE';

const SERVICE_ICONS = {
  'General Consultation': Stethoscope,
  'Health Checkup': HeartPulse,
  'Vaccination': Syringe,
  'Family Medicine': User,
  'Preventive Care': Shield,
  'Minor Procedures': PlusCircle,
};

const APPOINTMENT_PURPOSES = [
  'General Consultation',
  'Health Checkup',
  'Follow-up Visit',
  'Vaccination',
  'Medical Certificate',
  'Prescription Renewal',
  'Preventive Care',
  'Minor Illness',
  'Health Screening',
  'Other',
];

// ---- Helper functions ----

function getNextNDays(n: number) {
  const months = [
    'JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'
  ];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const out = [];
  let date = new Date();
  for (let i = 0; i < n; ++i) {
    out.push({
      date: date.toISOString().split('T')[0],
      month: months[date.getMonth()],
      day: date.getDate().toString(),
      dayName: days[date.getDay()],
    });
    date.setDate(date.getDate() + 1);
  }
  return out;
}

function timeToMinutes(t: any) {
  let hour = t.hour % 12;
  if (t.ampm === 'PM' && hour !== 12) hour += 12;
  if (t.ampm === 'AM' && hour === 12) hour = 0;
  return hour * 60 + t.min;
}

function generateTimeSlots(start: any, end: any) {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  const slots = [];
  for (let i = startMinutes; i < endMinutes; i += 30) {
    const hour = Math.floor(i / 60);
    const min = i % 60;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    slots.push({
      time: `${displayHour}:${min.toString().padStart(2, '0')} ${ampm}`,
      minutes: i,
    });
  }
  return slots;
}

function getPagerData(items: any[], numPages: number) {
  const pages = [];
  for (let i = 0; i < items.length; i += numPages) {
    pages.push(items.slice(i, i + numPages));
  }
  return { pages, pageSize: numPages };
}

interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  specialty: string;
  contactNumber: string;
  clinicAffiliations: string[];
  availability: {
    lastUpdated: string;
    weeklySchedule: {
      monday?: { enabled: boolean; timeSlots?: Array<{ startTime: string; endTime: string }> };
      tuesday?: { enabled: boolean; timeSlots?: Array<{ startTime: string; endTime: string }> };
      wednesday?: { enabled: boolean; timeSlots?: Array<{ startTime: string; endTime: string }> };
      thursday?: { enabled: boolean; timeSlots?: Array<{ startTime: string; endTime: string }> };
      friday?: { enabled: boolean; timeSlots?: Array<{ startTime: string; endTime: string }> };
      saturday?: { enabled: boolean; timeSlots?: Array<{ startTime: string; endTime: string }> };
      sunday?: { enabled: boolean; timeSlots?: Array<{ startTime: string; endTime: string }> };
    };
    specificDates?: {
      [date: string]: {
        timeSlots: Array<{ startTime: string; endTime: string }>;
      };
    };
  };
}

export default function SelectDateTimeScreen() {
  const params = useLocalSearchParams();
  const clinicId = params.clinicId as string;
  const clinicName = params.clinicName as string;
  const doctorId = params.doctorId as string;
  const doctorName = params.doctorName as string;
  const doctorSpecialty = params.doctorSpecialty as string;

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedPurpose, setSelectedPurpose] = useState('');
  const [showPurposeDropdown, setShowPurposeDropdown] = useState(false);
  const [notes, setNotes] = useState('');
  const [datePage, setDatePage] = useState(0);
  const [timePage, setTimePage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);

  // Generate 30 days ahead for date picker
  const AVAILABLE_DATES = useMemo(() => getNextNDays(30), []);

  // refs for scrolling
  const dateScrollRef = useRef(null);
  const timeScrollRef = useRef(null);

  useEffect(() => {
    loadDoctorData();
  }, [doctorId]);

  useEffect(() => {
    if (selectedDate && doctor) {
      loadAvailableTimeSlots();
    }
  }, [selectedDate, doctor]);

  const loadDoctorData = async () => {
    try {
      setLoading(true);
      setError(null);
      const doctorData = await databaseService.getDoctorById(doctorId);
      setDoctor(doctorData);
    } catch (error) {
      console.error('Failed to load doctor data:', error);
      setError('Failed to load doctor data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableTimeSlots = async () => {
    try {
      const slots = await databaseService.getAvailableTimeSlots(doctorId, selectedDate);
      setAvailableTimeSlots(slots);
    } catch (error) {
      console.error('Failed to load available time slots:', error);
      setAvailableTimeSlots([]);
    }
  };

  // Pager data
  const datePager = getPagerData(AVAILABLE_DATES, 5);
  const timePager = getPagerData(availableTimeSlots.map(slot => ({ time: slot, minutes: 0 })), 5);

  // onScroll event to update active page
  const handleDateScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const w = datePager.pageSize * 64; // Card+margin width
    setDatePage(Math.round(x / w));
  };
  
  const handleTimeScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const w = timePager.pageSize * 70;
    setTimePage(Math.round(x / w));
  };

  const handleContinue = () => {
    if (selectedDate && selectedTime && selectedPurpose) {
      router.push({
        pathname: '/book-visit/review-confirm',
        params: {
          clinicId,
          clinicName,
          doctorId,
          doctorName,
          doctorSpecialty,
          selectedDate,
          selectedTime,
          selectedPurpose,
          notes,
        },
      });
    } else {
      Alert.alert('Missing Information', 'Please select a date, time, and appointment purpose.');
    }
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
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E40AF" />
          <Text style={styles.loadingText}>Loading doctor availability...</Text>
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
          <View style={styles.headerRight} />
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
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#1E40AF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Date & Time</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarRoot}>
        <View style={styles.progressBarBg} />
        <View style={[styles.progressBarActive, { width: '59%' }]} />
        <View style={styles.progressDotsRow}>
          <View style={[styles.progressDotNew, styles.progressDotActiveNew, { left: 0 }]} />
          <View style={[styles.progressDotNew, styles.progressDotActiveNew, { left: '45%' }]} />
          <View style={[styles.progressDotNew, styles.progressDotInactiveNew, { left: '90%' }]} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Doctor Card */}
        <View style={styles.clinicCardContainer}>
          <View style={styles.clinicCardTopRow}>
            <View style={styles.clinicCardNameCol}>
              <Text style={styles.clinicName}>{doctorName}</Text>
              <Text style={styles.clinicDistance}>{clinicName}</Text>
            </View>
            <View style={styles.clinicCardIconContainer}>
              <User size={24} color="#1E40AF" />
            </View>
          </View>
          <View style={styles.clinicCardBottomRow}>
            <View style={styles.clinicCardInfoItem}>
              <Clock size={16} color="#6B7280" />
              <Text style={styles.clinicCardInfoText}>{doctorSpecialty}</Text>
            </View>
            <View style={styles.clinicCardInfoItem}>
              <Calendar size={16} color="#6B7280" />
              <Text style={styles.clinicCardInfoText}>
                Last updated: {new Date(doctor?.availability?.lastUpdated || '').toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={handleDateScroll}
            scrollEventThrottle={16}
            ref={dateScrollRef}
          >
            {datePager.pages.map((page, pageIndex) => (
              <View key={pageIndex} style={styles.dateRow}>
                {page.map((dateItem, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dateCard,
                      selectedDate === dateItem.date && styles.dateCardSelected
                    ]}
                    onPress={() => setSelectedDate(dateItem.date)}
                  >
                    <Text style={[
                      styles.dateDayName,
                      selectedDate === dateItem.date && styles.dateDayNameSelected
                    ]}>
                      {dateItem.dayName}
                    </Text>
                    <Text style={[
                      styles.dateDay,
                      selectedDate === dateItem.date && styles.dateDaySelected
                    ]}>
                      {dateItem.day}
                    </Text>
                    <Text style={[
                      styles.dateMonth,
                      selectedDate === dateItem.date && styles.dateMonthSelected
                    ]}>
                      {dateItem.month}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Time Selection */}
        {selectedDate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Time</Text>
            {availableTimeSlots.length === 0 ? (
              <View style={styles.noSlotsContainer}>
                <Text style={styles.noSlotsText}>No available time slots for this date</Text>
                <Text style={styles.noSlotsSubtext}>Please select a different date</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                onScroll={handleTimeScroll}
                scrollEventThrottle={16}
                ref={timeScrollRef}
              >
                {timePager.pages.map((page, pageIndex) => (
                  <View key={pageIndex} style={styles.timeRow}>
                    {page.map((timeItem, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.timeCard,
                          selectedTime === timeItem.time && styles.timeCardSelected
                        ]}
                        onPress={() => setSelectedTime(timeItem.time)}
                      >
                        <Text style={[
                          styles.timeText,
                          selectedTime === timeItem.time && styles.timeTextSelected
                        ]}>
                          {timeItem.time}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Appointment Purpose */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appointment Purpose</Text>
          <TouchableOpacity
            style={styles.purposeDropdown}
            onPress={() => setShowPurposeDropdown(!showPurposeDropdown)}
          >
            <Text style={[
              styles.purposeDropdownText,
              !selectedPurpose && styles.purposePlaceholder
            ]}>
              {selectedPurpose || 'Select appointment purpose'}
            </Text>
            <ChevronDown size={20} color="#6B7280" />
          </TouchableOpacity>
          
          {showPurposeDropdown && (
            <View style={styles.purposeDropdownMenu}>
              {APPOINTMENT_PURPOSES.map((purpose, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.purposeDropdownItem}
                  onPress={() => {
                    setSelectedPurpose(purpose);
                    setShowPurposeDropdown(false);
                  }}
                >
                  <Text style={styles.purposeDropdownItemText}>{purpose}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add any additional information..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.continueButtonContainer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            (!selectedDate || !selectedTime || !selectedPurpose) && styles.continueButtonDisabled
          ]}
          onPress={handleContinue}
          disabled={!selectedDate || !selectedTime || !selectedPurpose}
        >
          <Text style={[
            styles.continueButtonText,
            (!selectedDate || !selectedTime || !selectedPurpose) && styles.continueButtonTextDisabled
          ]}>
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ---- Styles ----
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  scrollView: {
    flex: 1,
  },
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
  clinicCardContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginHorizontal: 24,
    marginBottom: 22,
    padding: 18,
    minHeight: 120,
    position: 'relative',
  },
  clinicCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
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
  clinicCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  clinicCardInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: LIGHT_BLUE,
    marginRight: 5,
    marginBottom: 5,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  clinicCardInfoText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
    marginLeft: 4,
  },
  clinicName: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
    marginRight: 16,
    flexWrap: 'wrap',
  },
  clinicDistance: {
    fontSize: 12,
    marginTop: 3,
    color: '#9CA3AF',
    fontFamily: 'Inter-Medium',
    marginBottom: 2,
  },
  servicesTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 0,
    width: '100%',
  },
  serviceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: LIGHT_BLUE,
    marginRight: 5,
    marginBottom: 5,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  serviceTagText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: BLUE,
    marginLeft: 2,
  },

  section: {
    marginHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 16,
    marginLeft: 0,
  },
  datesContainer: {
    paddingRight: 12,
  },
  dateRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  dateCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 11,
    marginRight: 9,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    minWidth: 52,
    minHeight: 72,
    justifyContent: 'center',
  },
  dateCardSelected: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  dateDayName: {
    textTransform: 'uppercase',
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: -2,
  },
  dateDayNameSelected: {
    color: '#fff',
  },
  dateDay: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    letterSpacing: 1,
    marginTop: 0,
    marginBottom: -2,
  },
  dateDaySelected: {
    color: '#fff',
  },
  dateMonth: {
    textTransform: 'uppercase',
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: -2,
  },
  dateMonthSelected: {
    color: '#fff',
  },
  timesContainer: {
    paddingRight: 12,
  },
  timeRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  timeCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 13,
    marginRight: 9,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    minWidth: 62,
    minHeight: 38,
    justifyContent: 'center',
  },
  timeCardSelected: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  timeText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  timeTextSelected: {
    color: '#fff',
  },
  noSlotsContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noSlotsText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontFamily: 'Inter-Medium',
    marginBottom: 5,
  },
  noSlotsSubtext: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },

  indicatorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10, 
    marginBottom: 2,
  },
  circleIndicator: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 3,
    opacity: 0.7,
  },
  circleIndicatorActive: {
    backgroundColor: BLUE,
    opacity: 1,
  },

  purposeContainer: {
    position: 'relative',
    zIndex: 10,
  },
  purposeDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  purposeDropdownText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  purposePlaceholder: {
    color: '#9CA3AF',
  },
  purposeDropdownMenu: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    zIndex: 20,
    maxHeight: 200,
  },
  purposeDropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  purposeDropdownItemActive: {
    backgroundColor: '#EFF6FF',
  },
  purposeDropdownItemText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  purposeDropdownItemTextActive: {
    color: BLUE,
    fontFamily: 'Inter-SemiBold',
  },
  notesInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    minHeight: 88,
  },
  continueButtonContainer: {
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
  continueButton: {
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  continueButtonTextDisabled: {
    color: '#9CA3AF',
  },
});
