import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Edit, Trash2, Calendar, Clock, MapPin, Building, Check } from 'lucide-react-native';
import { SpecialistSchedule, Clinic } from '../types/schedules';
import Button from './ui/Button';
import { formatDate } from '../utils/date';

interface ScheduleListProps {
  schedules: SpecialistSchedule[];
  clinics: Clinic[];
  referrals: any[];
  appointments?: any[]; // Optional appointments for blocking check
  onEdit: (schedule: SpecialistSchedule) => void;
  onDelete: (scheduleId: string) => Promise<void>;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ScheduleList({ 
  schedules, 
  clinics, 
  referrals,
  appointments = [],
  onEdit, 
  onDelete
}: ScheduleListProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<SpecialistSchedule | null>(null);
  const getClinicName = (clinicId: string) => {
    return clinics.find(c => c.id === clinicId)?.name || 'Unknown Clinic';
  };

  const formatDaysOfWeek = (days: number[]) => {
    return days.map(day => DAYS_OF_WEEK[day]).join(', ');
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

  const formatTimeRange = (slotTemplate: any) => {
    const times = Object.keys(slotTemplate);
    if (times.length === 0) return 'No time slots';
    
    // Sort times chronologically instead of alphabetically
    const sortedTimes = sortTimesChronologically(times);
    const startTime = sortedTimes[0];
    const endTime = sortedTimes[sortedTimes.length - 1];
    const duration = slotTemplate[startTime]?.durationMinutes || 20;
    
    return `${startTime} - ${endTime} (${duration} min slots)`;
  };

           const handleDelete = (schedule: SpecialistSchedule) => {
      console.log('🗑️ Delete button pressed for schedule:', schedule.id);
      setScheduleToDelete(schedule);
      setShowDeleteModal(true);
    };

    const confirmDelete = () => {
      if (scheduleToDelete) {
        console.log('🗑️ User confirmed deletion for schedule:', scheduleToDelete.id);
        onDelete(scheduleToDelete.id);
        setShowDeleteModal(false);
        setScheduleToDelete(null);
      }
    };

    const cancelDelete = () => {
      console.log('🗑️ User cancelled deletion for schedule:', scheduleToDelete?.id);
      setShowDeleteModal(false);
      setScheduleToDelete(null);
    };

  const canEditSchedule = (schedule: SpecialistSchedule) => {
    const validFromDate = new Date(schedule.validFrom);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if there are any referrals that match this schedule's pattern
    // A schedule should be locked if there's a referral that matches:
    // 1. The schedule's recurrence pattern (day of week)
    // 2. The schedule's time slots
    // 3. The appointment date is on or after the schedule's validFrom date
    const hasConfirmedReferrals = referrals.some(referral => {
      if (referral.status !== 'pending' && referral.status !== 'confirmed' && referral.status !== 'completed') return false;
      
      // Parse appointment date as local date to avoid timezone issues
      const [year, month, day] = referral.appointmentDate.split('-').map(Number);
      const appointmentDate = new Date(year, month - 1, day); // month is 0-indexed
      
      // Check if appointment date is on or after the schedule's validFrom date
      if (appointmentDate < validFromDate) return false;
      
      // Check if the appointment day of week matches the schedule's recurrence pattern
      const appointmentDayOfWeek = appointmentDate.getDay(); // 0-6 (Sunday-Saturday)
      if (!schedule.recurrence.dayOfWeek.includes(appointmentDayOfWeek)) return false;
      
      // Check if the appointment time matches one of the schedule's time slots
      const scheduleTimeSlots = Object.keys(schedule.slotTemplate);
      if (!scheduleTimeSlots.includes(referral.appointmentTime)) return false;
      
      return true;
    });

    // Also check if there are any appointments (not cancelled) that match this schedule's pattern
    // This includes follow-up appointments and other direct bookings
    const hasConfirmedAppointments = appointments.some(appointment => {
      // Block if status is NOT cancelled (pending, confirmed, completed all block)
      if (appointment.status === 'cancelled') return false;
      
      // Parse appointment date as local date to avoid timezone issues
      const [year, month, day] = appointment.appointmentDate.split('-').map(Number);
      const appointmentDate = new Date(year, month - 1, day); // month is 0-indexed
      
      // Check if appointment date is on or after the schedule's validFrom date
      if (appointmentDate < validFromDate) return false;
      
      // Check if the appointment day of week matches the schedule's recurrence pattern
      const appointmentDayOfWeek = appointmentDate.getDay(); // 0-6 (Sunday-Saturday)
      if (!schedule.recurrence.dayOfWeek.includes(appointmentDayOfWeek)) return false;
      
      // Check if the appointment time matches one of the schedule's time slots
      const scheduleTimeSlots = Object.keys(schedule.slotTemplate);
      if (!scheduleTimeSlots.includes(appointment.appointmentTime)) return false;
      
      return true;
    });

    return !hasConfirmedReferrals && !hasConfirmedAppointments;
  };

  if (schedules.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Calendar size={48} color="#9CA3AF" />
        <Text style={styles.emptyTitle}>No Schedules</Text>
        <Text style={styles.emptyText}>
          You haven't created any schedules yet. Add your first schedule to start managing your availability.
        </Text>
        <Button
          title="Add First Schedule"
          onPress={onAddNew}
          style={styles.addButton}
        />
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.scheduleList} showsVerticalScrollIndicator={false}>
        {schedules.map((schedule) => {
          console.log('🗑️ Rendering schedule:', schedule.id, schedule);
          const canEdit = canEditSchedule(schedule);
          
          // Skip rendering if schedule ID is missing
          if (!schedule.id) {
            console.error('❌ Schedule missing ID:', schedule);
            return null;
          }
          
          return (
            <View key={schedule.id} style={styles.scheduleCard}>
              <View style={styles.scheduleHeader}>
                <View style={styles.clinicInfo}>
                  <Building size={16} color="#1E40AF" />
                  <Text style={styles.clinicName}>
                    {getClinicName(schedule.practiceLocation.clinicId)}
                  </Text>
                  <View style={styles.statusBadge}>
                    {schedule.isActive ? (
                      <>
                        <Check size={14} color="#374151" />
                        <Text style={styles.statusText}>Active</Text>
                      </>
                    ) : (
                      <Text style={styles.statusText}>Inactive</Text>
                    )}
                  </View>
                </View>
                
                <View style={styles.actions}>
                  {canEdit ? (
                    <>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => onEdit(schedule)}
                      >
                        <Edit size={16} color="#1E40AF" />
                      </TouchableOpacity>
                                             <TouchableOpacity
                         style={[styles.actionButton, styles.deleteButton]}
                         onPress={() => {
                           console.log('🗑️ Trash button touched for schedule:', schedule.id);
                           handleDelete(schedule);
                         }}
                         activeOpacity={0.7}
                       >
                        <Trash2 size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={styles.lockedIndicator}>
                      <Text style={styles.lockedText}>Locked</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.scheduleDetails}>
                <View style={styles.detailRow}>
                  <MapPin size={14} color="#6B7280" />
                  <Text style={styles.detailText}>
                    {schedule.practiceLocation.roomOrUnit}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Calendar size={14} color="#6B7280" />
                  <Text style={styles.detailText}>
                    Valid from: {formatDate(schedule.validFrom, 'short')}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Clock size={14} color="#6B7280" />
                  <Text style={styles.detailText}>
                    {formatDaysOfWeek(schedule.recurrence.dayOfWeek)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Clock size={14} color="#6B7280" />
                  <Text style={styles.detailText}>
                    {formatTimeRange(schedule.slotTemplate)}
                  </Text>
                </View>
              </View>

              {!canEdit && (
                <View style={styles.warningContainer}>
                  <Ionicons name="information-circle" size={16} color="#6B7280" style={styles.warningIcon} />
                  <Text style={styles.warningText}>
                    This schedule cannot be modified because it has confirmed appointments that match this schedule's pattern.
                  </Text>
                </View>
              )}

            </View>
          );
        })}
      </ScrollView>

      {/* Custom Delete Confirmation Modal */}
      <Modal
         visible={showDeleteModal}
         transparent={true}
         animationType="fade"
         onRequestClose={cancelDelete}
       >
         <View style={styles.modalOverlay}>
           <View style={styles.modalContent}>
             <View style={styles.modalHeader}>
               <Text style={styles.modalTitle}>🗑️ Delete Schedule</Text>
             </View>
             
             <View style={styles.modalBody}>
               <Text style={styles.modalMessage}>
                 Are you sure you want to delete the schedule for{' '}
                 <Text style={styles.clinicNameHighlight}>
                   {scheduleToDelete ? getClinicName(scheduleToDelete.practiceLocation.clinicId) : ''}
                 </Text>?
               </Text>
               <Text style={styles.modalWarning}>
                 This action cannot be undone.
               </Text>
             </View>
             
             <View style={styles.modalActions}>
               <TouchableOpacity
                 style={[styles.modalButton, styles.cancelButton]}
                 onPress={cancelDelete}
               >
                 <Text style={styles.cancelButtonText}>Cancel</Text>
               </TouchableOpacity>
               
               <TouchableOpacity
                 style={[styles.modalButton, styles.modalDeleteButton]}
                 onPress={confirmDelete}
               >
                 <Text style={styles.deleteButtonText}>Delete</Text>
               </TouchableOpacity>
             </View>
           </View>
         </View>
       </Modal>
    </>
  );
 }

const styles = StyleSheet.create({
  scheduleList: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  scheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clinicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  clinicName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#DBEAFE',
  },
  deleteButton: {
    backgroundColor: '#DBEAFE',
  },
  lockedIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#DBEAFE',
    borderRadius: 4,
  },
  lockedText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
  },
  scheduleDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    flex: 1,
  },
  warningContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  warningIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  warningText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeStatus: {
    backgroundColor: '#10B981',
  },
  inactiveStatus: {
    backgroundColor: '#9CA3AF',
  },
  statusText: {
    fontSize: 12,
    color: '#374151',
    fontFamily: 'Inter-Medium',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#F9FAFB',
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginTop: 16,
  },
     emptyText: {
     fontSize: 14,
     fontFamily: 'Inter-Regular',
     color: '#6B7280',
     textAlign: 'center',
     marginTop: 8,
     marginBottom: 24,
     lineHeight: 20,
   },
   // Modal styles
   modalOverlay: {
     flex: 1,
     backgroundColor: 'rgba(0, 0, 0, 0.5)',
     justifyContent: 'center',
     alignItems: 'center',
   },
   modalContent: {
     backgroundColor: '#FFFFFF',
     borderRadius: 12,
     padding: 24,
     marginHorizontal: 24,
     maxWidth: 400,
     width: '100%',
   },
   modalHeader: {
     marginBottom: 16,
   },
   modalTitle: {
     fontSize: 20,
     fontFamily: 'Inter-Bold',
     color: '#1F2937',
     textAlign: 'center',
   },
   modalBody: {
     marginBottom: 24,
   },
   modalMessage: {
     fontSize: 16,
     fontFamily: 'Inter-Regular',
     color: '#374151',
     textAlign: 'center',
     lineHeight: 24,
   },
   clinicNameHighlight: {
     fontFamily: 'Inter-SemiBold',
     color: '#1E40AF',
   },
   modalWarning: {
     fontSize: 14,
     fontFamily: 'Inter-Medium',
     color: '#EF4444',
     textAlign: 'center',
     marginTop: 8,
   },
   modalActions: {
     flexDirection: 'row',
     gap: 12,
   },
   modalButton: {
     flex: 1,
     paddingVertical: 12,
     paddingHorizontal: 16,
     borderRadius: 8,
     alignItems: 'center',
   },
   cancelButton: {
     backgroundColor: '#F3F4F6',
   },
   cancelButtonText: {
     fontSize: 16,
     fontFamily: 'Inter-SemiBold',
     color: '#374151',
   },
   modalDeleteButton: {
     backgroundColor: '#EF4444',
   },
   deleteButtonText: {
     fontSize: 16,
     fontFamily: 'Inter-SemiBold',
     color: '#FFFFFF',
   },
 });
