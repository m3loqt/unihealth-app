import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Search, User, Users } from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { databaseService, Patient } from '../../../src/services/database/firebase';
import { safeDataAccess } from '../../../src/utils/safeDataAccess';
import LoadingState from '../../../src/components/ui/LoadingState';
import ErrorBoundary from '../../../src/components/ui/ErrorBoundary';
import { dataValidation } from '../../../src/utils/dataValidation';
import { useDeepMemo } from '../../../src/utils/performance';

export default function SpecialistPatientsScreen() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const filters = ['All', 'Active', 'Completed'];

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
      
      // Validate patients data
      const validPatients = dataValidation.validateArray(specialistPatients, dataValidation.isValidPatient);
      console.log('✅ Valid patients after validation:', validPatients.length, validPatients);
      
      // Debug: Check what's being filtered out
      if (specialistPatients.length !== validPatients.length) {
        console.log('⚠️ Some patients were filtered out by validation:');
        specialistPatients.forEach((patient: any, index) => {
          if (!dataValidation.isValidPatient(patient)) {
            console.log(`❌ Invalid patient ${index}:`, patient);
            console.log('❌ Validation issues:', {
              hasId: !!patient?.id,
              idType: typeof patient?.id,
              hasFirstName: !!patient?.patientFirstName,
              firstNameType: typeof patient?.patientFirstName,
              hasLastName: !!patient?.patientLastName,
              lastNameType: typeof patient?.patientLastName
            });
          }
        });
      }
      
      setPatients(validPatients);
    } catch (error) {
      console.error('❌ Error loading patients:', error);
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

  // Performance optimization: memoize filtered patients
  const filteredPatients = useDeepMemo(() => {
    return patients.filter((patient) => {
      const matchesSearch =
        safeDataAccess.getUserFullName(patient, '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.phoneNumber?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Map filter names to appointment statuses
      let matchesFilter = true;
      if (activeFilter === 'Active') {
        matchesFilter = patient.status === 'confirmed';
      } else if (activeFilter === 'Completed') {
        matchesFilter = patient.status === 'completed';
      } else if (activeFilter !== 'All') {
        matchesFilter = patient.status === activeFilter;
      }
      
      return matchesSearch && matchesFilter;
    });
  }, [patients, searchQuery, activeFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return {
          bg: '#EFF6FF',
          text: '#1E40AF',
          border: '#DBEAFE',
        };
      case 'completed':
        return {
          bg: '#F0FDF4',
          text: '#166534',
          border: '#DCFCE7',
        };
      default:
        return {
          bg: '#F3F4F6',
          text: '#6B7280',
          border: '#E5E7EB',
        };
    }
  };

  const renderPatientCard = (patient: Patient) => {
    const statusColors = getStatusColor(patient.status || 'confirmed');
    const patientName = safeDataAccess.getUserFullName(patient, 'Unknown Patient');
    const initials = safeDataAccess.getUserInitials(patient, 'U');
    const statusDisplay = patient.status === 'confirmed' ? 'Active' : 
                         patient.status === 'completed' ? 'Completed' : 'Active';

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
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: statusColors.bg,
                borderColor: statusColors.border,
              },
            ]}
          >
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {statusDisplay}
            </Text>
          </View>
        </View>

        {/* Second row: Last visit or scheduled visit */}
        <View style={styles.visitInfo}>
          <Text style={styles.visitText}>
            {patient.lastVisit && patient.lastVisit !== 'No visits yet' 
              ? patient.isScheduledVisit 
                ? `Scheduled visit: ${patient.lastVisit}` 
                : `Last visit: ${patient.lastVisit}` 
              : 'No visits yet'}
          </Text>
        </View>

        {/* Third row: Address */}
        <View style={styles.contactInfo}>
          <Text style={styles.contactText}>
            {patient.address || 'Address not available'}
          </Text>
        </View>

        {/* Fourth row: Phone */}
        <View style={styles.contactInfo}>
          <Text style={styles.contactText}>
            {patient.phoneNumber || 'Phone not available'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Patients</Text>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push('/(specialist)/tabs/profile')}
        >
          <User size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

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
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
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
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 56,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  visitInfo: {
    marginTop: 8,
    marginBottom: 4,
  },
  visitText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
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
});
 