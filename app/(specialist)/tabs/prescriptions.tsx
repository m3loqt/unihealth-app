import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { Pill, CircleCheck as CheckCircle } from 'lucide-react-native';
import { router } from 'expo-router';

// Static data for issued prescriptions
const staticPrescriptions = [
  {
    id: '1',
    medication: 'Atorvastatin',
    dosage: '20mg',
    frequency: 'Once daily',
    instructions: 'Take with food',
    prescribedDate: '2024-05-01',
    duration: '30 days',
    status: 'active',
    remainingRefills: 2,
  },
  {
    id: '2',
    medication: 'Lisinopril',
    dosage: '10mg',
    frequency: 'Once daily',
    instructions: '',
    prescribedDate: '2024-04-10',
    duration: '60 days',
    status: 'completed',
    remainingRefills: 0,
  },
];

export default function SpecialistPrescriptionsScreen() {
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  // In the future, replace staticPrescriptions with dynamic data from backend
  const prescriptions = staticPrescriptions;

  const activePrescriptions = prescriptions.filter(p => p.status === 'active');
  const pastPrescriptions = prescriptions.filter(p => p.status === 'completed' || p.status === 'discontinued');

  const filterPrescriptions = (list) =>
    list.filter((item) => item.medication?.toLowerCase().includes(searchQuery.toLowerCase()));

  const renderActivePrescription = (prescription) => (
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

  const renderPastPrescription = (prescription) => (
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

  const renderEmptyState = (type) => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Pill size={48} color="#9CA3AF" />
      </View>
      <Text style={styles.emptyTitle}>
        {'No prescriptions issued yet'}
      </Text>
      <Text style={styles.emptyDescription}>
        {'Prescriptions you issue for patients will appear here.'}
      </Text>
    </View>
  );

  let filteredActive = filterPrescriptions(activePrescriptions);
  let filteredPast = filterPrescriptions(pastPrescriptions);

  return (
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
});