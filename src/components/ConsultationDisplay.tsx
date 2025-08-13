import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  Calendar,
  Clock,
  User,
  FileText,
  Pill,
  AlertTriangle,
  Activity,
  Stethoscope,
} from 'lucide-react-native';

interface ConsultationData {
  // Patient History
  presentIllnessHistory?: string;
  reviewOfSymptoms?: string;
  
  // Findings
  labResults?: string;
  medications?: string;
  
  // Diagnoses
  diagnosis?: Array<{ code: string; description: string }> | string;
  differentialDiagnosis?: string;
  
  // SOAP Notes
  soapNotes?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  
  // Treatment & Summary
  treatmentPlan?: string;
  clinicalSummary?: string;
  
  // Additional Info
  prescriptions?: any[];
  certificates?: any[];
  allergies?: string;
  vitals?: string;
  
  // Metadata
  consultationDate?: string;
  consultationTime?: string;
  provider?: {
    firstName?: string;
    lastName?: string;
    providerType?: string;
  };
  type?: string;
}

interface ConsultationDisplayProps {
  consultation: ConsultationData;
  onBack?: () => void;
}

export default function ConsultationDisplay({
  consultation,
  onBack,
}: ConsultationDisplayProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not specified';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (error) {
      return dateString;
    }
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return 'Not specified';
    return timeString;
  };

  const renderSection = (title: string, icon: React.ReactNode, children: React.ReactNode) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          {icon}
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );

  const renderField = (label: string, value?: string, multiline: boolean = false) => {
    if (!value || value.trim() === '') return null;
    
    return (
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={[styles.fieldValue, multiline && styles.multilineValue]}>
          {value}
        </Text>
      </View>
    );
  };

  const renderDiagnosis = () => {
    if (!consultation.diagnosis) return null;
    
    if (Array.isArray(consultation.diagnosis)) {
      return consultation.diagnosis.map((diag, index) => (
        <View key={index} style={styles.diagnosisItem}>
          <Text style={styles.diagnosisCode}>{diag.code}</Text>
          <Text style={styles.diagnosisDescription}>{diag.description}</Text>
        </View>
      ));
    } else {
      return renderField('Primary Diagnosis', consultation.diagnosis as string, true);
    }
  };

  const renderSOAPNotes = () => {
    if (!consultation.soapNotes) return null;
    
    const { subjective, objective, assessment, plan } = consultation.soapNotes;
    
    return (
      <View style={styles.soapContainer}>
        {renderField('Subjective', subjective, true)}
        {renderField('Objective', objective, true)}
        {renderField('Assessment', assessment, true)}
        {renderField('Plan', plan, true)}
      </View>
    );
  };

  const renderPrescriptions = () => {
    if (!consultation.prescriptions || consultation.prescriptions.length === 0) return null;
    
    return (
      <View style={styles.prescriptionsContainer}>
        {consultation.prescriptions.map((prescription, index) => (
          <View key={index} style={styles.prescriptionItem}>
            <Text style={styles.prescriptionMedication}>
              {prescription.medication || prescription.description}
            </Text>
            <Text style={styles.prescriptionDetails}>
              {prescription.dosage} • {prescription.frequency}
              {prescription.duration && ` • ${prescription.duration}`}
            </Text>
            {prescription.description && (
              <Text style={styles.prescriptionNotes}>{prescription.description}</Text>
            )}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerInfo}>
            <Text style={styles.consultationType}>
              {consultation.type || 'Consultation'}
            </Text>
            <View style={styles.dateTimeContainer}>
              <View style={styles.dateTimeItem}>
                <Calendar size={16} color="#6B7280" />
                <Text style={styles.dateTimeText}>
                  {formatDate(consultation.consultationDate)}
                </Text>
              </View>
              <View style={styles.dateTimeItem}>
                <Clock size={16} color="#6B7280" />
                <Text style={styles.dateTimeText}>
                  {formatTime(consultation.consultationTime)}
                </Text>
              </View>
            </View>
            {consultation.provider && (
              <View style={styles.providerInfo}>
                <User size={16} color="#6B7280" />
                <Text style={styles.providerText}>
                  Dr. {consultation.provider.firstName} {consultation.provider.lastName}
                  {consultation.provider.providerType && ` (${consultation.provider.providerType})`}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Patient History */}
        {(consultation.presentIllnessHistory || consultation.reviewOfSymptoms) &&
          renderSection(
            'Patient History',
            <User size={20} color="#1E40AF" />,
            <View>
              {renderField('Present Illness History', consultation.presentIllnessHistory, true)}
              {renderField('Review of Symptoms', consultation.reviewOfSymptoms, true)}
            </View>
          )}

        {/* Findings */}
        {(consultation.labResults || consultation.medications) &&
          renderSection(
            'Findings',
            <FileText size={20} color="#1E40AF" />,
            <View>
              {renderField('Lab Results', consultation.labResults, true)}
              {renderField('Current Medications', consultation.medications, true)}
            </View>
          )}

        {/* Diagnosis */}
        {(consultation.diagnosis || consultation.differentialDiagnosis) &&
          renderSection(
            'Diagnosis',
            <Stethoscope size={20} color="#1E40AF" />,
            <View>
              {renderDiagnosis()}
              {renderField('Differential Diagnosis', consultation.differentialDiagnosis, true)}
            </View>
          )}

        {/* SOAP Notes */}
        {consultation.soapNotes &&
          renderSection(
            'SOAP Notes',
            <FileText size={20} color="#1E40AF" />,
            renderSOAPNotes()
          )}

        {/* Treatment */}
        {(consultation.treatmentPlan || consultation.clinicalSummary) &&
          renderSection(
            'Treatment & Summary',
            <Activity size={20} color="#1E40AF" />,
            <View>
              {renderField('Treatment Plan', consultation.treatmentPlan, true)}
              {renderField('Clinical Summary', consultation.clinicalSummary, true)}
            </View>
          )}

        {/* Additional Information */}
        {(consultation.allergies || consultation.vitals || consultation.prescriptions?.length > 0) &&
          renderSection(
            'Additional Information',
            <AlertTriangle size={20} color="#1E40AF" />,
            <View>
              {renderField('Allergies', consultation.allergies, true)}
              {renderField('Vitals', consultation.vitals, true)}
              {renderPrescriptions()}
            </View>
          )}
      </ScrollView>

      {onBack && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Back to Appointments</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  consultationType: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  dateTimeText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  sectionContent: {
    padding: 16,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 24,
  },
  multilineValue: {
    lineHeight: 22,
  },
  diagnosisItem: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  diagnosisCode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  diagnosisDescription: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  soapContainer: {
    gap: 16,
  },
  prescriptionsContainer: {
    gap: 12,
  },
  prescriptionItem: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#1E40AF',
  },
  prescriptionMedication: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  prescriptionDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  prescriptionNotes: {
    fontSize: 14,
    color: '#374151',
    fontStyle: 'italic',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  backButton: {
    backgroundColor: '#1E40AF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
