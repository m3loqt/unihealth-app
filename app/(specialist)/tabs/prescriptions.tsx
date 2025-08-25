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
} from 'react-native';
import { Pill, CircleCheck as CheckCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '../../../src/hooks/auth/useAuth';
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
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [patientNames, setPatientNames] = useState<{ [patientId: string]: string }>({});

  // Load prescriptions from Firebase
  useEffect(() => {
    if (user && user.uid) {
      loadPrescriptions();
    }
  }, [user]);

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
    list.filter((item: Prescription) => item.medication?.toLowerCase().includes(searchQuery.toLowerCase()));

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
          {(() => {
            const remainingDays = calculateRemainingDays(prescription);
            if (remainingDays !== null) {
              return (
                <>
                  <Text style={styles.remainingDays}>{remainingDays}</Text>
                  <Text style={styles.remainingLabel}>days left</Text>
                </>
              );
            } else {
              return (
                <>
                  <Text style={styles.remainingDays}>-</Text>
                  <Text style={styles.remainingLabel}>Ongoing</Text>
                </>
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
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Status:</Text>
          <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7', borderColor: '#22C55E' }]}>
            <Text style={[styles.statusText, { color: '#166534' }]}>Active</Text>
          </View>
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
          <CheckCircle size={20} color="#10B981" />
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
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Status:</Text>
          <View style={[
            styles.statusBadge, 
            { 
              backgroundColor: prescription.status === 'completed' ? '#FEF3C7' : '#FEE2E2',
              borderColor: prescription.status === 'completed' ? '#F59E0B' : '#EF4444'
            }
          ]}>
            <Text style={[
              styles.statusText, 
              { color: prescription.status === 'completed' ? '#92400E' : '#991B1B' }
            ]}>
              {prescription.status === 'completed' ? 'Completed' : 'Discontinued'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderEmptyState = (type: string) => (
    <View style={styles.emptyState}>
      <Pill size={48} color="#9CA3AF" />
      <Text style={styles.emptyStateTitle}>
        No {type.toLowerCase()} prescriptions
      </Text>
      <Text style={styles.emptyStateText}>
        {type === 'Active' 
          ? 'No active prescriptions found for your patients.'
          : 'No past prescriptions found for your patients.'
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
      <SpecialistHeader title="Prescriptions Issued" />
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
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
        </ScrollView>
      </View>
      {renderContent()}
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
  },
  remainingDays: {
    fontSize: 14,
    color: '#1F2937',
  },
  remainingLabel: {
    fontSize: 12,
    color: '#6B7280',
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
  emptyStateTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
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