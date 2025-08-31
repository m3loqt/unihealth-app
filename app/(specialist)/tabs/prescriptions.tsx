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
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Pill, CircleCheck as CheckCircle, Bell, RefreshCw, Trash2, Check, Search } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { useNotifications } from '../../../src/hooks/data/useNotifications';
import { databaseService, Prescription } from '../../../src/services/database/firebase';
import { safeDataAccess } from '../../../src/utils/safeDataAccess';
import { formatFrequency, formatRoute, formatPrescriptionDuration, formatFormula } from '../../../src/utils/formatting';
import { formatDate } from '../../../src/utils/date';
import LoadingState from '../../../src/components/ui/LoadingState';
import ErrorBoundary from '../../../src/components/ui/ErrorBoundary';
import { dataValidation } from '../../../src/utils/dataValidation';
import { useDeepMemo } from '../../../src/utils/performance';
import SpecialistHeader from '../../../src/components/navigation/SpecialistHeader';

// Utility function to calculate prescription status based on duration
const calculatePrescriptionStatus = (prescription: Prescription): 'active' | 'completed' | 'discontinued' => {
  // If status is already discontinued, keep it
  if (prescription.status === 'discontinued') {
    return 'discontinued';
  }

  // If duration is "Ongoing" or similar, keep as active
  if (!prescription.duration || 
      prescription.duration.toLowerCase().includes('ongoing') || 
      prescription.duration.toLowerCase().includes('continuous')) {
    return 'active';
  }

  try {
    const prescribedDate = new Date(prescription.prescribedDate);
    const now = new Date();
    
    // Parse duration string (e.g., "7 days", "2 weeks", "1 month")
    const durationMatch = prescription.duration.match(/^(\d+)\s*(day|days|week|weeks|month|months|year|years)$/i);
    
    if (!durationMatch) {
      // If we can't parse the duration, assume it's active
      return 'active';
    }

    const [, amount, unit] = durationMatch;
    const durationAmount = parseInt(amount, 10);
    const durationUnit = unit.toLowerCase();

    // Calculate end date
    const endDate = new Date(prescribedDate);
    
    switch (durationUnit) {
      case 'day':
      case 'days':
        endDate.setDate(endDate.getDate() + durationAmount);
        break;
      case 'week':
      case 'weeks':
        endDate.setDate(endDate.getDate() + (durationAmount * 7));
        break;
      case 'month':
      case 'months':
        endDate.setMonth(endDate.getMonth() + durationAmount);
        break;
      case 'year':
      case 'years':
        endDate.setFullYear(endDate.getFullYear() + durationAmount);
        break;
      default:
        return 'active';
    }

    // If current date is past the end date, mark as completed
    return now > endDate ? 'completed' : 'active';
  } catch (error) {
    console.error('Error calculating prescription status:', error);
    return 'active';
  }
};

// Utility function to calculate remaining days for active prescriptions
const calculateRemainingDays = (prescription: Prescription): number | null => {
  if (prescription.status !== 'active') {
    return null;
  }

  // If duration is "Ongoing" or similar, return null (no end date)
  if (!prescription.duration || 
      prescription.duration.toLowerCase().includes('ongoing') || 
      prescription.duration.toLowerCase().includes('continuous')) {
    return null;
  }

  try {
    const prescribedDate = new Date(prescription.prescribedDate);
    const now = new Date();
    
    // Parse duration string (e.g., "7 days", "2 weeks", "1 month")
    const durationMatch = prescription.duration.match(/^(\d+)\s*(day|days|week|weeks|month|months|year|years)$/i);
    
    if (!durationMatch) {
      return null;
    }

    const [, amount, unit] = durationMatch;
    const durationAmount = parseInt(amount, 10);
    const durationUnit = unit.toLowerCase();

    // Calculate end date
    const endDate = new Date(prescribedDate);
    
    switch (durationUnit) {
      case 'day':
      case 'days':
        endDate.setDate(endDate.getDate() + durationAmount);
        break;
      case 'week':
      case 'weeks':
        endDate.setDate(endDate.getDate() + (durationAmount * 7));
        break;
      case 'month':
      case 'months':
        endDate.setMonth(endDate.getMonth() + durationAmount);
        break;
      case 'year':
      case 'years':
        endDate.setFullYear(endDate.getFullYear() + durationAmount);
        break;
      default:
        return null;
    }

    // Calculate remaining days
    const remainingTime = endDate.getTime() - now.getTime();
    const remainingDays = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));
    
    return remainingDays > 0 ? remainingDays : 0;
  } catch (error) {
    console.error('Error calculating remaining days:', error);
    return null;
  }
};

