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
import LoadingState from '../../../src/components/ui/LoadingState';
import ErrorBoundary from '../../../src/components/ui/ErrorBoundary';
import { dataValidation } from '../../../src/utils/dataValidation';
import { useDeepMemo } from '../../../src/utils/performance';

export default function SpecialistPrescriptionsScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
      
      // Validate prescriptions data
      const validPrescriptions = dataValidation.validateArray(specialistPrescriptions, dataValidation.isValidPrescription);
      console.log('Loaded prescriptions:', validPrescriptions.length);
      setPrescriptions(validPrescriptions);
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
          <Text style={styles.medicationDosage}>
            {prescription.dosage || 'N/A'} • {prescription.frequency || 'N/A'}
          </Text>
          <Text style={styles.prescriptionDescription}>
            {prescription.instructions || 'No additional instructions'}
          </Text>
        </View>
        <View style={styles.prescriptionStatus}>
          <Text style={styles.remainingDays}>{prescription.remainingRefills || 0}</Text>
          <Text style={styles.remainingLabel}>refills left</Text>
        </View>
      </View>
      <View style={styles.prescriptionMeta}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Prescribed on:</Text>
          <Text style={styles.metaValue}>
            {prescription.prescribedDate ? new Date(prescription.prescribedDate).toLocaleDateString() : 'Date not available'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Duration:</Text>
          <Text style={styles.metaValue}>
            {prescription.duration || 'Duration not specified'}
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
            {prescription.dosage || 'N/A'} • {prescription.frequency || 'N/A'}
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
            {prescription.prescribedDate ? new Date(prescription.prescribedDate).toLocaleDateString() : 'Date not available'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Status:</Text>
          <Text style={styles.metaValue}>
            {prescription.status === 'completed' ? 'Completed' : 'Discontinued'}
          </Text>
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Prescriptions Issued</Text>
      </View>
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