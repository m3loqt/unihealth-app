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
  ActivityIndicator,
} from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
} from 'lucide-react-native';
import { router, useNavigation } from 'expo-router';
import { useAuth } from '../../src/hooks/auth/useAuth';
import { databaseService } from '../../src/services/database/firebase';
import LoadingState from '../../src/components/ui/LoadingState';
import ErrorBoundary from '../../src/components/ui/ErrorBoundary';

interface ScheduleSlot {
  time: string;
  defaultStatus: 'available' | 'booked' | 'unavailable';
  durationMinutes: number;
  isBooked?: boolean; // New field to track if this slot is actually booked
}

interface ScheduleDay {
  date: string;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
  isPast: boolean;
  slots: ScheduleSlot[];
  hasSchedule: boolean;
}

interface SpecialistSchedule {
  id: string;
  createdAt: string;
  isActive: boolean;
  lastUpdated: string;
  practiceLocation: {
    clinicId: string;
    roomOrUnit: string;
  };
  recurrence: {
    dayOfWeek: { [key: string]: number };
    type: string;
    scheduleType: string;
  };
  slotTemplate: { [key: string]: { defaultStatus: string; durationMinutes: number } };
  specialistId: string;
  validFrom: string;
}

export default function SpecialistScheduleScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState<SpecialistSchedule[]>([]);
  const [clinicData, setClinicData] = useState<{[key: string]: any}>({});
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [referrals, setReferrals] = useState<any[]>([]);

  // Generate calendar data for the current month
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    console.log('Generating calendar for:', year, month, 'Current date:', currentDate);
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
        // Check if the day of week matches any of the values in dayOfWeek object
        return Object.values(schedule.recurrence.dayOfWeek).includes(dayOfWeek);
      });

      // Generate slots for this day if it has a schedule
      let slots: ScheduleSlot[] = [];
      if (hasSchedule) {
        const activeSchedule = schedules.find(schedule => {
          if (!schedule.isActive || new Date(schedule.validFrom) > date) return false;
          const dayOfWeek = date.getDay(); // 0-6 (Sunday-Saturday)
          // Check if the day of week matches any of the values in dayOfWeek object
          return Object.values(schedule.recurrence.dayOfWeek).includes(dayOfWeek);
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
               isBooked: isBooked,
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
  }, [currentDate, schedules, referrals]);

  // Load specialist schedules
  const loadSchedules = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      setError(null);

      // Get specialist schedules and referrals in parallel
      const [specialistSchedulesData, referralsData] = await Promise.all([
        databaseService.getSpecialistSchedules(user.uid),
        databaseService.getSpecialistReferrals(user.uid)
      ]);
      
      // Set referrals data
      console.log('Loaded referrals:', referralsData);
      setReferrals(referralsData || []);
      
      if (specialistSchedulesData) {
        const schedulesArray: SpecialistSchedule[] = Object.entries(specialistSchedulesData).map(([id, data]: [string, any]) => ({
          id,
          ...data,
        }));

        console.log('Loaded schedules:', schedulesArray);
        setSchedules(schedulesArray);

        // Load clinic data for all schedules
        const clinicIds = new Set<string>();
        schedulesArray.forEach(schedule => {
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
    } catch (error) {
      console.error('Error loading schedules:', error);
      setError('Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSchedules();
    setRefreshing(false);
  };

  const handleRetry = () => {
    setError(null);
    loadSchedules();
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
          ]}>
            {day.dayNumber}
          </Text>
                     {day.hasSchedule && (
             <View style={[
               styles.scheduleIndicator,
               day.slots.some(slot => slot.isBooked) && styles.bookedIndicator
             ]} />
           )}
        </TouchableOpacity>
      ))}
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
      const dayOfWeek = selectedDate.getDay().toString();
      return schedule.recurrence.dayOfWeek[dayOfWeek] !== undefined;
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
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => {
                // Check if we can go back, otherwise navigate to specialist tabs
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
            <Text style={styles.headerTitle}>My Schedule</Text>
            <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
              <Text style={styles.todayButtonText}>Today</Text>
            </TouchableOpacity>
          </View>

          {/* Calendar */}
          <View style={styles.calendarContainer}>
            {renderCalendarHeader()}
            {renderDayNames()}
            {renderCalendarDays()}
          </View>

          {/* Selected Date Details */}
          {renderSelectedDateDetails()}
        </ScrollView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 16 : 16,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  todayButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  todayButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  navButton: {
    padding: 8,
  },
  monthYearText: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  dayNames: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  dayName: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dayNumber: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
  },
  todayCell: {
    backgroundColor: '#1E40AF',
    borderRadius: 8,
  },
  todayText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },
  selectedCell: {
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
  },
  selectedText: {
    color: '#1E40AF',
    fontFamily: 'Inter-Bold',
  },
  pastDay: {
    opacity: 0.5,
  },
  pastDayText: {
    color: '#9CA3AF',
  },
  scheduleIndicator: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#10B981',
  },
  bookedIndicator: {
    backgroundColor: '#3B82F6', // Blue color for booked appointments
  },
  noScheduleContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  noScheduleTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginTop: 16,
  },
  noScheduleText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  scheduleDetails: {
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    padding: 24,
  },
  scheduleHeader: {
    marginBottom: 20,
  },
  scheduleDate: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  timeSlotsContainer: {
    marginTop: 16,
  },
  timeSlotsTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 12,
  },
  timeSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  timeSlotText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
});
