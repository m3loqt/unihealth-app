import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Modal as RNModal,
} from 'react-native';
import { X, Building, Calendar, Clock, MapPin, Check, AlertCircle } from 'lucide-react-native';
import { databaseService } from '../services/database/firebase';
import { ScheduleFormData, Clinic, SpecialistSchedule } from '../types/schedules';
import Modal from './ui/Modal';
import { Input } from './ui/Input';
import Button from './ui/Button';
import TimePicker from './ui/TimePicker';
import DatePicker from './ui/DatePicker';
import { formatDate } from '../utils/date';

interface ScheduleFormProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: ScheduleFormData) => Promise<void>;
  schedule?: SpecialistSchedule | null;
  mode: 'add' | 'edit';
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const SLOT_DURATIONS = [
  { value: 15, label: '15 minutes' },
  { value: 20, label: '20 minutes (default)' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '60 minutes' },
];

export default function ScheduleForm({ 
  visible, 
  onClose, 
  onSubmit, 
  schedule, 
  mode 
}: ScheduleFormProps) {
  const [formData, setFormData] = useState<ScheduleFormData>({
    clinicId: '',
    roomOrUnit: '',
    validFrom: new Date().toISOString().split('T')[0],
    daysOfWeek: [],
    startTime: '',
    endTime: '',
    slotDuration: 20,
  });

  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(false);
  const [showClinicDropdown, setShowClinicDropdown] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState<'start' | 'end' | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    if (visible) {
      loadClinics();
      if (schedule && mode === 'edit') {
        // Convert schedule data to form data
        setFormData({
          clinicId: schedule.practiceLocation.clinicId,
          roomOrUnit: schedule.practiceLocation.roomOrUnit,
          validFrom: schedule.validFrom,
          daysOfWeek: schedule.recurrence.dayOfWeek,
          startTime: getStartTimeFromSlots(schedule.slotTemplate),
          endTime: getEndTimeFromSlots(schedule.slotTemplate),
          slotDuration: getDurationFromSlots(schedule.slotTemplate),
        });
      } else {
        // Reset form for new schedule
        setFormData({
          clinicId: '',
          roomOrUnit: '',
          validFrom: new Date().toISOString().split('T')[0],
          daysOfWeek: [],
          startTime: '',
          endTime: '',
          slotDuration: 20,
        });
      }
    }
  }, [visible, schedule, mode]);

  const loadClinics = async () => {
    try {
      const clinicsData = await databaseService.getAllClinics();
      setClinics(clinicsData);
    } catch (error) {
      console.error('❌ Error loading clinics:', error);
      Alert.alert('Error', 'Failed to load clinics. Please try again.');
    }
  };

  const getStartTimeFromSlots = (slotTemplate: any): string => {
    const times = Object.keys(slotTemplate);
    if (times.length === 0) return '';
    
    // Sort times chronologically instead of alphabetically
    const sortedTimes = sortTimesChronologically(times);
    return sortedTimes[0] || '';
  };

  // Helper function to convert time string to minutes for proper sorting
  const timeToMinutes = (timeStr: string): number => {
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!timeMatch) return 0;
    
    const [, hoursStr, minutesStr, period] = timeMatch;
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    
    let hour24 = hours;
    if (period === 'PM' && hours !== 12) {
      hour24 += 12;
    } else if (period === 'AM' && hours === 12) {
      hour24 = 0;
    }
    
    return hour24 * 60 + minutes;
  };

  // Helper function to sort times chronologically
  const sortTimesChronologically = (times: string[]): string[] => {
    return times.sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  };

  const getEndTimeFromSlots = (slotTemplate: any): string => {
    try {
      const times = Object.keys(slotTemplate);
      if (times.length === 0) return '';
      
      // Sort times chronologically instead of alphabetically
      const sortedTimes = sortTimesChronologically(times);
      const lastTime = sortedTimes[sortedTimes.length - 1];
      const lastSlot = slotTemplate[lastTime];
      
      console.log('Debug - all times:', times);
      console.log('Debug - sorted times:', sortedTimes);
      console.log('Debug - lastTime (chronologically):', lastTime);
      console.log('Debug - lastSlot:', lastSlot);
      
      if (!lastSlot || !lastSlot.durationMinutes) {
        console.warn('Invalid slot data:', lastSlot);
        return '';
      }
      
      // Parse the last time and add duration
      const timeMatch = lastTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!timeMatch) {
        console.error('Invalid time format:', lastTime);
        return '';
      }
      
      const [, hoursStr, minutesStr, period] = timeMatch;
      const hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);
      
      console.log('Debug - timeStr:', hoursStr, 'minutesStr:', minutesStr, 'period:', period);
      console.log('Debug - hours:', hours, 'minutes:', minutes);
      
      // Validate parsed values
      if (isNaN(hours) || isNaN(minutes)) {
        console.error('Invalid time format:', lastTime);
        return '';
      }
      
      // Convert to 24-hour format
      let hour24 = hours;
      if (period === 'PM' && hours !== 12) {
        hour24 += 12;
      } else if (period === 'AM' && hours === 12) {
        hour24 = 0;
      }
      
      // Add duration
      const totalMinutes = hour24 * 60 + minutes + lastSlot.durationMinutes;
      const endHour24 = Math.floor(totalMinutes / 60);
      const endMinutes = totalMinutes % 60;
      
      // Convert back to 12-hour format
      const endHour12 = endHour24 === 0 ? 12 : endHour24 > 12 ? endHour24 - 12 : endHour24;
      const endPeriod = endHour24 >= 12 ? 'PM' : 'AM';
      
      const result = `${endHour12}:${endMinutes.toString().padStart(2, '0')} ${endPeriod}`;
      console.log('Debug - calculated end time:', result);
      
      return result;
    } catch (error) {
      console.error('Error parsing end time from slots:', error);
      return '';
    }
  };

  const getDurationFromSlots = (slotTemplate: any): number => {
    const firstSlot = Object.values(slotTemplate)[0] as any;
    return firstSlot?.durationMinutes || 20;
  };

  const compareTimes = (time1: string, time2: string): number => {
    // Convert time strings to minutes for comparison
    const parseTime = (time: string): number => {
      const timeMatch = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!timeMatch) {
        console.error('Invalid time format in comparison:', time);
        return 0;
      }
      
      const [, hoursStr, minutesStr, period] = timeMatch;
      const hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);
      
      let hour24 = hours;
      if (period === 'PM' && hours !== 12) {
        hour24 += 12;
      } else if (period === 'AM' && hours === 12) {
        hour24 = 0;
      }
      
      return hour24 * 60 + minutes;
    };
    
    const minutes1 = parseTime(time1);
    const minutes2 = parseTime(time2);
    
    return minutes1 - minutes2;
  };

  const handleSubmit = async () => {
    console.log('🔍 handleSubmit called');
    console.log('🔍 Form data:', formData);
    
    if (!validateForm()) {
      console.log('❌ Form validation failed');
      return;
    }

    console.log('✅ Form validation passed, showing confirmation modal');
    // Show confirmation modal instead of directly submitting
    setShowConfirmation(true);
  };

  const handleConfirmSubmit = async () => {
    console.log('🔍 handleConfirmSubmit called');
    try {
      setLoading(true);
      setShowConfirmation(false);
      console.log('🔍 Calling onSubmit with formData:', formData);
      await onSubmit(formData);
      console.log('✅ onSubmit completed successfully');
      onClose();
    } catch (error) {
      console.error('❌ Schedule form submission error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save schedule';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
  };

  const validateForm = (): boolean => {
    console.log('🔍 validateForm called');
    console.log('🔍 clinicId:', formData.clinicId);
    console.log('🔍 roomOrUnit:', formData.roomOrUnit);
    console.log('🔍 validFrom:', formData.validFrom);
    console.log('🔍 daysOfWeek:', formData.daysOfWeek);
    console.log('🔍 startTime:', formData.startTime);
    console.log('🔍 endTime:', formData.endTime);
    
    if (!formData.clinicId) {
      console.log('❌ No clinic selected');
      Alert.alert('Error', 'Please select a clinic');
      return false;
    }
    if (!formData.roomOrUnit.trim()) {
      console.log('❌ No room/unit entered');
      Alert.alert('Error', 'Please enter a room/unit');
      return false;
    }
    if (!formData.validFrom) {
      console.log('❌ No valid from date');
      Alert.alert('Error', 'Please select a valid from date');
      return false;
    }
    
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(formData.validFrom)) {
      console.log('❌ Invalid date format');
      Alert.alert('Error', 'Please enter a valid date in YYYY-MM-DD format');
      return false;
    }
    
    // Check if date is not in the past
    // Parse the date string and create a date object in local timezone
    const [year, month, day] = formData.validFrom.split('-').map(Number);
    const selectedDate = new Date(year, month - 1, day); // month is 0-indexed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    console.log('🔍 Date comparison debug:');
    console.log('🔍 selectedDate:', selectedDate.toISOString());
    console.log('🔍 today:', today.toISOString());
    console.log('🔍 selectedDate < today:', selectedDate < today);
    
    if (selectedDate < today) {
      console.log('❌ Date is in the past');
      Alert.alert('Error', 'Valid from date cannot be in the past');
      return false;
    }
    if (formData.daysOfWeek.length === 0) {
      console.log('❌ No days selected');
      Alert.alert('Error', 'Please select at least one day of the week');
      return false;
    }
    if (!formData.startTime) {
      console.log('❌ No start time');
      Alert.alert('Error', 'Please select a start time');
      return false;
    }
    if (!formData.endTime) {
      console.log('❌ No end time');
      Alert.alert('Error', 'Please select an end time');
      return false;
    }
    if (compareTimes(formData.startTime, formData.endTime) >= 0) {
      console.log('❌ End time must be after start time');
      Alert.alert('Error', 'End time must be after start time');
      return false;
    }
    console.log('✅ Form validation passed');
    return true;
  };

  const toggleDayOfWeek = (dayValue: number) => {
    setFormData(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(dayValue)
        ? prev.daysOfWeek.filter(d => d !== dayValue)
        : [...prev.daysOfWeek, dayValue].sort(),
    }));
  };

  const renderClinicSelection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Building size={20} color="#1E40AF" />
        <Text style={styles.sectionTitle}>Clinic Selection</Text>
      </View>
      
      <TouchableOpacity
        style={[styles.dropdownButton, !formData.clinicId && styles.errorBorder]}
        onPress={() => setShowClinicDropdown(!showClinicDropdown)}
      >
        <Text style={[styles.dropdownText, !formData.clinicId && styles.placeholderText]}>
          {formData.clinicId 
            ? clinics.find(c => c.id === formData.clinicId)?.name || 'Unknown Clinic'
            : 'Search or add clinic...'
          }
        </Text>
        <Text style={styles.dropdownArrow}>▼</Text>
      </TouchableOpacity>
      
      {!formData.clinicId && (
        <Text style={styles.errorText}>Please select a clinic to continue</Text>
      )}

      {showClinicDropdown && (
        <View style={styles.dropdownList}>
          <ScrollView style={styles.dropdownScroll}>
            {clinics.length > 0 ? (
              clinics.map(clinic => (
                <TouchableOpacity
                  key={clinic.id}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, clinicId: clinic.id }));
                    setShowClinicDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{clinic.name}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.dropdownItem}>
                <Text style={styles.dropdownItemText}>No clinics available</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );

  const renderScheduleConfiguration = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Calendar size={20} color="#1E40AF" />
        <Text style={styles.sectionTitle}>Schedule Configuration</Text>
      </View>
      
      <Text style={styles.sectionDescription}>
        Add new schedule blocks for this doctor. Each block represents a different clinic or time slot.
      </Text>

      <View style={styles.subSection}>
        <Text style={styles.subSectionTitle}>Add New Schedule Block</Text>
        
        <Input
          label="Room/Unit"
          placeholder="e.g., Cardiology Clinic, Rm 501"
          value={formData.roomOrUnit}
          onChangeText={(text) => setFormData(prev => ({ ...prev, roomOrUnit: text }))}
          leftIcon={<MapPin size={16} color="#6B7280" />}
        />

        <Text style={styles.label}>Valid From</Text>
        <TouchableOpacity
          style={styles.dateInputButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Calendar size={16} color="#6B7280" />
          <Text style={[styles.dateInputText, !formData.validFrom && styles.placeholderText]}>
            {formData.validFrom ? formatDate(formData.validFrom, 'short') : 'Select date...'}
          </Text>
        </TouchableOpacity>

        <View style={styles.daysOfWeekContainer}>
          <Text style={styles.label}>Days of Week</Text>
          <View style={styles.daysGrid}>
            {DAYS_OF_WEEK.map(day => (
              <TouchableOpacity
                key={day.value}
                style={[
                  styles.dayButton,
                  formData.daysOfWeek.includes(day.value) && styles.dayButtonSelected
                ]}
                onPress={() => toggleDayOfWeek(day.value)}
              >
                <Text style={[
                  styles.dayButtonText,
                  formData.daysOfWeek.includes(day.value) && styles.dayButtonTextSelected
                ]}>
                  {day.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.timeContainer}>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowTimePicker('start')}
          >
            <Clock size={16} color="#6B7280" />
            <Text style={[styles.timeButtonText, !formData.startTime && styles.placeholderText]}>
              {formData.startTime || '--:--'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.timeSeparator}>to</Text>

          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowTimePicker('end')}
          >
            <Clock size={16} color="#6B7280" />
            <Text style={[styles.timeButtonText, !formData.endTime && styles.placeholderText]}>
              {formData.endTime || '--:--'}
            </Text>
          </TouchableOpacity>
        </View>

        <TimePicker
          visible={showTimePicker === 'start'}
          onClose={() => setShowTimePicker(null)}
          onTimeSelect={(time) => {
            setFormData(prev => ({ ...prev, startTime: time }));
            setShowTimePicker(null);
          }}
          currentTime={formData.startTime}
        />

        <TimePicker
          visible={showTimePicker === 'end'}
          onClose={() => setShowTimePicker(null)}
          onTimeSelect={(time) => {
            setFormData(prev => ({ ...prev, endTime: time }));
            setShowTimePicker(null);
          }}
          currentTime={formData.endTime}
        />

        <DatePicker
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          onDateSelect={(date) => {
            setFormData(prev => ({ ...prev, validFrom: date }));
            setShowDatePicker(false);
          }}
          currentDate={formData.validFrom}
        />

        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setShowDurationDropdown(!showDurationDropdown)}
        >
          <Text style={styles.dropdownText}>
            {SLOT_DURATIONS.find(d => d.value === formData.slotDuration)?.label || '20 minutes (default)'}
          </Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>

        {showDurationDropdown && (
          <View style={styles.dropdownList}>
            {SLOT_DURATIONS.map(duration => (
              <TouchableOpacity
                key={duration.value}
                style={styles.dropdownItem}
                onPress={() => {
                  setFormData(prev => ({ ...prev, slotDuration: duration.value }));
                  setShowDurationDropdown(false);
                }}
              >
                <Text style={styles.dropdownItemText}>{duration.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  const renderConfirmationModal = () => {
    console.log('🔍 renderConfirmationModal called, showConfirmation:', showConfirmation);
    const selectedClinic = clinics.find(c => c.id === formData.clinicId);
    const selectedDays = formData.daysOfWeek
      .map(day => DAYS_OF_WEEK.find(d => d.value === day)?.label)
      .filter(Boolean)
      .join(', ');

    return (
      <RNModal
        visible={showConfirmation}
        transparent
        animationType="fade"
        onRequestClose={handleCancelConfirmation}
      >
        <View style={styles.confirmationOverlay}>
          <View style={styles.confirmationContainer}>
            <View style={styles.confirmationHeader}>
              <AlertCircle size={24} color="#1E40AF" />
              <Text style={styles.confirmationTitle}>Confirm Schedule</Text>
            </View>
            
            <ScrollView style={styles.confirmationContent}>
              <Text style={styles.confirmationSubtitle}>
                Please review your schedule details before saving:
              </Text>
              
              <View style={styles.confirmationSection}>
                <Text style={styles.confirmationLabel}>Clinic:</Text>
                <Text style={styles.confirmationValue}>{selectedClinic?.name || 'Unknown'}</Text>
              </View>
              
              <View style={styles.confirmationSection}>
                <Text style={styles.confirmationLabel}>Room/Unit:</Text>
                <Text style={styles.confirmationValue}>{formData.roomOrUnit}</Text>
              </View>
              
              <View style={styles.confirmationSection}>
                <Text style={styles.confirmationLabel}>Valid From:</Text>
                <Text style={styles.confirmationValue}>{formatDate(formData.validFrom, 'short')}</Text>
              </View>
              
              <View style={styles.confirmationSection}>
                <Text style={styles.confirmationLabel}>Days:</Text>
                <Text style={styles.confirmationValue}>{selectedDays}</Text>
              </View>
              
              <View style={styles.confirmationSection}>
                <Text style={styles.confirmationLabel}>Time:</Text>
                <Text style={styles.confirmationValue}>
                  {formData.startTime} - {formData.endTime}
                </Text>
              </View>
              
              <View style={styles.confirmationSection}>
                <Text style={styles.confirmationLabel}>Slot Duration:</Text>
                <Text style={styles.confirmationValue}>{formData.slotDuration} minutes</Text>
              </View>
            </ScrollView>
            
            <View style={styles.confirmationFooter}>
              <Button
                title="Cancel"
                onPress={handleCancelConfirmation}
                variant="outline"
                style={styles.confirmationCancelButton}
              />
              <Button
                title="Save Schedule"
                onPress={handleConfirmSubmit}
                loading={loading}
                style={styles.confirmationSaveButton}
              />
            </View>
          </View>
        </View>
      </RNModal>
    );
  };

  return (
    <>
      <RNModal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>
                {mode === 'add' ? 'Add New Schedule' : 'Edit Schedule'}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {renderClinicSelection()}
                {renderScheduleConfiguration()}
              </ScrollView>
            </View>

            <View style={styles.footer}>
              <Button
                title="Cancel"
                onPress={onClose}
                variant="outline"
                style={styles.cancelButton}
              />
              <Button
                title={mode === 'add' ? 'Add Schedule' : 'Update Schedule'}
                onPress={handleSubmit}
                loading={loading}
                style={styles.submitButton}
              />
            </View>
          </View>
        </View>
      </RNModal>
      
      {renderConfirmationModal()}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    maxHeight: '90%',
    minHeight: '70%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    maxHeight: '60%',
  },
  section: {
    marginVertical: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  sectionDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 20,
  },
  subSection: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
  },
  subSectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 16,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    marginBottom: 8,
  },
  errorBorder: {
    borderColor: '#EF4444',
  },
  dropdownText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  placeholderText: {
    color: '#9CA3AF',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    marginTop: 4,
  },
  dropdownList: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    maxHeight: 200,
    marginTop: 4,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 8,
  },
  daysOfWeekContainer: {
    marginBottom: 16,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
  },
  dayButtonSelected: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  dayButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  dayButtonTextSelected: {
    color: '#FFFFFF',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  timeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    gap: 8,
  },
  timeButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  timeSeparator: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  dateInputButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  dateInputText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
    backgroundColor: '#FFFFFF',
    minHeight: 80,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 1,
  },
  confirmationOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  confirmationContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    maxHeight: '90%',
    minHeight: '60%',
    overflow: 'hidden',
  },
  confirmationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  confirmationTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  confirmationContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    maxHeight: 300,
  },
  confirmationSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 16,
  },
  confirmationSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 4,
  },
  confirmationLabel: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    flex: 1,
  },
  confirmationValue: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    flex: 2,
    textAlign: 'right',
  },
  confirmationFooter: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  confirmationCancelButton: {
    flex: 1,
  },
  confirmationSaveButton: {
    flex: 1,
  },
});
