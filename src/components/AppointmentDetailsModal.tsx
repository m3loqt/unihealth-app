import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Building,
  FileText,
  Stethoscope,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { Appointment, MedicalHistory } from '../services/database/firebase';
import ConsultationDisplay from './ConsultationDisplay';

interface AppointmentDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  medicalHistory: MedicalHistory | null;
  loadingMedicalHistory: boolean;
  clinicData?: any;
  doctorData?: any;
  isSpecialist?: boolean;
  onStartConsultation?: (appointment: Appointment) => void;
}

type TabType = 'details' | 'medical-history';

export default function AppointmentDetailsModal({
  visible,
  onClose,
  appointment,
  medicalHistory,
  loadingMedicalHistory,
  clinicData,
  doctorData,
  isSpecialist = false,
  onStartConsultation,
}: AppointmentDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('details');

  // Reset to details tab when modal opens or when appointment status changes
  useEffect(() => {
    if (visible) {
      setActiveTab('details');
    }
  }, [visible, appointment?.status]);

  if (!appointment) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatClinicAddress = (clinic: any) => {
    if (!clinic) return '';
    const parts = [
      clinic.address?.street,
      clinic.address?.city,
      clinic.address?.state,
      clinic.address?.zipCode,
    ].filter(Boolean);
    return parts.join(', ');
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return '#10B981';
      case 'confirmed':
        return '#3B82F6';
      case 'pending':
        return '#F59E0B';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const renderTabButton = (tab: TabType, label: string, icon: React.ReactNode) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
      onPress={() => setActiveTab(tab)}
    >
      {icon}
      <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderDetailsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Status Badge */}
      <View style={styles.statusSection}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(appointment.status) }]}>
            {getStatusText(appointment.status)}
          </Text>
        </View>
      </View>

      {/* Clinic Information */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Building size={20} color="#1E40AF" />
          <Text style={styles.sectionTitle}>Clinic Information</Text>
        </View>
        <View style={styles.sectionContent}>
          <Text style={styles.clinicName}>{clinicData?.name || 'Clinic Name'}</Text>
          {clinicData && (
            <View style={styles.infoRow}>
              <MapPin size={16} color="#6B7280" />
              <Text style={styles.infoText}>{formatClinicAddress(clinicData)}</Text>
            </View>
          )}
          {clinicData?.operatingHours && (
            <View style={styles.infoRow}>
              <Clock size={16} color="#6B7280" />
              <Text style={styles.infoText}>{clinicData.operatingHours}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Doctor Information */}
      {doctorData && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={20} color="#1E40AF" />
            <Text style={styles.sectionTitle}>Doctor</Text>
          </View>
          <View style={styles.sectionContent}>
            <Text style={styles.doctorName}>
              Dr. {doctorData.firstName} {doctorData.lastName}
            </Text>
            {doctorData.specialization && (
              <Text style={styles.doctorSpecialization}>{doctorData.specialization}</Text>
            )}
          </View>
        </View>
      )}

      {/* Appointment Details */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Calendar size={20} color="#1E40AF" />
          <Text style={styles.sectionTitle}>Appointment Details</Text>
        </View>
        <View style={styles.sectionContent}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{formatDate(appointment.appointmentDate)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Time</Text>
            <Text style={styles.detailValue}>{formatTime(appointment.appointmentTime)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type</Text>
            <Text style={styles.detailValue}>{appointment.type}</Text>
          </View>
          {appointment.appointmentPurpose && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Purpose</Text>
              <Text style={styles.detailValue}>{appointment.appointmentPurpose}</Text>
            </View>
          )}
          {appointment.additionalNotes && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Notes</Text>
              <Text style={styles.detailValue}>{appointment.additionalNotes}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Additional Information */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FileText size={20} color="#1E40AF" />
          <Text style={styles.sectionTitle}>Additional Information</Text>
        </View>
        <View style={styles.sectionContent}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Created</Text>
            <Text style={styles.detailValue}>{formatDate(appointment.createdAt)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Last Updated</Text>
            <Text style={styles.detailValue}>{formatDate(appointment.lastUpdated)}</Text>
          </View>
          {appointment.sourceSystem && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Source</Text>
              <Text style={styles.detailValue}>{appointment.sourceSystem}</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );

  const renderMedicalHistoryTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {loadingMedicalHistory ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading medical history...</Text>
        </View>
      ) : medicalHistory ? (
        <ConsultationDisplay 
          consultation={medicalHistory}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Stethoscope size={48} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No Medical History Available</Text>
          <Text style={styles.emptyText}>
            Medical history for this appointment has not been recorded yet.
          </Text>
        </View>
      )}
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Appointment Details</Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            {/* Tab Navigation */}
            <View style={styles.tabContainer}>
              {renderTabButton('details', 'Details', <Calendar size={18} color={activeTab === 'details' ? '#1E40AF' : '#6B7280'} />)}
              {appointment.status.toLowerCase() === 'completed' && renderTabButton('medical-history', 'Medical History', <Stethoscope size={18} color={activeTab === 'medical-history' ? '#1E40AF' : '#6B7280'} />)}
            </View>
          </View>

          {/* Tab Content */}
          {activeTab === 'details' ? renderDetailsTab() : 
           (appointment.status.toLowerCase() === 'completed' ? renderMedicalHistoryTab() : renderDetailsTab())}

          {/* Specialist Action Buttons */}
          {isSpecialist && appointment && appointment.status === 'confirmed' && onStartConsultation && (
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={styles.startConsultationButton}
                onPress={() => onStartConsultation(appointment)}
              >
                <Stethoscope size={20} color="#FFFFFF" />
                <Text style={styles.startConsultationButtonText}>Start Consultation</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 4,
    gap: 8,
  },
  tabButtonActive: {
    backgroundColor: '#EFF6FF',
  },
  tabButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  tabButtonTextActive: {
    color: '#1E40AF',
    fontFamily: 'Inter-SemiBold',
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  statusSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  sectionContent: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  clinicName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    flex: 1,
  },
  doctorName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  doctorSpecialization: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    flex: 1,
    textAlign: 'right',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  actionButtonsContainer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  startConsultationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  startConsultationButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});
