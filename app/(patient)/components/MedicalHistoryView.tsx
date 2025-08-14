import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import {
  ChevronDown,
  ChevronRight,
  Stethoscope,
  Pill,
  FileText,
  AlertCircle,
  CheckCircle,
} from 'lucide-react-native';
import { MedicalHistory } from '../../../src/services/database/firebase';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface MedicalHistoryViewProps {
  medicalHistory: MedicalHistory;
}

export default function MedicalHistoryView({ medicalHistory }: MedicalHistoryViewProps) {
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    clinicalSummary: true,
    diagnosis: true,
    treatmentPlan: true,
    prescriptions: true,
  });

  const toggleSection = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSections(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

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

  return (
    <View style={styles.container}>
      {/* Clinical Summary Section */}
      <View style={styles.sectionSpacing}>
        <Text style={styles.sectionTitle}>Medical History</Text>
        <View style={styles.cardBoxClinical}>
          <TouchableOpacity 
            style={styles.clinicalSectionHeader} 
            onPress={() => toggleSection('clinicalSummary')}
          >
            <Text style={styles.clinicalSectionLabel}>Clinical Summary</Text>
            {expandedSections['clinicalSummary'] ? (
              <ChevronDown size={23} color="#6B7280" />
            ) : (
              <ChevronRight size={23} color="#9CA3AF" />
            )}
          </TouchableOpacity>
          {expandedSections['clinicalSummary'] && (
            <View style={styles.clinicalSectionBody}>
              <View style={styles.clinicalFieldRow}>
                <Text style={styles.clinicalFieldLabel}>Summary:</Text>
                <Text style={styles.clinicalFieldValue}>{medicalHistory.clinicalSummary}</Text>
              </View>
              <View style={styles.clinicalFieldRow}>
                <Text style={styles.clinicalFieldLabel}>Consultation Date:</Text>
                <Text style={styles.clinicalFieldValue}>
                  {formatDate(medicalHistory.consultationDate)}
                </Text>
              </View>
              <View style={styles.clinicalFieldRow}>
                <Text style={styles.clinicalFieldLabel}>Consultation Time:</Text>
                <Text style={styles.clinicalFieldValue}>
                  {formatTime(medicalHistory.consultationTime)}
                </Text>
              </View>
              <View style={styles.clinicalFieldRow}>
                <Text style={styles.clinicalFieldLabel}>Provider:</Text>
                <Text style={styles.clinicalFieldValue}>
                  {medicalHistory.provider.firstName} {medicalHistory.provider.lastName}
                </Text>
              </View>
              {medicalHistory.practiceLocation && (
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Location:</Text>
                  <Text style={styles.clinicalFieldValue}>
                    {medicalHistory.practiceLocation.roomOrUnit}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Diagnosis Section */}
      {medicalHistory.diagnosis && medicalHistory.diagnosis.length > 0 && (
        <View style={styles.sectionSpacing}>
          <View style={styles.cardBoxClinical}>
            <TouchableOpacity 
              style={styles.clinicalSectionHeader} 
              onPress={() => toggleSection('diagnosis')}
            >
              <View style={styles.sectionHeaderLeft}>
                <Stethoscope size={20} color="#1E40AF" />
                <Text style={styles.clinicalSectionLabel}>Diagnosis</Text>
              </View>
              {expandedSections['diagnosis'] ? (
                <ChevronDown size={23} color="#6B7280" />
              ) : (
                <ChevronRight size={23} color="#9CA3AF" />
              )}
            </TouchableOpacity>
            {expandedSections['diagnosis'] && (
              <View style={styles.clinicalSectionBody}>
                {medicalHistory.diagnosis.map((diagnosis, index) => (
                  <View key={index} style={styles.diagnosisItem}>
                    <View style={styles.diagnosisCodeContainer}>
                      <Text style={styles.diagnosisCode}>{diagnosis.code}</Text>
                    </View>
                    <Text style={styles.diagnosisDescription}>{diagnosis.description}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Treatment Plan Section */}
      {medicalHistory.treatmentPlan && (
        <View style={styles.sectionSpacing}>
          <View style={styles.cardBoxClinical}>
            <TouchableOpacity 
              style={styles.clinicalSectionHeader} 
              onPress={() => toggleSection('treatmentPlan')}
            >
              <View style={styles.sectionHeaderLeft}>
                <FileText size={20} color="#1E40AF" />
                <Text style={styles.clinicalSectionLabel}>Treatment Plan</Text>
              </View>
              {expandedSections['treatmentPlan'] ? (
                <ChevronDown size={23} color="#6B7280" />
              ) : (
                <ChevronRight size={23} color="#9CA3AF" />
              )}
            </TouchableOpacity>
            {expandedSections['treatmentPlan'] && (
              <View style={styles.clinicalSectionBody}>
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Plan:</Text>
                  <Text style={styles.clinicalFieldValue}>{medicalHistory.treatmentPlan}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Prescriptions Section */}
      {medicalHistory.prescriptions && medicalHistory.prescriptions.length > 0 && (
        <View style={styles.sectionSpacing}>
          <View style={styles.cardBoxClinical}>
            <TouchableOpacity 
              style={styles.clinicalSectionHeader} 
              onPress={() => toggleSection('prescriptions')}
            >
              <View style={styles.sectionHeaderLeft}>
                <Pill size={20} color="#1E40AF" />
                <Text style={styles.clinicalSectionLabel}>Prescriptions</Text>
              </View>
              {expandedSections['prescriptions'] ? (
                <ChevronDown size={23} color="#6B7280" />
              ) : (
                <ChevronRight size={23} color="#9CA3AF" />
              )}
            </TouchableOpacity>
            {expandedSections['prescriptions'] && (
              <View style={styles.clinicalSectionBody}>
                {medicalHistory.prescriptions.map((prescription, index) => (
                  <View key={index} style={styles.prescriptionItem}>
                    <Text style={styles.prescriptionMedication}>{prescription.medication}</Text>
                    <Text style={styles.prescriptionDetails}>
                      {prescription.dosage} • {prescription.frequency}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}




    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionSpacing: {
    marginHorizontal: 24,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 19,
    color: '#1F2937',
    fontFamily: 'Inter-Bold',
    marginBottom: 20,
    letterSpacing: 0.15,
  },
  cardBoxClinical: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 7,
    paddingHorizontal: 0,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
    shadowColor: '#00000022',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  clinicalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 12,
    backgroundColor: '#F5F6F8',
    marginBottom: 2,
    marginTop: 2,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clinicalSectionLabel: {
    fontSize: 16, 
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.05,
    marginLeft: 8,
  },
  clinicalSectionBody: {
    paddingHorizontal: 26,
    paddingTop: 6,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  clinicalFieldRow: {
    marginBottom: 0,
    paddingVertical: 8,
    borderRadius: 7,
  },
  clinicalFieldLabel: {
    fontSize: 14,
    color: '#8B949E',
    fontFamily: 'Inter-Regular',
    marginBottom: 2,
  },
  clinicalFieldValue: {
    fontSize: 14,
    color: '#23272F',
    fontFamily: 'Inter-Medium',
    lineHeight: 22,
    letterSpacing: 0.01,
  },
  diagnosisItem: {
    marginBottom: 12,
    paddingVertical: 8,
  },
  diagnosisCodeContainer: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  diagnosisCode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
    fontFamily: 'Inter-SemiBold',
  },
  diagnosisDescription: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter-Medium',
    lineHeight: 20,
  },
  prescriptionItem: {
    marginBottom: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  prescriptionMedication: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  prescriptionDetails: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  labItem: {
    marginBottom: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  labHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  labTest: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
  },
  labValue: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter-Medium',
  },
  labNotes: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
    fontStyle: 'italic',
  },
});
