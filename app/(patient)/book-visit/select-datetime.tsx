import React, { useState, useMemo, useRef } from 'react';
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
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';

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

const CLINIC_IMAGES = [
  'https://images.pexels.com/photos/236380/pexels-photo-236380.jpeg?auto=compress&w=800&q=80',
  'https://images.pexels.com/photos/263402/pexels-photo-263402.jpeg?auto=compress&w=800&q=80',
  'https://images.pexels.com/photos/1170979/pexels-photo-1170979.jpeg?auto=compress&w=800&q=80',
  'https://images.pexels.com/photos/305568/pexels-photo-305568.jpeg?auto=compress&w=800&q=80',
];

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

function parseOperatingHours(hoursStr: string) {
  const regex = /(\d{1,2}):(\d{2})\s?(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s?(AM|PM)/i;
  const m = hoursStr.match(regex);
  if (!m) return null;
  const start = {
    hour: parseInt(m[1], 10),
    min: parseInt(m[2], 10),
    ampm: m[3].toUpperCase(),
  };
  const end = {
    hour: parseInt(m[4], 10),
    min: parseInt(m[5], 10),
    ampm: m[6].toUpperCase(),
  };
  return [start, end];
}

function timeToMinutes(t: any) {
  let hour = t.hour % 12;
  if (t.ampm === 'PM') hour += 12;
  return hour * 60 + t.min;
}

function generateTimeSlots(start: any, end: any) {
  const slots = [];
  let startMins = timeToMinutes(start);
  let endMins = timeToMinutes(end);
  if (endMins <= startMins) endMins += 24 * 60;
  for (let mins = startMins; mins <= endMins; mins += 30) {
    let hour = Math.floor(mins / 60) % 24;
    let min = mins % 60;
    let ampm = hour >= 12 ? 'PM' : 'AM';
    let hour12 = hour % 12;
    if (hour12 === 0) hour12 = 12;
    slots.push(
      `${hour12.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')} ${ampm}`
    );
  }
  return slots;
}

// Helper: divide items into 5 "pages"
function getPagerData(items: any[], numPages: number) {
  const pageSize = Math.ceil(items.length / numPages);
  return { pageSize, numPages };
}

export default function SelectDateTimeScreen() {
  const { clinicData } = useLocalSearchParams();
  const clinic = JSON.parse(clinicData as string);

  const clinicImage = CLINIC_IMAGES[clinic.id % CLINIC_IMAGES.length];

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedPurpose, setSelectedPurpose] = useState('');
  const [showPurposeDropdown, setShowPurposeDropdown] = useState(false);
  const [notes, setNotes] = useState('');
  const [datePage, setDatePage] = useState(0);
  const [timePage, setTimePage] = useState(0);

  // Generate 30 days ahead for date picker
  const AVAILABLE_DATES = useMemo(() => getNextNDays(30), []);
  // Parse operating hours
  const operatingHoursParsed = useMemo(
    () => parseOperatingHours(clinic.operatingHours),
    [clinic.operatingHours]
  );
  // Generate available times based on hours
  const TIME_SLOTS = useMemo(() => {
    if (!operatingHoursParsed) return [];
    const [start, end] = operatingHoursParsed;
    return generateTimeSlots(start, end);
  }, [operatingHoursParsed]);

  // refs for scrolling
  const dateScrollRef = useRef(null);
  const timeScrollRef = useRef(null);

  // Pager data
  const datePager = getPagerData(AVAILABLE_DATES, 5);
  const timePager = getPagerData(TIME_SLOTS, 5);

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
          clinicData: JSON.stringify(clinic),
          selectedDate,
          selectedTime,
          selectedPurpose,
          notes,
        },
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#1E40AF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Appointment</Text>
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
        {/* Clinic Card (unchanged) */}
        <View style={styles.clinicCardContainer}>
          <View style={styles.clinicCardTopRow}>
            <View style={styles.clinicCardNameCol}>
              <Text style={styles.clinicName}>{clinic.name}</Text>
              <Text style={styles.clinicDistance}>{clinic.distance} <Text style={styles.awayText}>away</Text></Text>
            </View>
            <Image
              source={{ uri: clinicImage }}
              style={styles.clinicImageStatic}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.infoValue}>{clinic.address}</Text>
          <Text style={styles.infoValue}>{clinic.operatingHours}</Text>
          <View style={styles.dividerSubtle} />
          <View style={styles.servicesTags}>
            {clinic.services.slice(0, 3).map((service: string, i: number) => {
              const Icon = SERVICE_ICONS[service as keyof typeof SERVICE_ICONS] || User;
              return (
                <View key={i} style={styles.serviceTag}>
                  <Icon size={12} color={BLUE} style={{ marginRight: 4 }} />
                  <Text style={styles.serviceTagText}>{service}</Text>
                </View>
              );
            })}
            {clinic.services.length > 3 && (
              <View style={styles.serviceTag}>
                <PlusCircle size={12} color={BLUE} style={{ marginRight: 4 }} />
                <Text style={styles.serviceTagText}>+{clinic.services.length - 3} more</Text>
              </View>
            )}
          </View>
        </View>

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.datesContainer}
              ref={dateScrollRef}
              onScroll={handleDateScroll}
              scrollEventThrottle={16}
            >
              {AVAILABLE_DATES.map((dateItem) => (
                <TouchableOpacity
                  key={dateItem.date}
                  style={[
                    styles.dateCard,
                    selectedDate === dateItem.date && styles.selectedDateCard
                  ]}
                  onPress={() => setSelectedDate(dateItem.date)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.dateMonth,
                      selectedDate === dateItem.date && styles.selectedDateMonth,
                    ]}
                  >
                    {dateItem.month}
                  </Text>
                  <Text
                    style={[
                      styles.dateNumber,
                      selectedDate === dateItem.date && styles.selectedDateNumber,
                    ]}
                  >
                    {dateItem.day}
                  </Text>
                  <Text
                    style={[
                      styles.dateDayName,
                      selectedDate === dateItem.date && styles.selectedDateDayName,
                    ]}
                  >
                    {dateItem.dayName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.indicatorRow}>
              {Array.from({ length: 5 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.circleIndicator,
                    i === datePage ? styles.circleIndicatorActive : null
                  ]}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Time Selection */}
        {selectedDate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Time</Text>
            <View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.timesContainer}
                ref={timeScrollRef}
                onScroll={handleTimeScroll}
                scrollEventThrottle={16}
              >
                {TIME_SLOTS.length === 0 && (
                  <Text style={{ color: '#9CA3AF', fontSize: 15, padding: 10 }}>
                    No time slots available
                  </Text>
                )}
                {TIME_SLOTS.map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.timeCard,
                      selectedTime === time && styles.selectedTimeCard,
                    ]}
                    onPress={() => setSelectedTime(time)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.timeCardText,
                        selectedTime === time && styles.selectedTimeCardText,
                      ]}
                    >
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.indicatorRow}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.circleIndicator,
                      i === timePage ? styles.circleIndicatorActive : null
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Purpose Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Purpose of Visit</Text>
          <View style={styles.purposeContainer}>
            <TouchableOpacity
              style={styles.purposeDropdown}
              onPress={() => setShowPurposeDropdown(!showPurposeDropdown)}
            >
              <Text style={[
                styles.purposeText,
                !selectedPurpose && styles.purposePlaceholder
              ]}>
                {selectedPurpose || 'Select purpose of visit'}
              </Text>
              <ChevronDown size={20} color="#6B7280" />
            </TouchableOpacity>
            {showPurposeDropdown && (
              <View style={styles.purposeDropdownMenu}>
                {APPOINTMENT_PURPOSES.map((purpose) => (
                  <TouchableOpacity
                    key={purpose}
                    style={[
                      styles.purposeDropdownItem,
                      selectedPurpose === purpose && styles.purposeDropdownItemActive
                    ]}
                    onPress={() => {
                      setSelectedPurpose(purpose);
                      setShowPurposeDropdown(false);
                    }}
                  >
                    <Text style={[
                      styles.purposeDropdownItemText,
                      selectedPurpose === purpose && styles.purposeDropdownItemTextActive
                    ]}>
                      {purpose}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Notes Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Describe your symptoms, concerns, or any additional information for the healthcare provider..."
            placeholderTextColor="#9CA3AF"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.bottomContainer}>
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
            Continue to Review
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
  clinicImageStatic: {
    width: 94,
    height: 94,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
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
  awayText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Inter-Medium',
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    paddingVertical: 2,
    fontFamily: 'Inter-Regular',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  dividerSubtle: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 9,
    marginRight: 18,
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
  selectedDateCard: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  dateMonth: {
    textTransform: 'uppercase',
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: -2,
  },
  selectedDateMonth: {
    color: '#fff',
  },
  dateNumber: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    letterSpacing: 1,
    marginTop: 0,
    marginBottom: -2,
  },
  selectedDateNumber: {
    color: '#fff',
  },
  dateDayName: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginTop: 2,
  },
  selectedDateDayName: {
    color: '#fff',
  },
  timesContainer: {
    paddingRight: 12,
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
  selectedTimeCard: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  timeCardText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  selectedTimeCardText: {
    color: '#fff',
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
  purposeText: {
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
