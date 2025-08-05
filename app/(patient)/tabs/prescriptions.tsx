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
} from 'react-native';
import {
  Pill,
  CircleCheck as CheckCircle,
  User,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/src/hooks/auth/useAuth';
import { databaseService, Prescription } from '@/src/services/database/firebase';

export default function PrescriptionsScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

  // Load prescriptions from database
  useEffect(() => {
    if (user && user.uid) {
      loadPrescriptions();
    }
  }, [user]);

  const loadPrescriptions = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const userPrescriptions = await databaseService.getPrescriptions(user.uid);
      console.log('Loaded prescriptions:', userPrescriptions.length);
      setPrescriptions(userPrescriptions);
    } catch (error) {
      console.error('Error loading prescriptions:', error);
      Alert.alert('Error', 'Failed to load prescriptions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Use database prescriptions only - filter by status
  const activePrescriptions = prescriptions.filter(p => p.status === 'active');
  const pastPrescriptions = prescriptions.filter(p => p.status === 'completed' || p.status === 'discontinued');
  
  // Debug logging
  console.log('Total prescriptions:', prescriptions.length);
  console.log('Active prescriptions:', activePrescriptions.length);
  console.log('Past prescriptions:', pastPrescriptions.length);
  console.log('Available statuses:', Array.from(new Set(prescriptions.map(p => p.status))));
  
  // Filter prescriptions that have essential data
  const validActivePrescriptions = activePrescriptions.filter(p => 
    p.medication && p.dosage && p.frequency
  );
  const validPastPrescriptions = pastPrescriptions.filter(p => 
    p.medication && p.dosage && p.frequency
  );

  const filterPrescriptions = (list: Prescription[]) =>
    list.filter((item: Prescription) => item.medication?.toLowerCase().includes(searchQuery.toLowerCase()));

  const renderActivePrescription = (prescription: Prescription) => {
    // Only render if prescription has essential data
    if (!prescription.medication || !prescription.dosage || !prescription.frequency) {
      return null;
    }

    return (
      <View key={prescription.id} style={styles.prescriptionCard}>
        <View style={styles.prescriptionHeader}>
          <View style={[styles.medicationIcon, { backgroundColor: '#1E3A8A15' }]}>
            <Pill size={20} color="#1E3A8A" />
          </View>
          <View style={styles.prescriptionDetails}>
            <Text style={styles.medicationName}>{prescription.medication}</Text>
            <Text style={styles.medicationDosage}>
              {prescription.dosage} • {prescription.frequency}
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
  };

  const renderPastPrescription = (prescription: Prescription) => {
    // Only render if prescription has essential data
    if (!prescription.medication || !prescription.dosage || !prescription.frequency) {
      return null;
    }

    return (
      <View key={prescription.id} style={styles.prescriptionCard}>
        <View style={styles.prescriptionHeader}>
          <View style={[styles.medicationIcon, { backgroundColor: '#1E3A8A15' }]}>
            <Pill size={20} color="#1E3A8A" />
          </View>
          <View style={styles.prescriptionDetails}>
            <Text style={styles.medicationName}>{prescription.medication}</Text>
            <Text style={styles.medicationDosage}>
              {prescription.dosage} • {prescription.frequency}
            </Text>
            <Text style={styles.prescriptionDescription}>
              {prescription.instructions || 'No additional instructions'}
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <CheckCircle size={14} color="#6B7280" />
            <Text style={styles.statusText}>{prescription.status}</Text>
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
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Status:</Text>
            <Text style={styles.metaValue}>{prescription.status}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = (type: string) => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>
        {loading ? 'Loading prescriptions...' : type === 'All' ? 'No prescriptions found' : `No ${type.toLowerCase()} prescriptions found`}
      </Text>
      {!loading && (
        <Text style={styles.emptyStateSubtext}>
          {type === 'Active' 
            ? 'Your active prescriptions will appear here once prescribed by your healthcare provider.'
            : type === 'Past'
            ? 'Your completed or discontinued prescriptions will appear here.'
            : 'Your prescriptions will appear here once prescribed by your healthcare provider.'
          }
        </Text>
      )}
    </View>
  );

  let filteredActive = filterPrescriptions(validActivePrescriptions);
  let filteredPast = filterPrescriptions(validPastPrescriptions);
  
  // Debug logging for filtered results
  console.log('Valid active prescriptions:', validActivePrescriptions.length);
  console.log('Valid past prescriptions:', validPastPrescriptions.length);
  console.log('Filtered active prescriptions:', filteredActive.length);
  console.log('Filtered past prescriptions:', filteredPast.length);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Prescriptions</Text>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push('/profile')}
        >
          <User size={24} color="#6B7280" />
        </TouchableOpacity>
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

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 95 }}
      >
        <View style={styles.prescriptionsList}>
          {activeTab === 'All' ? (
            <>
              {filteredActive.length === 0 && filteredPast.length === 0
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
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
