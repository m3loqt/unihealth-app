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
import { ChevronLeft, Shield, FileText, Eye, Lock } from 'lucide-react-native';
import { router } from 'expo-router';

export default function TermsPrivacyScreen() {
  const [activeTab, setActiveTab] = useState('terms');

  const renderTermsContent = () => (
    <View style={styles.contentSection}>
      <View style={styles.sectionHeader}>
        <FileText size={24} color="#1E40AF" />
        <Text style={styles.sectionTitle}>Terms of Service</Text>
      </View>
      <Text style={styles.lastUpdated}>Last updated: December 15, 2024</Text>
      {/* ...rest of Terms content unchanged... */}
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>1. Acceptance of Terms</Text>
        <Text style={styles.blockText}>
          By accessing and using UniHEALTH ("the App"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
        </Text>
      </View>
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>2. Description of Service</Text>
        <Text style={styles.blockText}>
          UniHEALTH is a healthcare management platform that allows users to:
          {'\n'}• Book appointments with healthcare providers
          {'\n'}• Access medical records and history
          {'\n'}• Manage prescriptions and medications
          {'\n'}• View and download medical certificates
          {'\n'}• Communicate with healthcare professionals
        </Text>
      </View>
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>3. User Responsibilities</Text>
        <Text style={styles.blockText}>
          Users are responsible for:
          {'\n'}• Providing accurate and up-to-date personal information
          {'\n'}• Maintaining the confidentiality of their account credentials
          {'\n'}• Using the service in compliance with applicable laws
          {'\n'}• Respecting the privacy and rights of other users
          {'\n'}• Reporting any security vulnerabilities or misuse
        </Text>
      </View>
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>4. Medical Disclaimer</Text>
        <Text style={styles.blockText}>
          UniHEALTH is a platform for healthcare management and communication. It does not provide medical advice, diagnosis, or treatment. Always consult with qualified healthcare professionals for medical decisions.
        </Text>
      </View>
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>5. Limitation of Liability</Text>
        <Text style={styles.blockText}>
          UniHEALTH shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
        </Text>
      </View>
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>6. Modifications to Terms</Text>
        <Text style={styles.blockText}>
          We reserve the right to modify these terms at any time. Users will be notified of significant changes via the app or email. Continued use of the service constitutes acceptance of modified terms.
        </Text>
      </View>
    </View>
  );

  const renderPrivacyContent = () => (
    <View style={styles.contentSection}>
      <View style={styles.sectionHeader}>
        {/* MATCHING COLOR TO TERMS OF SERVICE ICON */}
        <Shield size={24} color="#1E40AF" />
        <Text style={styles.sectionTitle}>Privacy Policy</Text>
      </View>
      <Text style={styles.lastUpdated}>Last updated: December 15, 2024</Text>
      {/* ...rest of Privacy content unchanged... */}
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>1. Information We Collect</Text>
        <Text style={styles.blockText}>
          We collect information you provide directly to us:
          {'\n'}• Personal information (name, email, phone number, address)
          {'\n'}• Health information (medical history, prescriptions, appointments)
          {'\n'}• Account information (username, password, preferences)
          {'\n'}• Communication data (messages with healthcare providers)
        </Text>
      </View>
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>2. How We Use Your Information</Text>
        <Text style={styles.blockText}>
          Your information is used to:
          {'\n'}• Provide and improve our healthcare services
          {'\n'}• Facilitate communication with healthcare providers
          {'\n'}• Send appointment reminders and health notifications
          {'\n'}• Ensure security and prevent fraud
          {'\n'}• Comply with legal and regulatory requirements
        </Text>
      </View>
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>3. Information Sharing</Text>
        <Text style={styles.blockText}>
          We do not sell, trade, or rent your personal information. We may share your information only:
          {'\n'}• With healthcare providers for treatment purposes
          {'\n'}• With your explicit consent
          {'\n'}• As required by law or legal process
          {'\n'}• To protect rights, property, or safety
        </Text>
      </View>
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>4. Data Security</Text>
        <Text style={styles.blockText}>
          We implement industry-standard security measures:
          {'\n'}• End-to-end encryption for sensitive data
          {'\n'}• Secure data storage and transmission
          {'\n'}• Regular security audits and updates
          {'\n'}• Access controls and authentication
          {'\n'}• HIPAA compliance for health information
        </Text>
      </View>
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>5. Your Rights</Text>
        <Text style={styles.blockText}>
          You have the right to:
          {'\n'}• Access your personal information
          {'\n'}• Correct inaccurate information
          {'\n'}• Request deletion of your data
          {'\n'}• Opt-out of certain communications
          {'\n'}• Export your health data
        </Text>
      </View>
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>6. Contact Information</Text>
        <Text style={styles.blockText}>
          For questions about this Privacy Policy, contact us at:
          {'\n'}Email: privacy@unihealth.com
          {'\n'}Phone: +1 (555) 123-HELP
          {'\n'}Address: 123 Healthcare Ave, Medical District, CA 90210
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#1E40AF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Privacy</Text>
        <View style={styles.headerSpacer} />
      </View>
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'terms' && styles.activeTab]}
          onPress={() => setActiveTab('terms')}
        >
          <FileText size={18} color={activeTab === 'terms' ? '#1E40AF' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'terms' && styles.activeTabText]}>
            Terms of Service
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'privacy' && styles.activeTab]}
          onPress={() => setActiveTab('privacy')}
        >
          {/* Privacy icon color MATCHES terms: #1E40AF */}
          <Shield size={18} color={activeTab === 'privacy' ? '#1E40AF' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'privacy' && styles.activeTabText]}>
            Privacy Policy
          </Text>
        </TouchableOpacity>
      </View>
      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {activeTab === 'terms' ? renderTermsContent() : renderPrivacyContent()}
      </ScrollView>
      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerIcon}>
          <Lock size={18} color="#1E40AF" />
        </View>
        <Text style={styles.footerText}>
          Your privacy and security are our top priority
        </Text>
      </View>
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    marginHorizontal: 24,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
  },
  scrollView: {
    flex: 1,
  },
  contentSection: {
    paddingHorizontal: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  lastUpdated: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  contentBlock: {
    marginBottom: 24,
  },
  blockTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 8,
  },
  blockText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28, // increased padding for comfort above nav bar
    paddingHorizontal: 24,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 10,
  },
  footerIcon: {
    opacity: 1,
    marginRight: 8,
  },
  footerText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
    textAlign: 'center',
  },
});
