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
import { ChevronLeft, ChevronDown, ChevronRight, Book, Shield } from 'lucide-react-native';
import { router } from 'expo-router';

const FAQ_DATA = [
  {
    id: 1,
    question: 'How do I book an appointment?',
    answer: 'To book an appointment:\n1. Tap "Book Clinic Consultation" on the home screen\n2. Select your preferred clinic\n3. Choose an available date and time\n4. Select the purpose of your visit\n5. Add any additional notes\n6. Review and confirm your booking\n\nThe clinic will review and confirm your appointment within 24 hours.',
  },
  {
    id: 2,
    question: 'How can I view my medical records?',
    answer: 'You can access your medical records by:\n1. Tapping "View Medical History" on the home screen\n2. Or going to Appointments tab and selecting completed appointments\n3. Tap "View Details" on any completed visit\n\nYour records include consultation notes, prescriptions, and medical certificates.',
  },
  {
    id: 3,
    question: 'How do I manage my prescriptions?',
    answer: 'In the Prescriptions tab, you can:\n• View active prescriptions with remaining days\n• Request prescription refills\n• View past prescriptions and medication history\n• See dosage instructions and doctor notes\n• Track medication schedules',
  },
  {
    id: 4,
    question: 'What are medical certificates and how do I get them?',
    answer: 'Medical certificates are official documents issued by healthcare providers for:\n• Fit to work clearance\n• Medical leave\n• Health assessments\n• Vaccination records\n\nThey are automatically generated after certain appointments and can be viewed in the Certificates tab.',
  },
  {
    id: 5,
    question: 'How do I update my profile information?',
    answer: 'To update your profile:\n1. Go to Profile tab\n2. Tap "Edit Profile" in Settings\n3. Update your information (name, email, phone, address)\n4. Tap "Save Changes"\n\nYou can also change your profile photo and update emergency contact information.',
  },
  {
    id: 6,
    question: 'How do notifications work?',
    answer: 'UniHEALTH sends notifications for:\n• Appointment confirmations and reminders\n• Prescription refill reminders\n• New medical records available\n• Important health updates\n\nYou can manage notification preferences in Profile > Settings > Notification Preferences.',
  },
  {
    id: 7,
    question: 'Is my health data secure?',
    answer: 'Yes, your health data is protected with:\n• End-to-end encryption\n• HIPAA compliance\n• Secure data storage\n• Regular security audits\n• Access controls and authentication\n\nWe never share your personal health information without your explicit consent.',
  },
  {
    id: 8,
    question: 'How do I cancel or reschedule an appointment?',
    answer: 'To modify your appointment:\n1. Go to Appointments tab\n2. Find your upcoming appointment\n3. Tap on the appointment card\n4. Select "Reschedule" or "Cancel"\n\nNote: Cancellations must be made at least 24 hours in advance to avoid fees.',
  },
];

export default function HelpSupportScreen() {
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const toggleFAQ = (id: number) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#1E40AF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <View style={styles.faqContainer}>
            {FAQ_DATA.map((faq) => (
              <View key={faq.id} style={styles.faqItem}>
                <TouchableOpacity
                  style={styles.faqQuestion}
                  onPress={() => toggleFAQ(faq.id)}
                >
                  <Text style={styles.faqQuestionText}>{faq.question}</Text>
                  <ChevronDown
                    size={20}
                    color="#6B7280"
                    style={[
                      styles.faqChevron,
                      expandedFAQ === faq.id && styles.faqChevronExpanded,
                    ]}
                  />
                </TouchableOpacity>
                {expandedFAQ === faq.id && (
                  <View style={styles.faqAnswer}>
                    <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* App Guide */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Guide</Text>
          <TouchableOpacity 
            style={styles.guideCard}
            onPress={() => router.push('/(shared)/getting-started-guide')}
          >
            <Book size={24} color="#1E40AF" />
            <View style={styles.guideContent}>
              <Text style={styles.guideTitle}>Getting Started Guide</Text>
              <Text style={styles.guideText}>
                Learn how to make the most of UniHEALTH with our comprehensive user guide.
              </Text>
            </View>
            <ChevronRight size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Privacy & Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Security</Text>
          <View style={styles.privacyCard}>
            <Shield size={24} color="#1E40AF" />
            <View style={styles.privacyContent}>
              <Text style={styles.privacyTitle}>Your Data is Protected</Text>
              <Text style={styles.privacyText}>
                We use industry-standard encryption and security measures to protect your health information.
              </Text>
            </View>
          </View>
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
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 16,
  },
  // FAQ Styles
  faqContainer: {
    gap: 8,
  },
  faqItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  faqQuestionText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    flex: 1,
    marginRight: 12,
  },
  faqChevron: {
    transform: [{ rotate: '0deg' }],
  },
  faqChevronExpanded: {
    transform: [{ rotate: '180deg' }],
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  faqAnswerText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
  },
  // App Guide Card
  guideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  guideContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  guideTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  guideText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 18,
  },
  // Privacy & Security (matches App Guide style)
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  privacyContent: {
    flex: 1,
    marginLeft: 12,
  },
  privacyTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  privacyText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 18,
  },
});
