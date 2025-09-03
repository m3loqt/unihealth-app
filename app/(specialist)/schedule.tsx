import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Plus,
} from 'lucide-react-native';
import { router, useNavigation } from 'expo-router';
import { useAuth } from '../../src/hooks/auth/useAuth';
import { useSpecialistSchedules } from '../../src/hooks/data/useSpecialistSchedules';
import { databaseService } from '../../src/services/database/firebase';
import LoadingState from '../../src/components/ui/LoadingState';
import ErrorBoundary from '../../src/components/ui/ErrorBoundary';
import ScheduleForm from '../../src/components/ScheduleForm';
import ScheduleList from '../../src/components/ScheduleList';

import { ScheduleSlot, ScheduleDay, SpecialistSchedule, ScheduleFormData } from '../../src/types/schedules';

export default function SpecialistScheduleScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<SpecialistSchedule | null>(null);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [clinicData, setClinicData] = useState<{[key: string]: any}>({});
  const [refreshing, setRefreshing] = useState(false);

  // Use the custom hook for schedule management
  const {
    schedules,
    referrals,
    loading,
    error,
    loadSchedules,
    addSchedule,
    updateSchedule,
    deleteSchedule,
  } = useSpecialistSchedules(user?.uid || '');

  // Generate calendar data for the current month
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: ScheduleDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNumber = date.getDate();
      const dateString = date.toISOString().split('T')[0];
      const isToday = date.toDateString() === today.toDateString();
      const isPast = date < today;

      // Check if this date has a schedule
      const hasSchedule = schedules.some(schedule => {
        if (!schedule.isActive || new Date(schedule.validFrom) > date) return false;
        const dayOfWeek = date.getDay(); // 0-6 (Sunday-Saturday)
        return schedule.recurrence.dayOfWeek.includes(dayOfWeek);
      });

      // Generate slots for this day if it has a schedule
      let slots: ScheduleSlot[] = [];
      if (hasSchedule) {
        const activeSchedule = schedules.find(schedule => {
          if (!schedule.isActive || new Date(schedule.validFrom) > date) return false;
          const dayOfWeek = date.getDay();
          return schedule.recurrence.dayOfWeek.includes(dayOfWeek);
        });

        if (activeSchedule) {
          slots = Object.entries(activeSchedule.slotTemplate).map(([time, slot]) => {
            // Simple check: is this specific date and time slot booked?
            const isBooked = referrals.some(referral =>
              referral.assignedSpecialistId === user?.uid &&
              referral.appointmentDate === dateString &&
              referral.appointmentTime === time &&
              (referral.status === 'confirmed' || referral.status === 'completed')
            );

            return {
              time,
              defaultStatus: slot.defaultStatus as 'available' | 'booked' | 'unavailable',
              durationMinutes: slot.durationMinutes,
              isBooked,
            };
          });
        }
      }

      days.push({
        date: dateString,
        dayName,
        dayNumber,
        isToday,
        isPast,
        slots,
        hasSchedule,
      });
    }

    return days;
  }, [currentDate, schedules, referrals, user?.uid]);

  // Load clinic data for schedules
  useEffect(() => {
    const loadClinicData = async () => {
      if (schedules.length > 0) {
        const clinicIds = new Set<string>();
        schedules.forEach(schedule => {
          if (schedule.practiceLocation?.clinicId) {
            clinicIds.add(schedule.practiceLocation.clinicId);
          }
        });

        const clinicDataPromises = Array.from(clinicIds).map(async (clinicId) => {
          try {
            const clinic = await databaseService.getDocument(`clinics/${clinicId}`);
            return { [clinicId]: clinic };
          } catch (error) {
            console.error(`Error loading clinic ${clinicId}:`, error);
            return { [clinicId]: null };
          }
        });

        const clinicResults = await Promise.all(clinicDataPromises);
        const clinicDataMap = Object.assign({}, ...clinicResults);
        setClinicData(clinicDataMap);
      }
    };

    loadClinicData();
  }, [schedules]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSchedules();
    setRefreshing(false);
  };

  const handleRetry = () => {
    loadSchedules();
  };

  // Schedule management handlers
  const handleAddSchedule = () => {
    if (!user?.uid) {
      Alert.alert('Error', 'User not authenticated. Please sign in again.');
      return;
    }
    setFormMode('add');
    setEditingSchedule(null);
    setShowScheduleForm(true);
  };

  const handleEditSchedule = (schedule: SpecialistSchedule) => {
    setFormMode('edit');
    setEditingSchedule(schedule);
    setShowScheduleForm(true);
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      await deleteSchedule(scheduleId);
      Alert.alert(
        'Success',
        'Schedule has been successfully deleted!',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error deleting schedule:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to delete schedule. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleSubmitSchedule = async (formData: ScheduleFormData) => {
    try {
      if (formMode === 'add') {
        await addSchedule(formData);
        Alert.alert(
          'Success',
          'Schedule has been successfully added!',
          [{ text: 'OK' }]
        );
      } else if (formMode === 'edit' && editingSchedule) {
        await updateSchedule(editingSchedule.id, formData);
        Alert.alert(
          'Success',
          'Schedule has been successfully updated!',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ Schedule screen - Error submitting schedule:', error);
      throw error;
    }
  };

  const goToPreviousMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(null);
  };

  const handleDateSelect = (day: ScheduleDay) => {
    if (day.isPast) return;
    setSelectedDate(new Date(day.date));
  };

  const getClinicName = (clinicId: string) => {
    return clinicData[clinicId]?.name || 'Unknown Clinic';
  };

  const renderCalendarHeader = () => (
    <View style={styles.calendarHeader}>
      <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
        <ChevronLeft size={24} color="#1E40AF" />
      </TouchableOpacity>
      <Text style={styles.monthYearText}>
        {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </Text>
      <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
        <ChevronRight size={24} color="#1E40AF" />
      </TouchableOpacity>
    </View>
  );

  const renderDayNames = () => (
    <View style={styles.dayNames}>
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
        <Text key={day} style={styles.dayName}>
          {day}
        </Text>
      ))}
    </View>
  );

  const renderCalendarDays = () => (
    <View style={styles.calendarGrid}>
      {calendarData.map((day, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.dayCell,
            day.isToday && styles.todayCell,
            selectedDate && selectedDate.toDateString() === new Date(day.date).toDateString() && styles.selectedCell,
            day.isPast && styles.pastDay,
          ]}
          onPress={() => handleDateSelect(day)}
          disabled={day.isPast}
        >
          <Text style={[
            styles.dayNumber,
            day.isToday && styles.todayText,
            selectedDate && selectedDate.toDateString() === new Date(day.date).toDateString() && styles.selectedText,
            day.isPast && styles.pastDayText,
            !day.isToday && day.hasSchedule && day.slots.some(slot => slot.isBooked) && styles.bookedDateText,
            !day.isToday && day.hasSchedule && !day.slots.some(slot => slot.isBooked) && styles.availableDateText,
          ]}>
            {day.dayNumber}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderCalendarLegend = () => (
    <View style={styles.legendContainer}>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: '#1E40AF' }]} />
        <Text style={styles.legendLabel}>Available</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
        <Text style={styles.legendLabel}>Has bookings</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: '#9CA3AF' }]} />
        <Text style={styles.legendLabel}>No schedule</Text>
      </View>
    </View>
  );

  const renderSelectedDateDetails = () => {
    if (!selectedDate) return null;

    const selectedDay = calendarData.find(day =>
      new Date(day.date).toDateString() === selectedDate.toDateString()
    );

    if (!selectedDay || !selectedDay.hasSchedule) {
      return (
        <View style={styles.noScheduleContainer}>
          <CalendarIcon size={48} color="#9CA3AF" />
          <Text style={styles.noScheduleTitle}>No Schedule</Text>
          <Text style={styles.noScheduleText}>
            You don't have any appointments scheduled for this day.
          </Text>
        </View>
      );
    }

    const activeSchedule = schedules.find(schedule => {
      if (!schedule.isActive || new Date(schedule.validFrom) > selectedDate) return false;
      const dayOfWeek = selectedDate.getDay();
      return schedule.recurrence.dayOfWeek.includes(dayOfWeek);
    });

    if (!activeSchedule) return null;

    const clinicName = getClinicName(activeSchedule.practiceLocation.clinicId);

    return (
      <View style={styles.scheduleDetails}>
        <View style={styles.scheduleHeader}>
          <Text style={styles.scheduleDate}>
            {selectedDate.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Text>
          <View style={styles.locationInfo}>
            <MapPin size={16} color="#6B7280" />
            <Text style={styles.locationText}>
              {clinicName} - {activeSchedule.practiceLocation.roomOrUnit}
            </Text>
          </View>
        </View>

        <View style={styles.timeSlotsContainer}>
          <Text style={styles.timeSlotsTitle}>Time Slots</Text>
          {selectedDay.slots.map((slot, index) => (
            <View key={index} style={styles.timeSlot}>
              <Clock size={16} color="#6B7280" />
              <Text style={styles.timeSlotText}>
                {slot.time} ({slot.durationMinutes} min)
                {slot.isBooked && ' - Booked'}
              </Text>
              <View style={[
                styles.statusIndicator,
                slot.isBooked ? styles.bookedStatus : (
                  slot.defaultStatus === 'available' ? styles.availableStatus :
                  slot.defaultStatus === 'booked' ? styles.bookedStatus :
                  slot.defaultStatus === 'unavailable' ? styles.unavailableStatus : null
                )
              ]} />
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingState message="Loading your schedule..." />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaView style={[styles.container, Platform.OS === 'android' ? { paddingTop: StatusBar.currentHeight } : null]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => {
                if (navigation.canGoBack()) {
                  router.back();
                } else {
                  router.push('/(specialist)/tabs');
                }
              }}
              style={styles.backButton}
            >
              <ChevronLeft size={24} color="#1E40AF" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>My Schedule</Text>
            </View>
            <View style={styles.headerActions}>
          
              <TouchableOpacity onPress={handleAddSchedule} style={styles.addButton}>
                <Plus size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Calendar */}
          <View style={styles.calendarContainer}>
            {renderCalendarHeader()}
            {renderDayNames()}
            {renderCalendarDays()}
            {renderCalendarLegend()}
          </View>

          {/* Selected Date Details */}
          {renderSelectedDateDetails()}

          {/* Schedule Management Section */}
          <View style={styles.scheduleManagementContainer}>
            <ScheduleList
              schedules={schedules}
              clinics={Object.values(clinicData).filter(Boolean)}
              referrals={referrals}
              onEdit={handleEditSchedule}
              onDelete={handleDeleteSchedule}
              onAddNew={handleAddSchedule}
            />
          </View>
        </ScrollView>

        {/* Schedule Form Modal */}
        <ScheduleForm
          visible={showScheduleForm}
          onClose={() => setShowScheduleForm(false)}
          onSubmit={handleSubmitSchedule}
          schedule={editingSchedule}
          mode={formMode}
        />
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 16,
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
  headerContent: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  todayButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
  },
  todayButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: '#1E40AF',
    padding: 12,
    borderRadius: 12,
  },
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  monthYearText: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  dayNames: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  dayName: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    paddingVertical: 8,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  dayNumber: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
  },
  todayCell: {
    backgroundColor: '#1E40AF',
    borderRadius: 16,
    shadowColor: '#1E40AF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  todayText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },
  selectedCell: {
    backgroundColor: '#DBEAFE',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#1E40AF',
  },
  selectedText: {
    color: '#1E40AF',
    fontFamily: 'Inter-Bold',
  },
  pastDay: {
    opacity: 0.4,
  },
  pastDayText: {
    color: '#9CA3AF',
  },
  availableDateText: {
    color: '#1E40AF',
    fontFamily: 'Inter-SemiBold',
  },
  bookedDateText: {
    color: '#10B981',
    fontFamily: 'Inter-SemiBold',
  },

  // Legend styles
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendSwatch: {
    width: 20,
    height: 12,
    borderRadius: 4,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  legendToday: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  legendSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#1E40AF',
  },
  legendLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#4B5563',
  },

  noScheduleContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  noScheduleTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginTop: 20,
  },
  noScheduleText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  scheduleDetails: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scheduleHeader: {
    marginBottom: 24,
  },
  scheduleDate: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  locationText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  timeSlotsContainer: {
    marginTop: 20,
  },
  timeSlotsTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 16,
  },
  timeSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 12,
    gap: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  timeSlotText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
  availableStatus: {
    backgroundColor: '#10B981',
  },
  bookedStatus: {
    backgroundColor: '#EF4444',
  },
  unavailableStatus: {
    backgroundColor: '#9CA3AF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
  },
  scheduleManagementContainer: {
    marginTop: 16,
    marginBottom: 24,
  },
});