export default function SpecialistPrescriptionsScreen() {
  const { search } = useLocalSearchParams();
  const { user } = useAuth();
  const { 
    notifications, 
    loading: notificationsLoading, 
    error: notificationsError,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: refreshNotifications
  } = useNotifications();
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [patientNames, setPatientNames] = useState<{ [patientId: string]: string }>({});

  // Notification Modal State
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  
  // Notification Modal Actions
  const handleOpenNotifications = () => setShowNotificationModal(true);
  const handleCloseNotificationModal = () => setShowNotificationModal(false);
  
  // Handle marking notification as read
  const handleMarkAsRead = async (notificationId: string) => {
    await markAsRead(notificationId);
  };
  
  // Handle deleting notification
  const handleDeleteNotification = async (notificationId: string) => {
    await deleteNotification(notificationId);
  };
  
  // Handle marking all notifications as read
  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  // Load prescriptions from Firebase
  useEffect(() => {
    if (user && user.uid) {
      loadPrescriptions();
    }
  }, [user]);

  // Handle search parameter from URL
  useEffect(() => {
    if (search) {
      setSearchQuery(String(search));
    }
  }, [search]);

  const loadPrescriptions = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      const specialistPrescriptions = await databaseService.getPrescriptionsBySpecialist(user.uid);
      
      // Validate prescriptions data and calculate status
      const validPrescriptions = dataValidation.validateArray(specialistPrescriptions, dataValidation.isValidPrescription)
        .map(prescription => ({
          ...prescription,
          status: calculatePrescriptionStatus(prescription)
        }));
      
      console.log('Loaded prescriptions:', validPrescriptions.length);
      setPrescriptions(validPrescriptions);
      
      // Load patient names for display
      const uniquePatientIds = Array.from(new Set(validPrescriptions.map(p => p.patientId)));
      const patientNamesData: { [patientId: string]: string } = {};
      
      for (const patientId of uniquePatientIds) {
        try {
          const patientData = await databaseService.getDocument(`users/${patientId}`);
          if (patientData) {
            const firstName = patientData.firstName || patientData.first_name || '';
            const lastName = patientData.lastName || patientData.last_name || '';
            patientNamesData[patientId] = `${firstName} ${lastName}`.trim() || 'Unknown Patient';
          } else {
            patientNamesData[patientId] = 'Unknown Patient';
          }
        } catch (error) {
          console.error('Error loading patient name for ID:', patientId, error);
          patientNamesData[patientId] = 'Unknown Patient';
        }
      }
      
      setPatientNames(patientNamesData);
    } catch (error) {
      console.error('Error loading prescriptions:', error);
      setError('Failed to load prescriptions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPrescriptions();
    setRefreshing(false);
  };

  const handleRetry = () => {
    setError(null);
    loadPrescriptions();
  };

  // Performance optimization: memoize filtered prescriptions
  const activePrescriptions = useDeepMemo(() => 
    prescriptions.filter(p => p.status === 'active'), [prescriptions]
  );
  
  const pastPrescriptions = useDeepMemo(() => 
    prescriptions.filter(p => p.status === 'completed' || p.status === 'discontinued'), [prescriptions]
  );

  const filterPrescriptions = (list: Prescription[]) =>
    list.filter((item: Prescription) => {
      const medicationMatch = item.medication?.toLowerCase().includes(searchQuery.toLowerCase());
      const patientNameMatch = patientNames[item.patientId]?.toLowerCase().includes(searchQuery.toLowerCase());
      return medicationMatch || patientNameMatch;
    });

  const renderActivePrescription = (prescription: Prescription) => (
    <View key={prescription.id} style={styles.prescriptionCard}>
      <View style={styles.prescriptionHeader}>
        <View style={[styles.medicationIcon, { backgroundColor: '#1E3A8A15' }]}> 
          <Pill size={20} color="#1E3A8A" />
        </View>
        <View style={styles.prescriptionDetails}>
          <Text style={styles.medicationName}>{prescription.medication || 'Unknown Medication'}</Text>
          <Text style={styles.patientName}>{patientNames[prescription.patientId] || 'Unknown Patient'}</Text>
          <Text style={styles.medicationDosage}>
            {prescription.dosage || 'N/A'} • {formatFrequency(prescription.frequency, 'specialist')}
            {prescription.route && ` • ${formatRoute(prescription.route, 'specialist')}`}
            {prescription.formula && ` • ${formatFormula(prescription.formula, 'specialist')}`}
            {prescription.take && ` • Take: ${prescription.take}`}
            {prescription.totalQuantity && ` • Total: ${prescription.totalQuantity}`}
          </Text>
          <Text style={styles.prescriptionDescription}>
            {prescription.instructions || 'No additional instructions'}
          </Text>
        </View>
        <View style={styles.prescriptionStatus}>
          <View style={styles.statusBadge}>
            <CheckCircle size={16} color="#6B7280" style={styles.statusIcon} />
            <Text style={styles.statusText}>Active</Text>
          </View>
          {(() => {
            const remainingDays = calculateRemainingDays(prescription);
            if (remainingDays !== null) {
              return (
                <Text style={styles.remainingDays}>
                  {remainingDays} days left
                </Text>
              );
            } else {
              return (
                <Text style={styles.remainingDays}>
                  Ongoing
                </Text>
              );
            }
          })()}
        </View>
      </View>
      <View style={styles.prescriptionMeta}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Prescribed on:</Text>
          <Text style={styles.metaValue}>
            {prescription.prescribedDate ? formatDate(prescription.prescribedDate, 'prescription') : 'Date not available'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Duration:</Text>
          <Text style={styles.metaValue}>
            {formatPrescriptionDuration(prescription.duration)}
          </Text>
        </View>

      </View>
    </View>
  );

  const renderPastPrescription = (prescription: Prescription) => (
    <View key={prescription.id} style={styles.prescriptionCard}>
      <View style={styles.prescriptionHeader}>
        <View style={[styles.medicationIcon, { backgroundColor: '#1E3A8A15' }]}> 
          <Pill size={20} color="#1E3A8A" />
        </View>
        <View style={styles.prescriptionDetails}>
          <Text style={styles.medicationName}>{prescription.medication || 'Unknown Medication'}</Text>
          <Text style={styles.patientName}>{patientNames[prescription.patientId] || 'Unknown Patient'}</Text>
          <Text style={styles.medicationDosage}>
            {prescription.dosage || 'N/A'} • {formatFrequency(prescription.frequency, 'specialist')}
            {prescription.route && ` • ${formatRoute(prescription.route, 'specialist')}`}
            {prescription.formula && ` • ${formatFormula(prescription.formula, 'specialist')}`}
            {prescription.take && ` • Take: ${prescription.take}`}
            {prescription.totalQuantity && ` • Total: ${prescription.totalQuantity}`}
          </Text>
          <Text style={styles.prescriptionDescription}>
            {prescription.instructions || 'No additional instructions'}
          </Text>
        </View>
        <View style={styles.prescriptionStatus}>
          <View style={styles.statusBadge}>
            {prescription.status === 'completed' ? (
              <CheckCircle size={16} color="#6B7280" style={styles.statusIcon} />
            ) : (
              <Pill size={16} color="#6B7280" style={styles.statusIcon} />
            )}
            <Text style={styles.statusText}>
              {prescription.status === 'completed' ? 'Completed' : 'Discontinued'}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.prescriptionMeta}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Prescribed on:</Text>
          <Text style={styles.metaValue}>
            {prescription.prescribedDate ? formatDate(prescription.prescribedDate, 'prescription') : 'Date not available'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Duration:</Text>
          <Text style={styles.metaValue}>
            {formatPrescriptionDuration(prescription.duration)}
          </Text>
        </View>

      </View>
    </View>
  );

  const renderEmptyState = (type: string) => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Pill size={48} color="#9CA3AF" />
      </View>
      <Text style={styles.emptyTitle}>
        {loading ? 'Loading prescriptions...' : type === 'All' ? 'No prescriptions found' : `No ${type.toLowerCase()} prescriptions found`}
      </Text>
      <Text style={styles.emptyDescription}>
        {loading 
          ? 'Please wait while we load your prescriptions...'
          : type === 'Active' 
            ? 'Your active prescriptions will appear here once prescribed to your patients.'
            : type === 'Past'
            ? 'Your completed or discontinued prescriptions will appear here.'
            : 'Your prescriptions will appear here once prescribed to your patients.'
        }
      </Text>
    </View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <LoadingState
          message="Loading prescriptions..."
          variant="inline"
          size="large"
        />
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (activeTab === 'All') {
      const allPrescriptions = filterPrescriptions(prescriptions);
      return allPrescriptions.length > 0 ? (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.prescriptionsList}>
            {allPrescriptions.map(renderActivePrescription)}
          </View>
        </ScrollView>
      ) : (
        renderEmptyState('All')
      );
    }

    if (activeTab === 'Active') {
      const filteredActive = filterPrescriptions(activePrescriptions);
      return filteredActive.length > 0 ? (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.prescriptionsList}>
            {filteredActive.map(renderActivePrescription)}
          </View>
        </ScrollView>
      ) : (
        renderEmptyState('Active')
      );
    }

    if (activeTab === 'Past') {
      const filteredPast = filterPrescriptions(pastPrescriptions);
      return filteredPast.length > 0 ? (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.prescriptionsList}>
            {filteredPast.map(renderPastPrescription)}
          </View>
        </ScrollView>
      ) : (
        renderEmptyState('Past')
      );
    }

    return null;
  };

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
              <SpecialistHeader 
          title="Prescriptions Issued" 
          onNotificationPress={handleOpenNotifications}
          notificationCount={notifications.filter(n => !n.read).length}
        />
             {/* Search Bar */}
       <View style={styles.searchContainer}>
         <View style={styles.searchInputContainer}>
           <Search size={20} color="#9CA3AF" style={styles.searchIcon} />
           <TextInput
             style={styles.searchInput}
             placeholder="Search prescriptions or patient names..."
             placeholderTextColor="#9CA3AF"
             value={searchQuery}
             onChangeText={setSearchQuery}
           />
         </View>
       </View>

       <View style={styles.filtersContainer}>
         <View style={styles.filtersBarRow}>
           <ScrollView
             horizontal
             showsHorizontalScrollIndicator={false}
             contentContainerStyle={styles.filtersContent}
           >
             <View style={styles.filtersLeft}>
               {['All', 'Active', 'Past'].map((filter) => (
                 <TouchableOpacity
                   key={filter}
                   style={[
                     styles.filterButton,
                     activeTab === filter && styles.activeFilterButton,
                   ]}
                   onPress={() => setActiveTab(filter)}
                 >
                   <Text
                     style={[
                       styles.filterText,
                       activeTab === filter && styles.activeFilterText,
                     ]}
                   >
                     {filter}
                   </Text>
                 </TouchableOpacity>
               ))}
             </View>
           </ScrollView>
         </View>
       </View>
      {renderContent()}
      
      {/* === NOTIFICATION MODAL === */}
      <Modal
        visible={showNotificationModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseNotificationModal}
      >
        <View style={notificationModalStyles.modalBackdrop}>
          <View style={notificationModalStyles.modalContainer}>
            <View style={notificationModalStyles.modalContent}>
              <View style={notificationModalStyles.modalHeader}>
                <Bell size={32} color="#1E40AF" />
                <Text style={notificationModalStyles.modalTitle}>Notifications</Text>
                <Text style={notificationModalStyles.modalSubtext}>
                  {notifications.filter(n => !n.read).length} unread notification{notifications.filter(n => !n.read).length !== 1 ? 's' : ''}
                </Text>
              </View>
              
              {/* Action Buttons */}
              <View style={[notificationModalStyles.modalActions, { marginBottom: 12 }]}>
                <TouchableOpacity
                  style={notificationModalStyles.modalActionButton}
                  onPress={refreshNotifications}
                >
                  <RefreshCw size={20} color="#1E40AF" />
                  <Text style={notificationModalStyles.modalActionButtonText}>Refresh</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={notificationModalStyles.modalActionButton}
                  onPress={handleMarkAllAsRead}
                >
                  <Check size={20} color="#1E40AF" />
                  <Text style={notificationModalStyles.modalActionButtonText}>Mark All Read</Text>
                </TouchableOpacity>
              </View>

              {notifications.length === 0 ? (
                <Text style={[notificationModalStyles.emptyNotificationText, { marginBottom: 12, marginTop: 12 }]}>No notifications yet</Text>
              ) : (
                <ScrollView
                  style={notificationModalStyles.notificationScroll}
                  contentContainerStyle={notificationModalStyles.notificationListContent}
                  showsVerticalScrollIndicator
                >
                  {notifications.map((notification) => (
                    <View key={notification.id} style={[notificationModalStyles.notificationItem, !notification.read && notificationModalStyles.unreadNotification]}>
                      <View style={notificationModalStyles.notificationContent}>
                        <Text style={[notificationModalStyles.notificationText, !notification.read && notificationModalStyles.unreadText]}>
                          {notification.message}
                        </Text>
                        <Text style={notificationModalStyles.notificationTime}>
                          {new Date(notification.timestamp).toLocaleString()}
                        </Text>
                      </View>
                      <View style={notificationModalStyles.notificationActions}>
                        {!notification.read && (
                          <TouchableOpacity
                            style={notificationModalStyles.notificationActionButton}
                            onPress={() => handleMarkAsRead(notification.id)}
                          >
                            <Check size={16} color="#1E40AF" />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={notificationModalStyles.notificationActionButton}
                          onPress={() => handleDeleteNotification(notification.id)}
                        >
                          <Trash2 size={16} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}

              <View style={notificationModalStyles.modalActions}>
                <TouchableOpacity
                  style={notificationModalStyles.modalSecondaryButton}
                  onPress={handleCloseNotificationModal}
                >
                  <Text style={notificationModalStyles.modalSecondaryButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  searchContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    fontFamily: 'Inter-Regular',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12,
    paddingTop: 8,
  },
  filtersBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
    position: 'relative',
    zIndex: 1,
  },
  filtersContent: {
    gap: 10,
    alignItems: 'center',
    paddingVertical: 2,
  },
  filtersLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 6,
  },
  activeFilterButton: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  filterText: {
    fontSize: 14,
    color: '#6B7280',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  prescriptionsList: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 16,
  },
  prescriptionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 4,
  },
  prescriptionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  medicationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  prescriptionDetails: {
    flex: 1,
  },
  medicationName: {
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 2,
  },
  patientName: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  medicationDosage: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  prescriptionDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  prescriptionStatus: {
    alignItems: 'flex-end',
    gap: 8,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  statusText: {
    fontSize: 12,
    color: '#374151',
    fontFamily: 'Inter-Medium',
  },
  statusIcon: {
    marginRight: 4,
  },
  remainingDays: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  prescriptionMeta: {
    gap: 4,
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  metaValue: {
    fontSize: 14,
    color: '#374151',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },

  errorContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    margin: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Inter-Regular',
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

// Notification Modal Styles
const notificationModalStyles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContainer: {
    width: '100%',
    maxWidth: '100%',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    alignItems: 'center',
    paddingBottom: 24,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSubtext: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalActionButtonText: {
    color: '#1E40AF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    marginLeft: 8,
  },
  modalSecondaryButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalSecondaryButtonText: {
    color: '#374151',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  notificationScroll: {
    width: '100%',
    maxHeight: 400,
    marginBottom: 16,
  },
  notificationListContent: {
    paddingBottom: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#F3F4F6',
  },
  unreadNotification: {
    backgroundColor: '#E0F2FE',
    borderColor: '#1E40AF',
    borderWidth: 1,
  },
  notificationContent: {
    flex: 1,
    marginRight: 10,
    maxWidth: '85%',
  },
  notificationText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
  },
  unreadText: {
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  notificationTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 4,
  },
  notificationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  notificationActionButton: {
    padding: 4,
  },
  emptyNotificationText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
});