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
  RefreshControl,
  Modal,
} from 'react-native';
import { Search, User, Users, CheckCircle, Hourglass, XCircle, Check, Bell, RefreshCw, Trash2, Filter, ChevronDown } from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { useRealtimeNotificationContext } from '../../../src/contexts/RealtimeNotificationContext';
import { getSafeNotifications, getSafeUnreadCount } from '../../../src/utils/notificationUtils';
import { databaseService, Patient } from '../../../src/services/database/firebase';
import { safeDataAccess } from '../../../src/utils/safeDataAccess';
import LoadingState from '../../../src/components/ui/LoadingState';
import ErrorBoundary from '../../../src/components/ui/ErrorBoundary';
import { dataValidation } from '../../../src/utils/dataValidation';
import { useDeepMemo } from '../../../src/utils/performance';
import SpecialistHeader from '../../../src/components/navigation/SpecialistHeader';
import { GlobalNotificationModal } from '../../../src/components/shared';

// Extended interface for what the database service actually returns
interface SpecialistPatient extends Patient {
  patientFirstName?: string;
  patientLastName?: string;
  status: string; // Status from appointments/referrals
  lastVisit?: string;
  isScheduledVisit?: boolean;
}

export default function SpecialistPatientsScreen() {
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [patients, setPatients] = useState<SpecialistPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [referrerByPatientId, setReferrerByPatientId] = useState<{ [patientId: string]: string }>({});
  const filters = ['All', 'Active', 'Completed'];

  // Sort functionality
  const [sortBy, setSortBy] = useState('name-az');
  const [showSort, setShowSort] = useState(false);
  
  // Memoized sort options
  const SORT_OPTIONS = useMemo(() => [
    { key: 'name-az', label: 'Patient Name A-Z' },
    { key: 'name-za', label: 'Patient Name Z-A' },
    { key: 'visit-newest', label: 'Latest Visit' },
    { key: 'visit-oldest', label: 'Oldest Visit' },
    { key: 'registration-newest', label: 'Recently Added' },
    { key: 'registration-oldest', label: 'Oldest Added' },
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

  // Load patients from Firebase
  useEffect(() => {
    if (user && user.uid) {
      loadPatients();
    }
  }, [user]);

  const loadPatients = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 Loading patients for specialist:', user.uid);
      const specialistPatients = await databaseService.getPatientsBySpecialist(user.uid);
      
      console.log('📋 Raw patients from database:', specialistPatients);
      
      // Debug: Log the structure of returned patients to understand the data
      if (specialistPatients.length > 0) {
        console.log(' Sample patient structure:', specialistPatients[0]);
        console.log(' Patient statuses:', specialistPatients.map(p => ({ id: p.id, status: (p as any).status })));
        console.log(' All patient fields:', specialistPatients.map(p => Object.keys(p)));
        console.log(' Status field types:', specialistPatients.map(p => ({ id: p.id, status: (p as any).status, statusType: typeof (p as any).status })));
      }
      
      // Validate patients data
      const validPatients = dataValidation.validateArray(specialistPatients, dataValidation.isValidPatient);
      console.log(' Valid patients after validation:', validPatients.length, validPatients);
      
      // Cast to SpecialistPatient[] since the database service adds status and other fields
      const typedPatients = validPatients as SpecialistPatient[];
      
      setPatients(typedPatients);

      // Enrich with referring generalist names per patient based on latest referral, mirroring referral-details logic
      try {
        const referrals = await databaseService.getReferralsBySpecialist(user.uid);
        // Map patientId -> latest referral
        const latestReferralByPatient: { [patientId: string]: any } = {};
        referrals.forEach((r: any) => {
          const pid = r.patientId;
          if (!pid) return;
          const prev = latestReferralByPatient[pid];
          const rTime = new Date(r.referralTimestamp || r.appointmentDate || 0).getTime();
          const pTime = prev ? new Date(prev.referralTimestamp || prev.appointmentDate || 0).getTime() : -1;
          if (!prev || rTime > pTime) {
            latestReferralByPatient[pid] = r;
          }
        });

        // Collect unique referring generalist ids that need profile lookup
        const uniqueGeneralistIds = Array.from(new Set(
          Object.values(latestReferralByPatient)
            .map((r: any) => r?.referringGeneralistId)
            .filter(Boolean)
        ));

        const idToName: { [id: string]: string } = {};
        if (uniqueGeneralistIds.length > 0) {
          const profiles = await Promise.all(uniqueGeneralistIds.map(async (specId) => {
            let profile = await databaseService.getDocument(`specialists/${specId}`);
            if (!profile) {
              profile = await databaseService.getDocument(`users/${specId}`);
            }
            return { id: specId, profile };
          }));
          profiles.forEach(({ id, profile }) => {
            const name = profile
              ? `${profile.firstName || profile.first_name || ''} ${profile.lastName || profile.last_name || ''}`.trim()
              : '';
            idToName[id] = name || 'Unknown Doctor';
          });
        }

        const mapByPatient: { [patientId: string]: string } = {};
        Object.entries(latestReferralByPatient).forEach(([pid, r]: [string, any]) => {
          const fromNames = (r?.referringGeneralistFirstName || r?.referringGeneralistLastName)
            ? `${r.referringGeneralistFirstName || ''} ${r.referringGeneralistLastName || ''}`.trim()
            : '';
          const fromId = r?.referringGeneralistId ? idToName[r.referringGeneralistId] : '';
          const finalName = fromNames || fromId || 'Unknown Doctor';
          mapByPatient[pid] = finalName;
        });

        setReferrerByPatientId(mapByPatient);
      } catch (e) {
        console.log('ℹ️ Could not enrich referring generalist names for patients:', e);
      }
    } catch (error) {
      console.error(' Error loading patients:', error);
      setError('Failed to load patients. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPatients();
    setRefreshing(false);
  };

  const handleRetry = () => {
    setError(null);
    loadPatients();
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

  // Performance optimization: memoize filtered and sorted patients
  const filteredPatients = useDeepMemo(() => {
    console.log(' Filtering patients:', {
      totalPatients: patients.length,
      activeFilter,
      searchQuery,
      patientStatuses: patients.map(p => ({ id: p.id, status: p.status }))
    });
    
    const filtered = patients.filter((patient) => {
      const matchesSearch =
        // Use the fields that the database service actually returns
        (patient.patientFirstName && patient.patientLastName 
          ? `${patient.patientFirstName} ${patient.patientLastName}`.toLowerCase()
          : safeDataAccess.getUserFullName(patient, '').toLowerCase()
        ).includes(searchQuery.toLowerCase()) ||
        patient.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.phoneNumber?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Filter based on the actual status from referrals/appointments
      let matchesFilter = true;
      if (activeFilter === 'Active') {
        // Active patients have confirmed status from appointments/referrals
        matchesFilter = patient.status === 'confirmed';
      } else if (activeFilter === 'Completed') {
        // Completed patients have completed status from appointments/referrals
        matchesFilter = patient.status === 'completed';
      } else if (activeFilter !== 'All') {
        // For any other specific filter, match the exact status
        matchesFilter = patient.status === activeFilter.toLowerCase();
      }
      
      console.log(` Patient ${patient.id} (${patient.patientFirstName} ${patient.patientLastName}):`, {
        status: patient.status,
        matchesSearch,
        matchesFilter,
        finalResult: matchesSearch && matchesFilter
      });
      
      return matchesSearch && matchesFilter;
    });
    
    console.log(' Filtered patients result:', {
      filteredCount: filtered.length,
      filteredPatients: filtered.map(p => ({ id: p.id, status: p.status, name: `${p.patientFirstName} ${p.patientLastName}` }))
    });
    
    // Apply sorting with optimized comparisons
    const sortData = filtered.map(patient => {
      const fullName = patient.patientFirstName && patient.patientLastName 
        ? `${patient.patientFirstName} ${patient.patientLastName}`.toLowerCase()
        : safeDataAccess.getUserFullName(patient, '').toLowerCase();
      const lastVisitDate = new Date(patient.lastVisit || '').getTime() || 0;
      const registrationDate = new Date(patient.createdAt || patient.id || '').getTime() || 0;
      
      switch (sortBy) {
        case 'name-az':
        case 'name-za':
          return {
            patient,
            sortValue: fullName
          };
        case 'visit-newest':
        case 'visit-oldest':
          return {
            patient,
            sortValue: lastVisitDate
          };
        case 'registration-newest':
        case 'registration-oldest':
          return {
            patient,
            sortValue: registrationDate
          };
        default:
          return { patient, sortValue: 0 };
      }
    });

    // Sort based on pre-computed values with direction awareness
    sortData.sort((a, b) => {
      switch (sortBy) {
        case 'name-az':
          return (a.sortValue as string).localeCompare(b.sortValue as string); // A-Z
        case 'name-za':
          return (b.sortValue as string).localeCompare(a.sortValue as string); // Z-A
        case 'visit-newest':
        case 'registration-newest':
          return (b.sortValue as number) - (a.sortValue as number); // Newest first
        case 'visit-oldest':
        case 'registration-oldest':
          return (a.sortValue as number) - (b.sortValue as number); // Oldest first
        default:
          return 0;
      }
    });

    return sortData.map(item => item.patient);
  }, [patients, searchQuery, activeFilter, sortBy]);

  const formatDoctorName = (name?: string): string => {
    if (!name || name.trim().length === 0 || name.toLowerCase().includes('unknown')) {
      return 'Unknown Doctor';
    }
    const stripped = name.replace(/^Dr\.?\s+/i, '').trim();
    return `Dr. ${stripped}`;
  };

  // Neutral monotone status icon, consistent with other screens
  const getStatusIcon = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'confirmed') return <CheckCircle size={14} color="#6B7280" />;
    if (s === 'completed') return <Check size={14} color="#6B7280" />;
    if (s === 'cancelled' || s === 'canceled') return <XCircle size={14} color="#6B7280" />;
    return <Hourglass size={14} color="#6B7280" />;
  };

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

  const renderPatientCard = (patient: SpecialistPatient) => {
    // Use the fields that the database service actually returns
    const patientName = patient.patientFirstName && patient.patientLastName 
      ? `${patient.patientFirstName} ${patient.patientLastName}` 
      : safeDataAccess.getUserFullName(patient, 'Unknown Patient');
    const initials = patient.patientFirstName && patient.patientLastName
      ? `${patient.patientFirstName[0]}${patient.patientLastName[0]}`.toUpperCase()
      : safeDataAccess.getUserInitials(patient, 'U');
    // Use the actual status from referrals/appointments for proper display
    const statusDisplay = patient.status === 'confirmed' ? 'Active' : 
                         patient.status === 'completed' ? 'Completed' : 
                         patient.status === 'cancelled' || patient.status === 'canceled' ? 'Cancelled' :
                         patient.status || 'Active';
    const referringDoctorRaw = referrerByPatientId[patient.id];
    const referringDoctor = referringDoctorRaw ? formatDoctorName(referringDoctorRaw) : 'Unknown Doctor';

    return (
      <TouchableOpacity
        key={patient.id}
        style={styles.patientCard}
        activeOpacity={0.87}
        onPress={() => router.push(`/patient-overview?id=${patient.id}`)}
      >
        {/* First row: Avatar, Name, Status Badge */}
        <View style={styles.patientHeader}>
          <View style={styles.patientAvatar}>
            <Text style={styles.patientInitial}>
              {initials || 'P'}
            </Text>
          </View>
          <View style={styles.patientInfo}>
            <Text style={styles.patientName}>{patientName || 'Unknown Patient'}</Text>
            <Text style={styles.patientReferrer}>Referred by: {referringDoctor}</Text>
          </View>
          <View style={[styles.statusBadgeNeutral]}>
            {getStatusIcon(patient.status)}
            <Text style={styles.statusTextNeutral}>{statusDisplay}</Text>
          </View>
        </View>

        {/* Meta table: Label left, Value right */}
        <View style={styles.patientDetailsTable}>
          <View style={styles.metaRow}> 
            <Text style={styles.metaLabel}>Last visit</Text>
            <Text style={styles.metaValue}>
              {patient.lastVisit && patient.lastVisit !== 'No visits yet' 
                ? (patient as any).isScheduledVisit 
                  ? `Scheduled: ${patient.lastVisit}` 
                  : patient.lastVisit 
                : 'No visits yet'}
            </Text>
          </View>
          <View style={styles.metaRow}> 
            <Text style={styles.metaLabel}>Address</Text>
            <Text style={styles.metaValue}>
              {patient.address || 'Address not available'}
            </Text>
          </View>
          <View style={styles.metaRowNoBorder}> 
            <Text style={styles.metaLabel}>Phone</Text>
            <Text style={styles.metaValue}>
              {patient.phoneNumber || 'Phone not available'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* Header */}
              <SpecialistHeader 
          title="Patients" 
          onNotificationPress={handleOpenNotifications}
          notificationCount={unreadCount}
        />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={18} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search patients by name, address, or phone"
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

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterButton,
                activeFilter === filter && styles.activeFilterButton,
              ]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === filter && styles.activeFilterText,
                ]}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      {renderSortDropdown()}

      {/* Patients List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.patientsList}>
          {loading ? (
            <LoadingState
              message="Loading patients..."
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
          ) : filteredPatients.length > 0 ? (
            filteredPatients.map(renderPatientCard)
          ) : (
            <View style={styles.emptyState}>
              <Users size={48} color="#9CA3AF" />
              <Text style={styles.emptyStateTitle}>
                No {activeFilter.toLowerCase()} patients found
              </Text>
              <Text style={styles.emptyStateText}>
                {activeFilter === 'All' 
                  ? "You don't have any confirmed or completed appointments with patients yet."
                  : activeFilter === 'Active'
                  ? "You don't have any confirmed appointments with patients at the moment."
                  : "You don't have any completed appointments with patients at the moment."
                }
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
      
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
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
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
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filtersContent: {
    paddingHorizontal: 24,
    gap: 12,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activeFilterButton: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  filterText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  patientsList: {
    paddingHorizontal: 24,
    paddingVertical: 16, 
    gap: 16,
  },
  patientCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  patientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  patientInitial: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  patientInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  patientName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  patientReferrer: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadgeNeutral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  statusTextNeutral: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  patientDetailsTable: {
    marginTop: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  metaRowNoBorder: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 7,
  },
  metaLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
    flex: 1.1,
  },
  metaValue: {
    fontSize: 14,
    color: '#1F2937',
    fontFamily: 'Inter-Regular',
    flex: 2,
    textAlign: 'right',
    lineHeight: 19,
  },
  contactInfo: {
    marginBottom: 4,
  },
  contactText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  // Sort button and dropdown styles
  sortButton: {
    height: 65, width: 65, // Match search bar height (12 padding top + 12 padding bottom + content)
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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

 