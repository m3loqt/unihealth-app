import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  ChevronLeft,
  Search,
  ChevronRight,
  Stethoscope,
  Syringe,
  HeartPulse,
  Shield,
  User,
  PlusCircle,
  Filter as FilterIcon,
  Check,
  MapPin,
  Phone,
  Mail,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { databaseService } from '../../../src/services/database/firebase';

// Map services to icons
const SERVICE_ICONS = {
  'General Medicine': Stethoscope,
  'Cardiology': HeartPulse,
  'Dermatology': Shield,
  'Pediatrics': User,
  'Orthopedics': Shield,
  'Neurology': HeartPulse,
  'Psychiatry': User,
  'Ophthalmology': Shield,
  'Dental': Stethoscope,
  'Gynecology': User,
  'Urology': Shield,
  'Oncology': HeartPulse,
  'Emergency Medicine': Shield,
  'Radiology': Shield,
  'Pathology': Stethoscope,
  'Anesthesiology': Shield,
  'Physical Therapy': User,
  'Nutrition': User,
  'Laboratory': Stethoscope,
  'Pharmacy': Syringe,
};

interface Clinic {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  zipCode: string;
  phone: string;
  email: string;
  type: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  addressLine?: string; // Added for old format
  hasGeneralistDoctors?: boolean; // Added to indicate if clinic has generalist doctors
}

export default function BookVisitScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadClinics();
  }, []);

  const loadClinics = async () => {
    try {
      setLoading(true);
      setError(null);
      const clinicsData = await databaseService.getClinics();
      setClinics(clinicsData);
    } catch (error) {
      console.error('Failed to load clinics:', error);
      setError('Failed to load clinics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredClinics = clinics.filter(clinic =>
    clinic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (clinic.address && clinic.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (clinic.city && clinic.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (clinic.addressLine && clinic.addressLine.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleClinicSelect = (clinic: Clinic) => {
    setSelectedClinic(clinic);
    router.push({
      pathname: '/book-visit/select-doctor',
      params: {
        clinicId: clinic.id,
        clinicName: clinic.name,
      }
    });
  };

  const getServiceIcon = (clinicType: string) => {
    const iconMap: { [key: string]: any } = {
      'hospital': Stethoscope,
      'private_clinic': Shield,
      'specialty_clinic': HeartPulse,
      'medical_center': User,
    };
    return iconMap[clinicType] || Stethoscope;
  };

  const getClinicTypeDisplay = (type: string) => {
    const typeMap: { [key: string]: string } = {
      'hospital': 'Hospital',
      'private_clinic': 'Private Clinic',
      'specialty_clinic': 'Specialty Clinic',
      'medical_center': 'Medical Center',
    };
    return typeMap[type] || 'Clinic';
  };

  const formatClinicAddress = (clinic: Clinic) => {
    // Check for new address format (address, city, province)
    if (clinic.address && clinic.city && clinic.province) {
      const parts = [
        clinic.address,
        clinic.city,
        clinic.province,
        clinic.zipCode
      ].filter(Boolean);
      return parts.join(', ');
    }
    
    // Check for old address format (addressLine)
    if (clinic.addressLine) {
      return clinic.addressLine;
    }
    
    // Fallback
    return 'Address not available';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Book Visit</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E40AF" />
          <Text style={styles.loadingText}>Loading clinics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Book Visit</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadClinics}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Visit</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clinics..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>

      {/* Clinics List */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Clinics</Text>
          <Text style={styles.sectionSubtitle}>
            {filteredClinics.length} clinic{filteredClinics.length !== 1 ? 's' : ''} found
          </Text>
        </View>

        {filteredClinics.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No clinics found</Text>
            <Text style={styles.emptySubtext}>
              Try adjusting your search terms
            </Text>
          </View>
        ) : (
          <View style={styles.clinicsList}>
            {filteredClinics.map((clinic) => {
              const IconComponent = getServiceIcon(clinic.type);
              return (
                <TouchableOpacity
                  key={clinic.id}
                  style={styles.clinicCard}
                  onPress={() => handleClinicSelect(clinic)}
                >
                  <View style={styles.clinicHeader}>
                    <View style={styles.clinicIconContainer}>
                      <IconComponent size={24} color="#1E40AF" />
                    </View>
                    <View style={styles.clinicInfo}>
                      <Text style={styles.clinicName}>{clinic.name}</Text>
                      <Text style={styles.clinicType}>{getClinicTypeDisplay(clinic.type)}</Text>
                    </View>
                    <ChevronRight size={20} color="#9CA3AF" />
                  </View>
                  
                  <View style={styles.clinicDetails}>
                    <View style={styles.detailRow}>
                      <MapPin size={16} color="#6B7280" />
                      <Text style={styles.detailText}>
                        {formatClinicAddress(clinic)}
                      </Text>
                    </View>
                    
                    <View style={styles.detailRow}>
                      <Phone size={16} color="#6B7280" />
                      <Text style={styles.detailText}>{clinic.phone}</Text>
                    </View>
                    
                    {clinic.hasGeneralistDoctors === false && (
                      <View style={styles.warningRow}>
                        <Text style={styles.warningText}>
                          ⚠️ No generalist doctors currently available
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  headerRight: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  clinicsList: {
    gap: 16,
  },
  clinicCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  clinicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  clinicIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clinicInfo: {
    flex: 1,
  },
  clinicName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  clinicType: {
    fontSize: 14,
    color: '#6B7280',
  },
  clinicDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    flex: 1,
  },
  warningRow: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  warningText: {
    fontSize: 13,
    color: '#964B00',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});