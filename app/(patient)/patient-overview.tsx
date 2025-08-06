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
  Image,
  Linking,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  ChevronLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  FileText,
  Clock,
  ChevronRight,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/hooks/auth/useAuth';
import { databaseService, Patient, Appointment } from '../../src/services/database/firebase';

export default function PatientOverviewScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [patientData, setPatientData] = useState<Patient | null>(null);
  const [activeConsultations, setActiveConsultations] = useState<Appointment[]>([]);
  const [medicalHistory, setMedicalHistory] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load patient data from Firebase
  useEffect(() => {
    if (id) {
      loadPatientData();
    }
  }, [id]);

  const loadPatientData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      
      // Load patient data and their appointments
      const [patient, appointments] = await Promise.all([
        databaseService.getPatientById(id as string),
        databaseService.getAppointmentsByPatient(id as string)
      ]);

      if (patient) {
        setPatientData(patient);
        
        // Filter active consultations (pending, confirmed)
        const active = appointments.filter(apt => 
          apt.status === 'pending' || apt.status === 'confirmed'
        );
        setActiveConsultations(active);

        // Filter completed appointments for medical history
        const completed = appointments.filter(apt => apt.status === 'completed');
        setMedicalHistory(completed);
      }
    } catch (error) {
      console.error('Error loading patient data:', error);
      Alert.alert('Error', 'Failed to load patient data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPatientData();
    setRefreshing(false);
  };

  const handleEmergencyCall = () => {
    if (patientData?.emergencyContact?.phone) {
      Linking.openURL(`tel:${patientData.emergencyContact.phone}`);
    } else {
      Alert.alert('No Emergency Contact', 'Emergency contact information is not available.');
    }
  };

  const handleActiveConsultationPress = () => {
    if (activeConsultations.length > 0) {
      const consultation = activeConsultations[0];
      router.push(`/patient-consultation?patientId=${patientData?.id}&consultationId=${consultation.id}`);
    }
  };

  const handleMedicalHistoryPress = (historyItem: Appointment) => {
    router.push(`/visit-overview?id=${historyItem.id}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading patient data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!patientData) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Patient not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#1E40AF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Patient Overview</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Patient Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Patient Details</Text>
          <View style={styles.patientCard}>
            <View style={styles.patientHeader}>
              <Image source={{ uri: patientData.profileImage }} style={styles.patientImage} />
              <View style={styles.patientInfo}>
                <Text style={styles.patientName}>{patientData.name}</Text>
                <Text style={styles.patientAge}>{patientData.age} years old • {patientData.gender}</Text>
                <Text style={styles.patientId}>ID: {patientData.medicalId}</Text>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.contactInfo}>
              <View style={styles.contactItem}>
                <Phone size={16} color="#6B7280" />
                <Text style={styles.contactText}>{patientData.phone}</Text>
              </View>
              <View style={styles.contactItem}>
                <Mail size={16} color="#6B7280" />
                <Text style={styles.contactText}>{patientData.email}</Text>
              </View>
              <View style={styles.contactItem}>
                <MapPin size={16} color="#6B7280" />
                <Text style={styles.contactText}>{patientData.address}</Text>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.medicalInfo}>
              <View style={styles.medicalRow}>
                <Text style={styles.medicalLabel}>Referred from:</Text>
                <Text style={styles.medicalValue}>{patientData.referredFrom}</Text>
              </View>
              <View style={styles.medicalRow}>
                <Text style={styles.medicalLabel}>Notes:</Text>
                <Text style={styles.medicalValue}>{patientData.notes}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Emergency Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
          <View style={styles.emergencyCard}>
            <View style={styles.emergencyLeft}>
              <View style={styles.emergencyAvatar}>
                <Text style={styles.emergencyInitial}>
                  {patientData.emergencyContact.name
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .toUpperCase()}
                </Text>
              </View>
              <View style={styles.emergencyInfo}>
                <Text style={styles.emergencyName}>{patientData.emergencyContact.name}</Text>
                <View style={styles.relationshipRow}>
                  <Text style={styles.relationshipPill}>{patientData.emergencyContact.relationship}</Text>
                </View>
                <Text style={styles.emergencyPhone}>{patientData.emergencyContact.phone}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.emergencyCallButton} onPress={handleEmergencyCall}>
              <Phone size={18} color="#fff" />
              <Text style={styles.emergencyCallText}>Call</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Active Consultation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Consultation</Text>
          {activeConsultations.length > 0 ? (
            <TouchableOpacity style={styles.consultationCard} onPress={handleActiveConsultationPress}>
              <View style={styles.consultationHeader}>
                <View style={styles.consultationIcon}>
                  <FileText size={20} color="#1E40AF" />
                </View>
                <View style={styles.consultationInfo}>
                  <Text style={styles.consultationType}>{activeConsultations[0].type}</Text>
                  <Text style={styles.consultationDate}>
                    {activeConsultations[0].date} at {activeConsultations[0].time}
                  </Text>
                  <Text style={styles.consultationStatus}>{activeConsultations[0].status}</Text>
                </View>
                <ChevronRight size={20} color="#9CA3AF" />
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.noConsultationCard}>
              <FileText size={32} color="#9CA3AF" />
              <Text style={styles.noConsultationText}>No active consultation</Text>
              <Text style={styles.noConsultationSubtext}>
                Start a new consultation to begin patient care
              </Text>
            </View>
          )}
        </View>

        {/* Medical History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medical History</Text>
          {medicalHistory.length > 0 ? (
            <View style={styles.historyContainer}>
              {medicalHistory.map((item: Appointment) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.historyCard}
                  onPress={() => handleMedicalHistoryPress(item)}
                >
                  <View style={styles.historyHeader}>
                    <View style={styles.historyIcon}>
                      <Calendar size={16} color="#1E40AF" />
                    </View>
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyType}>{item.type}</Text>
                      <Text style={styles.historyDate}>{item.date}</Text>
                      <Text style={styles.historyDoctor}>{item.doctor}</Text>
                    </View>
                    <View style={styles.historyStatus}>
                      <Text style={styles.historyStatusText}>{item.status}</Text>
                      <ChevronRight size={16} color="#9CA3AF" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.noConsultationCard}>
              <FileText size={32} color="#9CA3AF" />
              <Text style={styles.noConsultationText}>No medical history</Text>
              <Text style={styles.noConsultationSubtext}>
                No previous visits or consultations recorded.
              </Text>
            </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 16,
  },
  patientCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  patientImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  patientAge: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 2,
  },
  patientId: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  contactInfo: {
    gap: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
  medicalInfo: {
    gap: 8,
  },
  medicalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  medicalLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  medicalValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  emergencyCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emergencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  emergencyAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emergencyInitial: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  emergencyInfo: {
    flex: 1,
  },
  emergencyName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  relationshipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  relationshipPill: {
    backgroundColor: '#EFF6FF',
    color: '#1E40AF',
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 6,
    overflow: 'hidden',
  },
  emergencyPhone: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
  emergencyCallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E40AF',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 7,
  },
  emergencyCallText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    marginLeft: 5,
  },
  consultationCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  consultationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  consultationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  consultationInfo: {
    flex: 1,
  },
  consultationType: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  consultationDate: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 2,
  },
  consultationStatus: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
  },
  noConsultationCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  noConsultationText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginTop: 12,
    marginBottom: 4,
  },
  noConsultationSubtext: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  historyContainer: {
    gap: 12,
  },
  historyCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyInfo: {
    flex: 1,
  },
  historyType: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 2,
  },
  historyDoctor: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
  historyStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyStatusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    fontSize: 18,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
});
 