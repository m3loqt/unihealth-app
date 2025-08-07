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
  ActivityIndicator,
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
  Pill,
  Heart,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Plus,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/hooks/auth/useAuth';
import { databaseService, Patient, Appointment, MedicalHistory, Prescription } from '../../src/services/database/firebase';

interface PatientData extends Patient {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodType?: string;
  phone?: string;
  email?: string;
  address?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  medicalConditions?: string[];
  currentCondition?: string;
  visitHistory?: {
    firstVisit?: string;
    lastVisit?: string;
    visitCount?: number;
    currentAdmission?: {
      admissionDate: string;
      department: string;
      attendingStaffName: string;
    };
  };
  medUse?: Array<{
    name: string;
    quantity: number;
    timestamp: string;
  }>;
}

export default function PatientOverviewScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
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
      
      // Load all patient data in parallel
      const [patient, patientAppointments, patientMedicalHistory, patientPrescriptions] = await Promise.all([
        databaseService.getPatientById(id as string),
        databaseService.getAppointmentsByPatient(id as string),
        databaseService.getMedicalHistory(id as string),
        databaseService.getPrescriptions(id as string)
      ]);

      if (patient) {
        setPatientData(patient);
        setAppointments(patientAppointments);
        setMedicalHistory(patientMedicalHistory);
        setPrescriptions(patientPrescriptions);
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
    const activeAppointments = appointments.filter(apt => 
      apt.status === 'pending' || apt.status === 'confirmed'
    );
    if (activeAppointments.length > 0) {
      const consultation = activeAppointments[0];
      router.push(`/patient-consultation?patientId=${patientData?.id}&consultationId=${consultation.id}`);
    }
  };

  const handleMedicalHistoryPress = (historyItem: MedicalHistory) => {
    router.push(`/visit-overview?id=${historyItem.id}`);
  };

  const handleNewConsultation = () => {
    if (patientData) {
      router.push(`/patient-consultation?patientId=${patientData.id}`);
    }
  };

  const getPatientName = () => {
    if (patientData?.firstName && patientData?.lastName) {
      return `${patientData.firstName} ${patientData.lastName}`;
    }
    if (patientData?.patientFirstName && patientData?.patientLastName) {
      return `${patientData.patientFirstName} ${patientData.patientLastName}`;
    }
    return 'Unknown Patient';
  };

  const getPatientAge = () => {
    if (patientData?.dateOfBirth) {
      const birthDate = new Date(patientData.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        return age - 1;
      }
      return age;
    }
    return null;
  };

  const getActiveAppointments = () => {
    return appointments.filter(apt => 
      apt.status === 'pending' || apt.status === 'confirmed'
    );
  };

  const getCompletedAppointments = () => {
    return appointments.filter(apt => apt.status === 'completed');
  };

  const getActivePrescriptions = () => {
    return prescriptions.filter(pres => pres.status === 'active');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E40AF" />
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

  const activeAppointments = getActiveAppointments();
  const completedAppointments = getCompletedAppointments();
  const activePrescriptions = getActivePrescriptions();
  const patientAge = getPatientAge();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#1E40AF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Patient Overview</Text>
        <TouchableOpacity style={styles.newConsultationButton} onPress={handleNewConsultation}>
          <Plus size={20} color="#1E40AF" />
        </TouchableOpacity>
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
              <View style={styles.patientAvatar}>
                <User size={32} color="#FFFFFF" />
              </View>
              <View style={styles.patientInfo}>
                <Text style={styles.patientName}>{getPatientName()}</Text>
                <Text style={styles.patientAge}>
                  {patientAge ? `${patientAge} years old` : ''} • {patientData.gender || 'Unknown'} • {patientData.bloodType || 'No blood type'}
                </Text>
                <Text style={styles.patientId}>ID: {patientData.id}</Text>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.contactInfo}>
              {patientData.phone && (
                <View style={styles.contactItem}>
                  <Phone size={16} color="#6B7280" />
                  <Text style={styles.contactText}>{patientData.phone}</Text>
                </View>
              )}
              {patientData.email && (
                <View style={styles.contactItem}>
                  <Mail size={16} color="#6B7280" />
                  <Text style={styles.contactText}>{patientData.email}</Text>
                </View>
              )}
              {patientData.address && (
                <View style={styles.contactItem}>
                  <MapPin size={16} color="#6B7280" />
                  <Text style={styles.contactText}>{patientData.address}</Text>
                </View>
              )}
            </View>
            
            {patientData.medicalConditions && patientData.medicalConditions.length > 0 && (
              <>
                <View style={styles.divider} />
                <View style={styles.medicalConditions}>
                  <Text style={styles.medicalConditionsTitle}>Medical Conditions</Text>
                  {patientData.medicalConditions.map((condition, index) => (
                    <View key={index} style={styles.conditionItem}>
                      <AlertCircle size={14} color="#EF4444" />
                      <Text style={styles.conditionText}>{condition}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        </View>

        {/* Emergency Contact */}
        {patientData.emergencyContact && (
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
        )}

        {/* Visit Summary */}
        {patientData.visitHistory && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Visit Summary</Text>
            <View style={styles.visitSummaryCard}>
              <View style={styles.visitStats}>
                <View style={styles.visitStat}>
                  <Text style={styles.visitStatValue}>{patientData.visitHistory.visitCount || 0}</Text>
                  <Text style={styles.visitStatLabel}>Total Visits</Text>
                </View>
                <View style={styles.visitStat}>
                  <Text style={styles.visitStatValue}>
                    {patientData.visitHistory.firstVisit ? formatDate(patientData.visitHistory.firstVisit) : 'N/A'}
                  </Text>
                  <Text style={styles.visitStatLabel}>First Visit</Text>
                </View>
                <View style={styles.visitStat}>
                  <Text style={styles.visitStatValue}>
                    {patientData.visitHistory.lastVisit ? formatDate(patientData.visitHistory.lastVisit) : 'N/A'}
                  </Text>
                  <Text style={styles.visitStatLabel}>Last Visit</Text>
                </View>
              </View>
              {patientData.visitHistory.currentAdmission && (
                <View style={styles.currentAdmission}>
                  <Text style={styles.currentAdmissionTitle}>Currently Admitted</Text>
                  <Text style={styles.currentAdmissionText}>
                    {patientData.visitHistory.currentAdmission.department} • {patientData.visitHistory.currentAdmission.attendingStaffName}
                  </Text>
                  <Text style={styles.currentAdmissionDate}>
                    Since {formatDate(patientData.visitHistory.currentAdmission.admissionDate)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Active Consultation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Consultation</Text>
          {activeAppointments.length > 0 ? (
            <TouchableOpacity style={styles.consultationCard} onPress={handleActiveConsultationPress}>
              <View style={styles.consultationHeader}>
                <View style={styles.consultationIcon}>
                  <FileText size={20} color="#1E40AF" />
                </View>
                <View style={styles.consultationInfo}>
                  <Text style={styles.consultationType}>{activeAppointments[0].type}</Text>
                  <Text style={styles.consultationDate}>
                    {activeAppointments[0].appointmentDate} at {activeAppointments[0].appointmentTime}
                  </Text>
                  <View style={styles.statusContainer}>
                    <View style={[
                      styles.statusBadge,
                      activeAppointments[0].status === 'confirmed' ? styles.statusConfirmed : styles.statusPending
                    ]}>
                      <Text style={styles.statusText}>{activeAppointments[0].status}</Text>
                    </View>
                  </View>
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
              <TouchableOpacity style={styles.startConsultationButton} onPress={handleNewConsultation}>
                <Text style={styles.startConsultationButtonText}>Start Consultation</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Active Prescriptions */}
        {activePrescriptions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Prescriptions</Text>
            <View style={styles.prescriptionsContainer}>
              {activePrescriptions.slice(0, 3).map((prescription) => (
                <View key={prescription.id} style={styles.prescriptionCard}>
                  <View style={styles.prescriptionHeader}>
                    <View style={styles.prescriptionIcon}>
                      <Pill size={16} color="#1E40AF" />
                    </View>
                    <View style={styles.prescriptionInfo}>
                      <Text style={styles.prescriptionMedication}>{prescription.medication}</Text>
                      <Text style={styles.prescriptionDosage}>
                        {prescription.dosage} • {prescription.frequency}
                      </Text>
                      <Text style={styles.prescriptionDate}>
                        Prescribed: {formatDate(prescription.prescribedDate)}
                      </Text>
                    </View>
                    <View style={styles.prescriptionStatus}>
                      <CheckCircle size={16} color="#10B981" />
                    </View>
                  </View>
                </View>
              ))}
              {activePrescriptions.length > 3 && (
                <TouchableOpacity style={styles.viewMoreButton}>
                  <Text style={styles.viewMoreText}>View all {activePrescriptions.length} prescriptions</Text>
                  <ChevronRight size={16} color="#1E40AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Medical History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medical History</Text>
          {medicalHistory.length > 0 ? (
            <View style={styles.historyContainer}>
              {medicalHistory.slice(0, 5).map((item: MedicalHistory) => (
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
                      <Text style={styles.historyDate}>
                        {formatDate(item.consultationDate)} at {formatTime(item.consultationTime)}
                      </Text>
                      <Text style={styles.historyDoctor}>
                        Dr. {item.provider.firstName} {item.provider.lastName}
                      </Text>
                      {item.diagnosis && item.diagnosis.length > 0 && (
                        <Text style={styles.historyDiagnosis}>
                          {item.diagnosis[0].description}
                        </Text>
                      )}
                    </View>
                    <ChevronRight size={16} color="#9CA3AF" />
                  </View>
                </TouchableOpacity>
              ))}
              {medicalHistory.length > 5 && (
                <TouchableOpacity style={styles.viewMoreButton}>
                  <Text style={styles.viewMoreText}>View all {medicalHistory.length} records</Text>
                  <ChevronRight size={16} color="#1E40AF" />
                </TouchableOpacity>
              )}
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

        {/* Recent Appointments */}
        {completedAppointments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Appointments</Text>
            <View style={styles.appointmentsContainer}>
              {completedAppointments.slice(0, 3).map((appointment) => (
                <View key={appointment.id} style={styles.appointmentCard}>
                  <View style={styles.appointmentHeader}>
                    <View style={styles.appointmentIcon}>
                      <Clock size={16} color="#6B7280" />
                    </View>
                    <View style={styles.appointmentInfo}>
                      <Text style={styles.appointmentType}>{appointment.type}</Text>
                      <Text style={styles.appointmentDate}>
                        {appointment.appointmentDate} at {appointment.appointmentTime}
                      </Text>
                      <Text style={styles.appointmentDoctor}>
                        Dr. {appointment.doctorFirstName} {appointment.doctorLastName}
                      </Text>
                    </View>
                    <View style={styles.appointmentStatus}>
                      <CheckCircle size={16} color="#10B981" />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
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
  newConsultationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
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
  patientAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
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
  medicalConditions: {
    gap: 8,
  },
  medicalConditionsTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 8,
  },
  conditionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  conditionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
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
  visitSummaryCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  visitStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  visitStat: {
    alignItems: 'center',
    flex: 1,
  },
  visitStatValue: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  visitStatLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  currentAdmission: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  currentAdmissionTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  currentAdmissionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginBottom: 2,
  },
  currentAdmissionDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
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
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusConfirmed: {
    backgroundColor: '#D1FAE5',
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#374151',
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
    marginBottom: 16,
  },
  startConsultationButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  startConsultationButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  prescriptionsContainer: {
    gap: 12,
  },
  prescriptionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  prescriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prescriptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  prescriptionInfo: {
    flex: 1,
  },
  prescriptionMedication: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  prescriptionDosage: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 2,
  },
  prescriptionDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  prescriptionStatus: {
    marginLeft: 8,
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
    marginBottom: 2,
  },
  historyDiagnosis: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  appointmentsContainer: {
    gap: 12,
  },
  appointmentCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  appointmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appointmentIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentType: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  appointmentDate: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 2,
  },
  appointmentDoctor: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
  appointmentStatus: {
    marginLeft: 8,
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  viewMoreText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
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
    marginTop: 16,
  },
});
 