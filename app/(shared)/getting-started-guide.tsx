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
  Dimensions,
  Image,
} from 'react-native';
import { 
  ChevronLeft, 
  ChevronRight, 
  Home, 
  Calendar, 
  Pill, 
  FileText, 
  User,
  QrCode,
  Bell,
  Shield,
  CheckCircle,
  ArrowRight,
  BookOpen,
  Stethoscope,
  Clock,
  MapPin,
  Phone,
  Mail,
  Heart,
  Star,
  Users,
  TrendingUp,
  Smartphone,
  Wifi,
  Lock,
  Eye,
  Download,
  Share,
  MessageCircle,
  AlertCircle,
  Info,
  Zap,
  Target,
  Award,
  Globe,
  Settings,
  HelpCircle,
  RefreshCw,
  Fingerprint,
  Pencil,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/auth/useAuth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface GuideSection {
  id: string;
  title: string;
  icon: any;
  content: React.ReactNode;
}

export default function GettingStartedGuideScreen() {
  const [currentSection, setCurrentSection] = useState(0);
  const { user } = useAuth();
  
  // Determine user role
  const isSpecialist = user?.role === 'specialist';
  const isPatient = user?.role === 'patient';

  // Filter sections based on user role
  const allGuideSections: GuideSection[] = [
    {
      id: 'welcome',
      title: 'Welcome to UniHEALTH',
      icon: Heart,
      content: (
        <View style={styles.sectionContent}>
          <View style={styles.welcomeHeader}>
            {/* <View style={styles.logoContainer}>
              <Heart size={48} color="#1E40AF" />
            </View>
            <Text style={styles.welcomeTitle}>Welcome to UniHEALTH</Text> */}
            <Text style={styles.welcomeSubtitle}>
              Your comprehensive healthcare companion designed to make managing your health simple, secure, and accessible.
            </Text>
          </View>
          
          <View style={styles.featureHighlights}>
            <View style={styles.highlightItem}>
              <CheckCircle size={20} color="#10B981" />
              <Text style={styles.highlightText}>Secure & HIPAA Compliant</Text>
            </View>
            <View style={styles.highlightItem}>
              <CheckCircle size={20} color="#10B981" />
              <Text style={styles.highlightText}>24/7 Access to Health Records</Text>
            </View>
            <View style={styles.highlightItem}>
              <CheckCircle size={20} color="#10B981" />
              <Text style={styles.highlightText}>Easy Appointment Booking</Text>
            </View>
            <View style={styles.highlightItem}>
              <CheckCircle size={20} color="#10B981" />
              <Text style={styles.highlightText}>Digital Prescription Management</Text>
            </View>
          </View>
        </View>
      ),
    },
    {
      id: 'navigation',
      title: 'App Navigation',
      icon: Smartphone,
      content: (
        <View style={styles.sectionContent}>
          <Text style={styles.sectionDescription}>
            {isPatient 
              ? "UniHEALTH is organized into 5 main sections accessible through the bottom navigation bar:"
              : isSpecialist 
              ? "As a healthcare specialist, you have access to specialized tools and patient management features:"
              : "UniHEALTH adapts to your role with relevant navigation options:"
            }
          </Text>
          
          {isPatient && (
            <View style={styles.navigationGuide}>
              <View style={styles.navItem}>
                <View style={styles.navIconContainer}>
                  <Home size={24} color="#1E40AF" />
                </View>
                <View style={styles.navContent}>
                  <Text style={styles.navTitle}>Home</Text>
                  <Text style={styles.navDescription}>
                    Dashboard with quick actions, upcoming appointments, and health tips
                  </Text>
                </View>
              </View>
              
              <View style={styles.navItem}>
                <View style={styles.navIconContainer}>
                  <Calendar size={24} color="#1E40AF" />
                </View>
                <View style={styles.navContent}>
                  <Text style={styles.navTitle}>Visits</Text>
                  <Text style={styles.navDescription}>
                    View and manage all your appointments, past and upcoming
                  </Text>
                </View>
              </View>
              
              <View style={styles.navItem}>
                <View style={styles.navIconContainer}>
                  <Pill size={24} color="#1E40AF" />
                </View>
                <View style={styles.navContent}>
                  <Text style={styles.navTitle}>Medicines</Text>
                  <Text style={styles.navDescription}>
                    Track prescriptions and medication schedules
                  </Text>
                </View>
              </View>
              
              <View style={styles.navItem}>
                <View style={styles.navIconContainer}>
                  <FileText size={24} color="#1E40AF" />
                </View>
                <View style={styles.navContent}>
                  <Text style={styles.navTitle}>Records</Text>
                  <Text style={styles.navDescription}>
                    Access medical certificates, reports, and health documents
                  </Text>
                </View>
              </View>
              
              <View style={styles.navItem}>
                <View style={styles.navIconContainer}>
                  <User size={24} color="#1E40AF" />
                </View>
                <View style={styles.navContent}>
                  <Text style={styles.navTitle}>Profile</Text>
                  <Text style={styles.navDescription}>
                    Manage your account, settings, and personal information
                  </Text>
                </View>
              </View>
            </View>
          )}

          {isSpecialist && (
            <View style={styles.navigationGuide}>
              <View style={styles.navItem}>
                <View style={styles.navIconContainer}>
                  <Home size={24} color="#1E40AF" />
                </View>
                <View style={styles.navContent}>
                  <Text style={styles.navTitle}>Home</Text>
                  <Text style={styles.navDescription}>
                    Dashboard with patient metrics, today's appointments, and pending requests
                  </Text>
                </View>
              </View>
              
              <View style={styles.navItem}>
                <View style={styles.navIconContainer}>
                  <Users size={24} color="#1E40AF" />
                </View>
                <View style={styles.navContent}>
                  <Text style={styles.navTitle}>Patients</Text>
                  <Text style={styles.navDescription}>
                    Manage your patient list and view patient profiles
                  </Text>
                </View>
              </View>
              
              <View style={styles.navItem}>
                <View style={styles.navIconContainer}>
                  <QrCode size={24} color="#1E40AF" />
                </View>
                <View style={styles.navContent}>
                  <Text style={styles.navTitle}>QR Scanner</Text>
                  <Text style={styles.navDescription}>
                    Scan patient QR codes for quick check-ins and access
                  </Text>
                </View>
              </View>
              
              <View style={styles.navItem}>
                <View style={styles.navIconContainer}>
                  <Calendar size={24} color="#1E40AF" />
                </View>
                <View style={styles.navContent}>
                  <Text style={styles.navTitle}>Visits</Text>
                  <Text style={styles.navDescription}>
                    Manage appointments, referrals, and consultations
                  </Text>
                </View>
              </View>
              
              <View style={styles.navItem}>
                <View style={styles.navIconContainer}>
                  <User size={24} color="#1E40AF" />
                </View>
                <View style={styles.navContent}>
                  <Text style={styles.navTitle}>Profile</Text>
                  <Text style={styles.navDescription}>
                    Manage your professional profile and account settings
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
      ),
    },
    {
      id: 'home-features',
      title: 'Home Screen Features',
      icon: Home,
      content: (
        <View style={styles.sectionContent}>
          <Text style={styles.sectionDescription}>
            {isPatient 
              ? "Your home screen is your command center with quick access to key features:"
              : isSpecialist 
              ? "Your specialist dashboard provides comprehensive patient management tools:"
              : "Your home screen provides quick access to relevant features:"
            }
          </Text>
          
          {isPatient && (
            <View style={styles.featureGrid}>
              <View style={styles.featureCard}>
                <View style={styles.featureIcon}>
                  <QrCode size={24} color="#1E40AF" />
                </View>
                <Text style={styles.featureTitle}>Generate QR Code</Text>
                <Text style={styles.featureDescription}>
                  Create a personal QR code for quick check-ins at clinics
                </Text>
              </View>
              
              <View style={styles.featureCard}>
                <View style={styles.featureIcon}>
                  <FileText size={24} color="#1E40AF" />
                </View>
                <Text style={styles.featureTitle}>View Medical History</Text>
                <Text style={styles.featureDescription}>
                  Access your complete medical records and consultation history
                </Text>
              </View>
              
              <View style={styles.featureCard}>
                <View style={styles.featureIcon}>
                  <Calendar size={24} color="#1E40AF" />
                </View>
                <Text style={styles.featureTitle}>Book Consultation</Text>
                <Text style={styles.featureDescription}>
                  Schedule appointments with healthcare providers
                </Text>
              </View>
            </View>
          )}

          {isSpecialist && (
            <View style={styles.featureGrid}>
              <View style={styles.featureCard}>
                <View style={styles.featureIcon}>
                  <Users size={24} color="#1E40AF" />
                </View>
                <Text style={styles.featureTitle}>Patient Metrics</Text>
                <Text style={styles.featureDescription}>
                  View total patients, growth trends, and appointment statistics
                </Text>
              </View>
              
              <View style={styles.featureCard}>
                <View style={styles.featureIcon}>
                  <Calendar size={24} color="#1E40AF" />
                </View>
                <Text style={styles.featureTitle}>Today's Schedule</Text>
                <Text style={styles.featureDescription}>
                  See today's appointments, pending requests, and completed visits
                </Text>
              </View>
              
              <View style={styles.featureCard}>
                <View style={styles.featureIcon}>
                  <QrCode size={24} color="#1E40AF" />
                </View>
                <Text style={styles.featureTitle}>QR Scanner</Text>
                <Text style={styles.featureDescription}>
                  Scan patient QR codes for quick check-ins and patient access
                </Text>
              </View>
            </View>
          )}
          
          <View style={styles.infoBox}>
            <Info size={20} color="#3B82F6" />
            <Text style={styles.infoText}>
              {isPatient 
                ? "Your home screen also shows upcoming appointments, active prescriptions, and personalized health tips."
                : isSpecialist 
                ? "Your dashboard shows patient metrics, appointment trends, and quick access to patient management tools."
                : "Your home screen shows relevant notifications, upcoming appointments, and quick access to key features."
              }
            </Text>
          </View>
        </View>
      ),
    },
    {
      id: 'appointments',
      title: 'Managing Appointments',
      icon: Calendar,
      content: (
        <View style={styles.sectionContent}>
          <Text style={styles.sectionDescription}>
            {isPatient 
              ? "Booking and managing appointments is simple with UniHEALTH:"
              : isSpecialist 
              ? "Manage your appointments, consultations, and patient referrals:"
              : "Appointment management varies by your role in UniHEALTH:"
            }
          </Text>
          
          {isPatient && (
            <View style={styles.stepList}>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Book an Appointment</Text>
                  <Text style={styles.stepDescription}>
                    Tap "Book Clinic Consultation" on the home screen or visit the Visits tab
                  </Text>
                </View>
              </View>
              
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Select Clinic & Time</Text>
                  <Text style={styles.stepDescription}>
                    Choose your preferred clinic, date, and available time slot
                  </Text>
                </View>
              </View>
              
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Add Details</Text>
                  <Text style={styles.stepDescription}>
                    Specify the purpose of your visit and any additional notes
                  </Text>
                </View>
              </View>
              
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>4</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Confirm Booking</Text>
                  <Text style={styles.stepDescription}>
                    Review your details and confirm. You'll receive a confirmation within 24 hours
                  </Text>
                </View>
              </View>
            </View>
          )}

          {isSpecialist && (
            <View style={styles.featureGrid}>
              <View style={styles.featureCard}>
                <View style={styles.featureIcon}>
                  <Clock size={24} color="#1E40AF" />
                </View>
                <Text style={styles.featureTitle}>View Appointments</Text>
                <Text style={styles.featureDescription}>
                  See all your appointments with filtering by status (pending, confirmed, completed)
                </Text>
              </View>
              
              <View style={styles.featureCard}>
                <View style={styles.featureIcon}>
                  <Stethoscope size={24} color="#1E40AF" />
                </View>
                <Text style={styles.featureTitle}>Start Consultations</Text>
                <Text style={styles.featureDescription}>
                  Begin consultations directly from confirmed appointments
                </Text>
              </View>
              
              <View style={styles.featureCard}>
                <View style={styles.featureIcon}>
                  <Users size={24} color="#1E40AF" />
                </View>
                <Text style={styles.featureTitle}>Manage Referrals</Text>
                <Text style={styles.featureDescription}>
                  Create and manage specialist referrals for patients
                </Text>
              </View>
            </View>
          )}
          
          <View style={styles.tipBox}>
            <Zap size={20} color="#F59E0B" />
            <Text style={styles.tipText}>
              <Text style={styles.tipTitle}>Pro Tip:</Text> {isPatient 
                ? "You can reschedule or cancel appointments up to 24 hours in advance through the Visits tab."
                : isSpecialist 
                ? "You can manage appointment statuses and start consultations directly from the Visits tab."
                : "Patients can reschedule or cancel appointments up to 24 hours in advance. Specialists can manage appointment statuses and start consultations directly from the Visits tab."
              }
            </Text>
          </View>
        </View>
      ),
    },
    {
      id: 'prescriptions',
      title: 'Prescription Management',
      icon: Pill,
      content: (
        <View style={styles.sectionContent}>
          <Text style={styles.sectionDescription}>
            {isPatient 
              ? "Keep track of your medications and never miss a dose:"
              : "Prescription management features for patients:"
            }
          </Text>
          
          <View style={styles.prescriptionFeatures}>
            <View style={styles.prescriptionFeature}>
              <View style={styles.prescriptionIcon}>
                <Clock size={20} color="#10B981" />
              </View>
              <Text style={styles.prescriptionTitle}>Active Prescriptions</Text>
              <Text style={styles.prescriptionDescription}>
                View current medications with remaining days and dosage instructions
              </Text>
            </View>
            
            <View style={styles.prescriptionFeature}>
              <View style={styles.prescriptionIcon}>
                <RefreshCw size={20} color="#3B82F6" />
              </View>
              <Text style={styles.prescriptionTitle}>Prescription Tracking</Text>
              <Text style={styles.prescriptionDescription}>
                View active prescriptions with dosage and duration information
              </Text>
            </View>
            
            <View style={styles.prescriptionFeature}>
              <View style={styles.prescriptionIcon}>
                <FileText size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.prescriptionTitle}>Medication History</Text>
              <Text style={styles.prescriptionDescription}>
                Access your complete prescription history and doctor notes
              </Text>
            </View>
          </View>
          
          <View style={styles.reminderBox}>
            <Bell size={20} color="#EF4444" />
            <Text style={styles.reminderText}>
              Set up medication reminders in your device settings to never miss a dose.
            </Text>
          </View>
        </View>
      ),
    },
    {
      id: 'certificates',
      title: 'Medical Records & Certificates',
      icon: FileText,
      content: (
        <View style={styles.sectionContent}>
          <Text style={styles.sectionDescription}>
            {isPatient 
              ? "Access and manage your medical documents securely:"
              : "Medical records and certificates available to patients:"
            }
          </Text>
          
          <View style={styles.certificateTypes}>
            <View style={styles.certificateType}>
              <View style={styles.certificateIcon}>
                <CheckCircle size={20} color="#10B981" />
              </View>
              <Text style={styles.certificateTitle}>Fit to Work</Text>
              <Text style={styles.certificateDescription}>
                Medical clearance certificates for employment
              </Text>
            </View>
            
            <View style={styles.certificateType}>
              <View style={styles.certificateIcon}>
                <Calendar size={20} color="#3B82F6" />
              </View>
              <Text style={styles.certificateTitle}>Medical Leave</Text>
              <Text style={styles.certificateDescription}>
                Official documents for sick leave and medical absence
              </Text>
            </View>
            
            <View style={styles.certificateType}>
              <View style={styles.certificateIcon}>
                <Stethoscope size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.certificateTitle}>Health Assessments</Text>
              <Text style={styles.certificateDescription}>
                Comprehensive health evaluation reports
              </Text>
            </View>
            
            <View style={styles.certificateType}>
              <View style={styles.certificateIcon}>
                <Shield size={20} color="#F59E0B" />
              </View>
              <Text style={styles.certificateTitle}>Vaccination Records</Text>
              <Text style={styles.certificateDescription}>
                Immunization history and vaccination certificates
              </Text>
            </View>
          </View>
          
          <View style={styles.downloadBox}>
            <Download size={20} color="#1E40AF" />
            <Text style={styles.downloadText}>
              All certificates can be downloaded as PDF files and shared with employers or institutions.
            </Text>
          </View>
        </View>
      ),
    },
    {
      id: 'profile-settings',
      title: 'Profile & Settings',
      icon: User,
      content: (
        <View style={styles.sectionContent}>
          <Text style={styles.sectionDescription}>
            Customize your UniHEALTH experience and manage your account:
          </Text>
          
          <View style={styles.settingsGrid}>
            <View style={styles.settingItem}>
              <Pencil size={20} color="#1E40AF" />
              <Text style={styles.settingTitle}>Edit Profile</Text>
              <Text style={styles.settingDescription}>
                Update personal information, contact details, and emergency contacts
              </Text>
            </View>
            
            <View style={styles.settingItem}>
              <Fingerprint size={20} color="#1E40AF" />
              <Text style={styles.settingTitle}>Biometric Login</Text>
              <Text style={styles.settingDescription}>
                Enable fingerprint or face recognition for quick access
              </Text>
            </View>
            
            <View style={styles.settingItem}>
              <Bell size={20} color="#1E40AF" />
              <Text style={styles.settingTitle}>Notifications</Text>
              <Text style={styles.settingDescription}>
                View notification preferences (feature coming soon)
              </Text>
            </View>
            
            <View style={styles.settingItem}>
              <Lock size={20} color="#1E40AF" />
              <Text style={styles.settingTitle}>Security</Text>
              <Text style={styles.settingDescription}>
                Change password and manage account security settings
              </Text>
            </View>
          </View>
          
          <View style={styles.emergencyBox}>
            <AlertCircle size={20} color="#EF4444" />
            <Text style={styles.emergencyText}>
              <Text style={styles.emergencyTitle}>Emergency Contact:</Text> Make sure to keep your emergency contact information up to date in your profile.
            </Text>
          </View>
        </View>
      ),
    },
    {
      id: 'security-privacy',
      title: 'Security & Privacy',
      icon: Shield,
      content: (
        <View style={styles.sectionContent}>
          <Text style={styles.sectionDescription}>
            Your health data is protected with industry-leading security measures:
          </Text>
          
          <View style={styles.securityFeatures}>
            <View style={styles.securityFeature}>
              <View style={styles.securityIcon}>
                <Lock size={20} color="#10B981" />
              </View>
              <Text style={styles.securityTitle}>End-to-End Encryption</Text>
              <Text style={styles.securityDescription}>
                All your health data is encrypted both in transit and at rest
              </Text>
            </View>
            
            <View style={styles.securityFeature}>
              <View style={styles.securityIcon}>
                <Shield size={20} color="#3B82F6" />
              </View>
              <Text style={styles.securityTitle}>HIPAA Compliance</Text>
              <Text style={styles.securityDescription}>
                We meet all healthcare privacy and security standards
              </Text>
            </View>
            
            <View style={styles.securityFeature}>
              <View style={styles.securityIcon}>
                <Eye size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.securityTitle}>Access Controls</Text>
              <Text style={styles.securityDescription}>
                Only you and authorized healthcare providers can access your data
              </Text>
            </View>
            
            <View style={styles.securityFeature}>
              <View style={styles.securityIcon}>
                <TrendingUp size={20} color="#F59E0B" />
              </View>
              <Text style={styles.securityTitle}>Regular Audits</Text>
              <Text style={styles.securityDescription}>
                Continuous security monitoring and regular compliance audits
              </Text>
            </View>
          </View>
          
          <View style={styles.privacyBox}>
            <Globe size={20} color="#6B7280" />
            <Text style={styles.privacyText}>
              We never share your personal health information without your explicit consent. You control your data.
            </Text>
          </View>
        </View>
      ),
    },
    {
      id: 'tips-tricks',
      title: 'Tips & Best Practices',
      icon: Star,
      content: (
        <View style={styles.sectionContent}>
          <Text style={styles.sectionDescription}>
            Make the most of your UniHEALTH experience with these helpful tips:
          </Text>
          
          <View style={styles.tipsList}>
            <View style={styles.tipItem}>
              <Target size={20} color="#10B981" />
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Keep Your Profile Updated</Text>
                <Text style={styles.tipDescription}>
                  Regularly update your contact information and emergency contacts
                </Text>
              </View>
            </View>
            
            <View style={styles.tipItem}>
              <Bell size={20} color="#3B82F6" />
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Stay Updated</Text>
                <Text style={styles.tipDescription}>
                  The app automatically sends notifications for appointment updates and status changes
                </Text>
              </View>
            </View>
            
            <View style={styles.tipItem}>
              <QrCode size={20} color="#8B5CF6" />
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Use QR Codes</Text>
                <Text style={styles.tipDescription}>
                  Generate QR codes for quick check-ins at participating clinics
                </Text>
              </View>
            </View>
            
            <View style={styles.tipItem}>
              <Download size={20} color="#F59E0B" />
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Download Certificates</Text>
                <Text style={styles.tipDescription}>
                  Save important medical certificates to your device for offline access
                </Text>
              </View>
            </View>
            
            <View style={styles.tipItem}>
              <MessageCircle size={20} color="#EF4444" />
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Contact Support</Text>
                <Text style={styles.tipDescription}>
                  Use the Help & Support section if you need assistance with any features
                </Text>
              </View>
            </View>
          </View>
        </View>
      ),
    },
  ];

  // Filter sections based on user role
  const guideSections = allGuideSections.filter(section => {
    // Always show welcome, security, and tips sections
    if (['welcome', 'security-privacy', 'tips-tricks'].includes(section.id)) {
      return true;
    }
    
    // Show role-specific sections
    if (isPatient) {
      return ['navigation', 'home-features', 'appointments', 'prescriptions', 'certificates', 'profile-settings'].includes(section.id);
    }
    
    if (isSpecialist) {
      return ['navigation', 'home-features', 'appointments', 'profile-settings'].includes(section.id);
    }
    
    // Default: show all sections if role is not determined
    return true;
  });

  const nextSection = () => {
    if (currentSection < guideSections.length - 1) {
      setCurrentSection(currentSection + 1);
    }
  };

  const prevSection = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
  };

  const currentGuide = guideSections[currentSection];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#1E40AF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Getting Started Guide</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${((currentSection + 1) / guideSections.length) * 100}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>
          {currentSection + 1} of {guideSections.length}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <currentGuide.icon size={32} color="#1E40AF" />
          </View>
          <Text style={styles.sectionTitle}>{currentGuide.title}</Text>
        </View>

        {/* Section Content */}
        {currentGuide.content}

        {/* Navigation Buttons */}
        <View style={styles.navigationContainer}>
          <TouchableOpacity
            style={[styles.navButton, styles.prevButton, currentSection === 0 && styles.navButtonDisabled]}
            onPress={prevSection}
            disabled={currentSection === 0}
          >
            <ChevronLeft size={20} color={currentSection === 0 ? "#9CA3AF" : "#1E40AF"} />
            <Text style={[styles.navButtonText, currentSection === 0 && styles.navButtonTextDisabled]}>
              Previous
            </Text>
          </TouchableOpacity>

          {currentSection < guideSections.length - 1 ? (
            <TouchableOpacity style={styles.navButton} onPress={nextSection}>
              <Text style={styles.navButtonText}>Next</Text>
              <ChevronRight size={20} color="#1E40AF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.completeButton}
              onPress={() => router.back()}
            >
              <CheckCircle size={20} color="#FFFFFF" />
              <Text style={styles.completeButtonText}>Complete Guide</Text>
            </TouchableOpacity>
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
  progressContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1E40AF',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  sectionHeader: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    textAlign: 'center',
  },
  sectionContent: {
    paddingHorizontal: 24,
  },
  sectionDescription: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  
  // Welcome Section
  welcomeHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 24,
    textAlign: 'center',
  },
  featureHighlights: {
    gap: 12,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  highlightText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginLeft: 12,
  },
  
  // Role Sections
  roleSection: {
    marginBottom: 24,
  },
  roleTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 16,
  },
  
  // Navigation Guide
  navigationGuide: {
    gap: 16,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  navIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  navContent: {
    flex: 1,
  },
  navTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  navDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  
  // Feature Grid
  featureGrid: {
    gap: 16,
    marginBottom: 24,
  },
  featureCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
    textAlign: 'center',
  },
  
  // Info Boxes
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1E40AF',
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },
  
  // Step List
  stepList: {
    gap: 20,
    marginBottom: 24,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  
  // Tip Box
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  tipText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#92400E',
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },
  // Prescription Features
  prescriptionFeatures: {
    gap: 16,
    marginBottom: 24,
  },
  prescriptionFeature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  prescriptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  prescriptionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  prescriptionDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  
  // Reminder Box
  reminderBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  reminderText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#DC2626',
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },
  
  // Certificate Types
  certificateTypes: {
    gap: 16,
    marginBottom: 24,
  },
  certificateType: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  certificateIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  certificateTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  certificateDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  
  // Download Box
  downloadBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  downloadText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1E40AF',
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },
  
  // Settings Grid
  settingsGrid: {
    gap: 16,
    marginBottom: 24,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  settingTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
    marginLeft: 12,
  },
  settingDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
    marginLeft: 12,
  },
  
  // Emergency Box
  emergencyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  emergencyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#DC2626',
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },
  emergencyTitle: {
    fontFamily: 'Inter-SemiBold',
  },
  
  // Security Features
  securityFeatures: {
    gap: 16,
    marginBottom: 24,
  },
  securityFeature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  securityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  securityTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  securityDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  
  // Privacy Box
  privacyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  privacyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },
  
  // Tips List
  tipsList: {
    gap: 16,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tipContent: {
    flex: 1,
    marginLeft: 12,
  },
  tipTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  tipDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  
  // Navigation
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 32,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E40AF',
    backgroundColor: '#FFFFFF',
  },
  navButtonDisabled: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  navButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
    marginHorizontal: 8,
  },
  navButtonTextDisabled: {
    color: '#9CA3AF',
  },
  prevButton: {
    flexDirection: 'row-reverse',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#10B981',
  },
  completeButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});
