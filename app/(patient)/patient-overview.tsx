import React from 'react';
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

// Sample patient data - in real app this would come from API
const SAMPLE_PATIENTS = {
  1: {
    id: 1,
    name: 'John Doe',
    age: 32,
    gender: 'Male',
    medicalId: 'PAT-2024-001',
    phone: '+1 (555) 123-4567',
    email: 'john.doe@email.com',
    address: '1234 Main St, San Francisco, CA 94102',
    referredFrom: 'General Medicine',
    notes: 'Follows low-sodium diet',
    emergencyContact: {
      name: 'Jane Doe',
      relationship: 'Spouse',
      phone: '+1 (555) 890-1234',
    },
    profileImage: 'https://randomuser.me/api/portraits/men/32.jpg',
  },
  2: {
    id: 2,
    name: 'Jane Smith',
    age: 28,
    gender: 'Female',
    medicalId: 'PAT-2024-002',
    phone: '+1 (555) 234-5678',
    email: 'jane.smith@email.com',
    address: '5678 Oak Ave, San Francisco, CA 94103',
    referredFrom: 'Emergency Dept',
    notes: 'Prefers video consultations',
    emergencyContact: {
      name: 'Robert Smith',
      relationship: 'Father',
      phone: '+1 (555) 345-6789',
    },
    profileImage: 'https://randomuser.me/api/portraits/women/44.jpg',
  },
};

const ACTIVE_CONSULTATIONS = {
  1: {
    id: 'CONS-2024-001',
    patientId: 1,
    date: 'Dec 15, 2024',
    time: '2:30 PM',
    type: 'General Consultation',
    status: 'In Progress',
  },
};

const MEDICAL_HISTORY = {
  1: [
    {
      id: 1,
      date: 'Dec 10, 2024',
      type: 'Annual Physical',
      doctor: 'Dr. Sarah Johnson',
      status: 'Completed',
    },
    {
      id: 2,
      date: 'Nov 15, 2024',
      type: 'Follow-up',
      doctor: 'Dr. Michael Chen',
      status: 'Completed',
    },
    {
      id: 3,
      date: 'Oct 20, 2024',
      type: 'Consultation',
      doctor: 'Dr. Emily Davis',
      status: 'Completed',
    },
  ],
  2: [],
};

export default function PatientOverviewScreen() {
  const { id } = useLocalSearchParams();
  const patientId = parseInt(id as string) || 1;
  
  const patient = SAMPLE_PATIENTS[patientId as keyof typeof SAMPLE_PATIENTS] || SAMPLE_PATIENTS[1];
  const activeConsultation = ACTIVE_CONSULTATIONS[patientId as keyof typeof ACTIVE_CONSULTATIONS];
  const medicalHistory = MEDICAL_HISTORY[patientId as keyof typeof MEDICAL_HISTORY] || [];

  const handleEmergencyCall = () => {
    Linking.openURL(`tel:${patient.emergencyContact.phone.replace(/[^+\d]/g, '')}`);
  };

  const handleActiveConsultationPress = () => {
    if (activeConsultation) {
      router.push(`/patient-consultation?patientId=${patientId}&consultationId=${activeConsultation.id}`);
    }
  };

  const handleMedicalHistoryPress = (historyItem: any) => {
    router.push(`/visit-overview?id=${historyItem.id}`);
  };

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
      >
        {/* Patient Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Patient Details</Text>
          <View style={styles.patientCard}>
            <View style={styles.patientHeader}>
              <Image source={{ uri: patient.profileImage }} style={styles.patientImage} />
              <View style={styles.patientInfo}>
                <Text style={styles.patientName}>{patient.name}</Text>
                <Text style={styles.patientAge}>{patient.age} years old • {patient.gender}</Text>
                <Text style={styles.patientId}>ID: {patient.medicalId}</Text>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.contactInfo}>
              <View style={styles.contactItem}>
                <Phone size={16} color="#6B7280" />
                <Text style={styles.contactText}>{patient.phone}</Text>
              </View>
              <View style={styles.contactItem}>
                <Mail size={16} color="#6B7280" />
                <Text style={styles.contactText}>{patient.email}</Text>
              </View>
              <View style={styles.contactItem}>
                <MapPin size={16} color="#6B7280" />
                <Text style={styles.contactText}>{patient.address}</Text>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.medicalInfo}>
              <View style={styles.medicalRow}>
                <Text style={styles.medicalLabel}>Referred from:</Text>
                <Text style={styles.medicalValue}>{patient.referredFrom}</Text>
              </View>
              <View style={styles.medicalRow}>
                <Text style={styles.medicalLabel}>Notes:</Text>
                <Text style={styles.medicalValue}>{patient.notes}</Text>
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
                  {patient.emergencyContact.name
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .toUpperCase()}
                </Text>
              </View>
              <View style={styles.emergencyInfo}>
                <Text style={styles.emergencyName}>{patient.emergencyContact.name}</Text>
                <View style={styles.relationshipRow}>
                  <Text style={styles.relationshipPill}>{patient.emergencyContact.relationship}</Text>
                </View>
                <Text style={styles.emergencyPhone}>{patient.emergencyContact.phone}</Text>
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
          {activeConsultation ? (
            <TouchableOpacity style={styles.consultationCard} onPress={handleActiveConsultationPress}>
              <View style={styles.consultationHeader}>
                <View style={styles.consultationIcon}>
                  <FileText size={20} color="#1E40AF" />
                </View>
                <View style={styles.consultationInfo}>
                  <Text style={styles.consultationType}>{activeConsultation.type}</Text>
                  <Text style={styles.consultationDate}>
                    {activeConsultation.date} at {activeConsultation.time}
                  </Text>
                  <Text style={styles.consultationStatus}>{activeConsultation.status}</Text>
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
              {medicalHistory.map((item: any) => (
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
});
 