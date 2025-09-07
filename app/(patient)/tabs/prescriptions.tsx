import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Alert,
} from 'react-native';
import {
  Pill,
  CircleCheck as CheckCircle,
  Search,
  Filter,
  ChevronDown,
  Check,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/auth/useAuth';
import { usePrescriptions } from '@/hooks/data/usePrescriptions';
import { Prescription } from '@/services/database/firebase';
import { safeDataAccess } from '@/utils/safeDataAccess';
import { formatFrequency, formatRoute, formatPrescriptionDuration, formatFormula } from '@/utils/formatting';
import { formatDate } from '@/utils/date';
import LoadingState from '@/components/ui/LoadingState';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { dataValidation } from '@/utils/dataValidation';
import { useDeepMemo } from '@/utils/performance';

// Utility function to calculate prescription status based on duration
const calculatePrescriptionStatus = (prescription: Prescription): 'active' | 'completed' | 'discontinued' => {
  // If status is already discontinued, keep it
  if (prescription.status === 'discontinued') {
    return 'discontinued';
  }

  // If status is already completed, keep it
  if (prescription.status === 'completed') {
    return 'completed';
  }

  // Check if the prescription has expired
  if (prescription.prescribedDate) {
    try {
      const prescribedDate = new Date(prescription.prescribedDate);
      const now = new Date();
      
      // Parse duration string (e.g., "7 days", "2 weeks", "1 month")
      const durationMatch = prescription.duration.match(/^(\d+)\s*(day|days|week|weeks|month|months|year|years)$/i);
      
      if (durationMatch) {
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
            endDate.setDate(endDate.getDate() + (durationUnit === 'week' ? durationAmount * 7 : durationAmount * 7));
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
        if (now > endDate) {
          return 'completed';
        }
      }
    } catch (error) {
      console.error('Error calculating prescription status:', error);
    }
  }

  // If we can't determine the status or it's still valid, keep as active
  return 'active';
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

export default function PrescriptionsScreen() {
  const { user } = useAuth();
  const { prescriptions, loading, error, refresh } = usePrescriptions();
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sort functionality
  const [sortBy, setSortBy] = useState('date-newest');
  const [showSort, setShowSort] = useState(false);
  
  // Memoized sort options
  const SORT_OPTIONS = useMemo(() => [
    { key: 'date-newest', label: 'Latest Added' },
    { key: 'date-oldest', label: 'Oldest Added' },
    { key: 'medication-az', label: 'Medication A-Z' },
    { key: 'medication-za', label: 'Medication Z-A' },
    { key: 'duration-short', label: 'Duration: Short to Long' },
    { key: 'duration-long', label: 'Duration: Long to Short' },
  ], []);

  // Header initials for logged in user
  const userInitials = (() => {
    const fullName = safeDataAccess.getUserFullName(user, user?.email || 'User');
    return fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || 'U';
  })();

  // Validate prescriptions data and calculate status
  const validPrescriptions = useDeepMemo(() => 
    dataValidation.validateArray(prescriptions, dataValidation.isValidPrescription)
      .map(prescription => {
        // If status is already completed or discontinued, keep it
        if (prescription.status === 'completed' || prescription.status === 'discontinued') {
          return prescription;
        }
        
        // Check if prescription has expired
        if (prescription.prescribedDate && prescription.duration) {
          try {
            const prescribedDate = new Date(prescription.prescribedDate);
            const now = new Date();
            
            // Parse duration string (e.g., "7 days", "2 weeks", "1 month")
            const durationMatch = prescription.duration.match(/^(\d+)\s*(day|days|week|weeks|month|months|year|years)$/i);
            
            if (durationMatch) {
              const [, amount, unit] = durationMatch;
              const durationAmount = parseInt(amount, 10);
              const durationUnit = unit.toLowerCase();
              
              // Calculate end date
              const endDate = new Date(prescription.prescribedDate);
              
              switch (durationUnit) {
                case 'day':
                case 'days':
                  endDate.setDate(endDate.getDate() + durationAmount);
                  break;
                case 'week':
                case 'weeks':
                  endDate.setDate(endDate.getDate() + (durationUnit === 'week' ? durationAmount * 7 : durationAmount * 7));
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
                  break;
              }
              
              // If current date is past the end date, mark as completed
              if (now > endDate) {
                return {
                  ...prescription,
                  status: 'completed'
                };
              }
            }
          } catch (error) {
            console.error('Error checking prescription expiration:', error);
          }
        }
        
        // If we can't determine the status or it's still valid, keep as active
        return prescription;
      }), [prescriptions]
  );

  const handleRetry = () => {
    refresh();
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

  const activePrescriptions = useDeepMemo(() => 
    validPrescriptions.filter(p => p.status === 'active'), [validPrescriptions]
  );
  
  const pastPrescriptions = useDeepMemo(() => 
    validPrescriptions.filter(p => p.status === 'completed' || p.status === 'discontinued'), [validPrescriptions]
  );
  
  // Debug logging
  console.log('Total prescriptions:', validPrescriptions.length);
  console.log('Prescription statuses:', validPrescriptions.map(p => ({ id: p.id, status: p.status, originalStatus: p.status })));
  console.log('Active prescriptions:', activePrescriptions.length);
  console.log('Past prescriptions:', pastPrescriptions.length);
  console.log('Available statuses:', Array.from(new Set(validPrescriptions.map(p => p.status))));

  // Optimized filter and sort function
  const filterAndSortPrescriptions = useCallback((list: Prescription[]) => {
    // First filter by search query
    let filtered = list.filter((item: Prescription) => 
      item.medication?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Then apply sorting with optimized comparisons
    const sortData = filtered.map(prescription => {
      const prescriptionDate = new Date(prescription.prescribedDate || '').getTime() || 0;
      const medicationName = (prescription.medication || '').toLowerCase();
      
      // Convert duration to comparable number (days) for duration sorting
      const durationMatch = prescription.duration?.match(/^(\d+)\s*(day|days|week|weeks|month|months|year|years)$/i);
      let durationDays = 0;
      if (durationMatch) {
        const [, amount, unit] = durationMatch;
        const durationAmount = parseInt(amount, 10);
        const durationUnit = unit.toLowerCase();
        switch (durationUnit) {
          case 'day':
          case 'days':
            durationDays = durationAmount;
            break;
          case 'week':
          case 'weeks':
            durationDays = durationAmount * 7;
            break;
          case 'month':
          case 'months':
            durationDays = durationAmount * 30; // Approximate
            break;
          case 'year':
          case 'years':
            durationDays = durationAmount * 365; // Approximate
            break;
        }
      }
      
      switch (sortBy) {
        case 'date-newest':
        case 'date-oldest':
          return {
            prescription,
            sortValue: prescriptionDate
          };
        case 'medication-az':
        case 'medication-za':
          return {
            prescription,
            sortValue: medicationName
          };
        case 'duration-short':
        case 'duration-long':
          return {
            prescription,
            sortValue: durationDays
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
          return (a.sortValue as string).localeCompare(b.sortValue as string); // A-Z
        case 'medication-za':
          return (b.sortValue as string).localeCompare(a.sortValue as string); // Z-A
        case 'duration-short':
          return (a.sortValue as number) - (b.sortValue as number); // Short to long
        case 'duration-long':
          return (b.sortValue as number) - (a.sortValue as number); // Long to short
        default:
          return 0;
      }
    });

    return sortData.map(item => item.prescription);
  }, [searchQuery, sortBy]);

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

  const renderActivePrescription = (prescription: Prescription) => (
    <View key={prescription.id} style={styles.prescriptionCard}>
      <View style={styles.prescriptionHeader}>
        <View style={[styles.medicationIcon, { backgroundColor: '#1E3A8A15' }]}> 
          <Pill size={20} color="#1E3A8A" />
        </View>
        <View style={styles.prescriptionDetails}>
          <Text style={styles.medicationName}>{prescription.medication || 'Unknown Medication'}</Text>
          <Text style={styles.medicationDosage}>
            {prescription.dosage || 'N/A'} • {formatFrequency(prescription.frequency, 'patient')}
            {prescription.formula && ` • ${formatFormula(prescription.formula, 'patient')}`}
            {prescription.take && ` • Take: ${prescription.take}`}
            {prescription.totalQuantity && ` • Total: ${prescription.totalQuantity}`}
          </Text>
          {prescription.route && (
            <Text style={styles.medicationRoute}>
              {formatRoute(prescription.route, 'patient')}
            </Text>
          )}
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
          <Text style={styles.medicationDosage}>
            {prescription.dosage || 'N/A'} • {formatFrequency(prescription.frequency, 'patient')}
            {prescription.formula && ` • ${formatFormula(prescription.formula, 'patient')}`}
            {prescription.take && ` • Take: ${prescription.take}`}
            {prescription.totalQuantity && ` • Total: ${prescription.totalQuantity}`}
          </Text>
          {prescription.route && (
            <Text style={styles.medicationRoute}>
              {formatRoute(prescription.route, 'patient')}
            </Text>
          )}
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
            ? 'Your active prescriptions will appear here once prescribed by your healthcare provider.'
            : type === 'Past'
            ? 'Your completed or discontinued prescriptions will appear here.'
            : 'Your prescriptions will appear here once prescribed by your healthcare provider.'
        }
      </Text>
    </View>
  );

  let filteredActive = filterAndSortPrescriptions(activePrescriptions);
  let filteredPast = filterAndSortPrescriptions(pastPrescriptions);
  
  // Debug logging for filtered results
  console.log('Active prescriptions:', activePrescriptions.length);
  console.log('Past prescriptions:', pastPrescriptions.length);
  console.log('Filtered active prescriptions:', filteredActive.length);
  console.log('Filtered past prescriptions:', filteredPast.length);

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Prescriptions</Text>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/(patient)/tabs/profile')}
          >
            <Text style={styles.profileInitialsText}>{userInitials}</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputContainer}>
            <Search size={18} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search prescriptions"
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
         {renderSortDropdown()}

         <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 95 }}
        >
          <View style={styles.prescriptionsList}>
            {loading ? (
                            <LoadingState
                message="Loading prescriptions..."
                variant="inline"
                size="large"
              />
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : activeTab === 'All' ? (
              <>
                {validPrescriptions.length === 0
                  ? renderEmptyState('All')
                  : (
                    <>
                      {filteredActive.length === 0
                        ? renderEmptyState('Active')
                        : filteredActive.map(renderActivePrescription)}
                      {filteredPast.length === 0
                        ? renderEmptyState('Past')
                        : filteredPast.map(renderPastPrescription)}
                    </>
                  )
                }
              </>
            ) : activeTab === 'Active' ? (
              filteredActive.length === 0
                ? renderEmptyState('Active')
                : filteredActive.map(renderActivePrescription)
            ) : (
              filteredPast.length === 0
                ? renderEmptyState('Past')
                : filteredPast.map(renderPastPrescription)
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 24,
    color: '#1F2937',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
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
    paddingVertical: 22,
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
  profileInitialsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12,
    paddingTop: 0,
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
  medicationDosage: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  medicationDuration: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  prescriptionDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  prescriptionStatus: {
    alignItems: 'flex-end',
    gap: 8,
  },
  remainingDays: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'right',
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
  medicationRoute: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
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
    // borderRadius: 10,
    // backgroundColor: '#F9FAFB',
    // borderWidth: 1,
    // borderColor: '#E5E7EB',
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
    borderRadius: 10,
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
