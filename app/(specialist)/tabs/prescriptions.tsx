import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Pill, CircleCheck as CheckCircle, Bell, RefreshCw, Trash2, Check, Search, Filter, ChevronDown } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { useRealtimeNotificationContext } from '../../../src/contexts/RealtimeNotificationContext';
import { getSafeNotifications, getSafeUnreadCount } from '../../../src/utils/notificationUtils';
import { databaseService, Prescription } from '../../../src/services/database/firebase';
import { safeDataAccess } from '../../../src/utils/safeDataAccess';
import { formatFrequency, formatRoute, formatPrescriptionDuration, formatFormula } from '../../../src/utils/formatting';
import { formatDate } from '../../../src/utils/date';
import LoadingState from '../../../src/components/ui/LoadingState';
import ErrorBoundary from '../../../src/components/ui/ErrorBoundary';
import { dataValidation } from '../../../src/utils/dataValidation';
import { useDeepMemo } from '../../../src/utils/performance';
import SpecialistHeader from '../../../src/components/navigation/SpecialistHeader';
import { GlobalNotificationModal } from '../../../src/components/shared';

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
    notifications: realtimeNotificationData,
  } = useRealtimeNotificationContext();
  
  // Safely extract notifications and unread count
  const notifications = getSafeNotifications(realtimeNotificationData.notifications);
  const unreadCount = getSafeUnreadCount(realtimeNotificationData.unreadCount);
  const notificationsLoading = realtimeNotificationData.loading;
  const notificationsError = realtimeNotificationData.error;
  const markAsRead = realtimeNotificationData.markAsRead;
  const markAllAsRead = realtimeNotificationData.markAllAsRead;
  const deleteNotification = realtimeNotificationData.deleteNotification;
  const refreshNotifications = realtimeNotificationData.refresh;
  const handleNotificationPress = realtimeNotificationData.handleNotificationPress;
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [patientNames, setPatientNames] = useState<{ [patientId: string]: string }>({});
  
  // Sort functionality
  const [sortBy, setSortBy] = useState('date-newest');
  const [showSort, setShowSort] = useState(false);
  
  // Memoized sort options
  const SORT_OPTIONS = useMemo(() => [
    { key: 'date-newest', label: 'Latest Prescribed' },
    { key: 'date-oldest', label: 'Oldest Prescribed' },
    { key: 'medication-az', label: 'Medication A-Z' },
    { key: 'medication-za', label: 'Medication Z-A' },
    { key: 'patient-az', label: 'Patient A-Z' },
    { key: 'patient-za', label: 'Patient Z-A' },
  ], []);

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
      
      // console.log('Loaded prescriptions:', validPrescriptions.length);
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

  // Sort dropdown handlers - memoized for performance
  const handleShowSort = useCallback(() => {
    setShowSort(prev => !prev);
  }, []);

  const handleSortOptionSelect = useCallback((optionKey: string) => {
    setSortBy(optionKey);
    setShowSort(false);
  }, []);

  const handleCloseSortDropdown = useCallback(() => {
    setShowSort(false);
  }, []);

  // Performance optimization: memoize filtered prescriptions
  const activePrescriptions = useDeepMemo(() => 
    prescriptions.filter(p => p.status === 'active'), [prescriptions]
  );
  
  const pastPrescriptions = useDeepMemo(() => 
    prescriptions.filter(p => p.status === 'completed' || p.status === 'discontinued'), [prescriptions]
  );

  const filterPrescriptions = (list: Prescription[]) => {
    const filtered = list.filter((item: Prescription) => {
      const medicationMatch = item.medication?.toLowerCase().includes(searchQuery.toLowerCase());
      const patientNameMatch = patientNames[item.patientId]?.toLowerCase().includes(searchQuery.toLowerCase());
      return medicationMatch || patientNameMatch;
    });

    // Apply sorting
    const sortData = filtered.map(prescription => {
      const medication = prescription.medication?.toLowerCase() || '';
      const patientName = patientNames[prescription.patientId]?.toLowerCase() || '';
      const prescribedDate = new Date(prescription.prescribedDate || '').getTime() || 0;
      
      switch (sortBy) {
        case 'date-newest':
        case 'date-oldest':
          return {
            prescription,
            sortValue: prescribedDate
          };
        case 'medication-az':
        case 'medication-za':
          return {
            prescription,
            sortValue: medication
          };
        case 'patient-az':
        case 'patient-za':
          return {
            prescription,
            sortValue: patientName
          };
        default:
          return { prescription, sortValue: 0 };
      }
    });

    // Sort based on pre-computed values with direction awareness
    sortData.sort((a, b) => {
      switch (sortBy) {
        case 'date-newest':
          return (b.sortValue as number) - (a.sortValue as number); // Newest first
        case 'date-oldest':
          return (a.sortValue as number) - (b.sortValue as number); // Oldest first
        case 'medication-az':
        case 'patient-az':
          return (a.sortValue as string).localeCompare(b.sortValue as string); // A-Z
        case 'medication-za':
        case 'patient-za':
          return (b.sortValue as string).localeCompare(a.sortValue as string); // Z-A
        default:
          return 0;
      }
    });

    return sortData.map(item => item.prescription);
  };

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

  // Sort dropdown render function
  const renderSortDropdown = useCallback(() => {
    if (!showSort) return null;
    
    return (
      <View style={styles.sortDropdownContainer}>
        <TouchableOpacity
          style={styles.sortDropdownBackdrop}
          activeOpacity={1}
          onPress={handleCloseSortDropdown}
        />
        <View style={styles.sortDropdown}>
          {SORT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.sortDropdownItem,
                sortBy === option.key && styles.sortDropdownActiveItem,
              ]}
              onPress={() => handleSortOptionSelect(option.key)}
            >
              <Text
                style={[
                  styles.sortDropdownText,
                  sortBy === option.key && styles.sortDropdownActiveText,
                ]}
              >
                {option.label}
              </Text>
              {sortBy === option.key && (
                <Check size={16} color="#1E40AF" style={{ marginLeft: 6 }} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }, [showSort, sortBy, SORT_OPTIONS, handleCloseSortDropdown, handleSortOptionSelect]);

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
          notificationCount={unreadCount}
        />
       {/* Filters Container */}
       <View style={styles.filtersContainer}>
         <View style={styles.searchRow}>
           <View style={styles.searchInputContainer}>
             <Search size={18} color="#9CA3AF" style={styles.searchIcon} />
             <TextInput
               style={styles.searchInput}
               placeholder="Search prescriptions or patient names..."
               placeholderTextColor="#9CA3AF"
               value={searchQuery}
               onChangeText={setSearchQuery}
             />
           </View>
           <TouchableOpacity
             style={styles.sortButton}
             onPress={handleShowSort}
           >
             <Filter size={22} color="#6B7280" />
             <ChevronDown size={20} color="#6B7280" />
           </TouchableOpacity>
         </View>
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
         {renderSortDropdown()}
       </View>
      {renderContent()}
      
      {/* === GLOBAL NOTIFICATION MODAL === */}
      <GlobalNotificationModal
        visible={showNotificationModal}
        onClose={handleCloseNotificationModal}
        userRole="specialist"
      />
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 36,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    paddingVertical: 0,
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
  // Sort button and dropdown styles
  sortButton: {
    height: 48, // Match search bar height
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    gap: 4,
  },
  sortDropdownContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  sortDropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  sortDropdown: {
    position: 'absolute',
    top: 90, // Adjust based on header height
    right: 24,
    minWidth: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  sortDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sortDropdownActiveItem: {
    backgroundColor: '#F3F4F6',
  },
  sortDropdownText: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter-Regular',
  },
  sortDropdownActiveText: {
    color: '#1E40AF',
    fontFamily: 'Inter-Medium',
  },
});
