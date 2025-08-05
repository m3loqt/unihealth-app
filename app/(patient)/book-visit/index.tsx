import React, { useState } from 'react';
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
} from 'lucide-react-native';
import { router } from 'expo-router';

// Map services to icons
const SERVICE_ICONS = {
  'General Consultation': Stethoscope,
  'Health Checkup': HeartPulse,
  'Vaccination': Syringe,
  'Family Medicine': User,
  'Preventive Care': Shield,
  'Minor Procedures': PlusCircle,
};

const CLINIC_IMAGES = [
  'https://images.pexels.com/photos/236380/pexels-photo-236380.jpeg?auto=compress&w=800&q=80',
  'https://images.pexels.com/photos/263402/pexels-photo-263402.jpeg?auto=compress&w=800&q=80',
  'https://images.pexels.com/photos/1170979/pexels-photo-1170979.jpeg?auto=compress&w=800&q=80',
  'https://images.pexels.com/photos/305568/pexels-photo-305568.jpeg?auto=compress&w=800&q=80',
];

const SERVICES = [
  'All Services',
  'General Consultation',
  'Health Checkup',
  'Vaccination',
  'Family Medicine',
  'Preventive Care',
  'Minor Procedures',
];

const CLINICS = [
  {
    id: 1,
    name: 'Central Family Health Clinic',
    address: '123 Main Street, Downtown District',
    operatingHours: 'Mon-Fri: 8:00 AM - 6:00 PM, Sat: 9:00 AM - 4:00 PM',
    distance: '0.8 km',
    services: ['General Consultation', 'Health Checkup', 'Vaccination', 'Family Medicine'],
  },
  {
    id: 3,
    name: 'Community Healthcare Hub',
    address: '789 Care Boulevard, Residential Area',
    operatingHours: 'Mon-Fri: 9:00 AM - 5:00 PM, Sat: 10:00 AM - 2:00 PM',
    distance: '2.1 km',
    services: ['General Consultation', 'Health Checkup', 'Family Medicine'],
  },
  {
    id: 4,
    name: 'Metro Primary Health Services',
    address: '321 Wellness Street, City Center',
    operatingHours: 'Mon-Sun: 24/7 Emergency, Regular: 8:00 AM - 6:00 PM',
    distance: '1.8 km',
    services: ['General Consultation', 'Health Checkup', 'Vaccination', 'Preventive Care'],
  },
  {
    id: 5,
    name: 'Neighborhood Family Clinic',
    address: '654 Community Drive, Suburb District',
    operatingHours: 'Mon-Fri: 8:30 AM - 5:30 PM, Sat: 9:00 AM - 1:00 PM',
    distance: '3.2 km',
    services: ['General Consultation', 'Family Medicine', 'Minor Procedures'],
  },
];

export default function SelectClinicScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDropdownVisible, setFilterDropdownVisible] = useState(false);
  const [selectedServices, setSelectedServices] = useState(['All Services']);

  // Filtering clinics based on search and selected services
  const filteredClinics = CLINICS.filter((clinic) => {
    const matchesSearch =
      clinic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clinic.address.toLowerCase().includes(searchQuery.toLowerCase());
    const filter =
      selectedServices.includes('All Services')
        ? true
        : clinic.services.some((s) => selectedServices.includes(s));
    return matchesSearch && filter;
  });

  // Checkbox logic
  const toggleService = (service: string) => {
    if (service === 'All Services') {
      setSelectedServices(['All Services']);
    } else {
      let updated = selectedServices.filter((s) => s !== 'All Services');
      if (updated.includes(service)) {
        updated = updated.filter((s) => s !== service);
        if (updated.length === 0) updated = ['All Services'];
      } else {
        updated.push(service);
      }
      setSelectedServices(updated);
    }
  };

  const renderHours = (hours: string) =>
    hours.split(', ').map((str: string, i: number) => (
      <Text key={i} style={[styles.infoValue, i > 0 && { marginTop: 2 }]}>
        {str}
      </Text>
    ));

  const renderClinicCard = (clinic: any, idx: number) => (
    <TouchableOpacity
      key={clinic.id}
      style={styles.clinicCard}
      onPress={() => handleClinicSelect(clinic)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: CLINIC_IMAGES[idx % CLINIC_IMAGES.length] }}
        style={styles.clinicImage}
        resizeMode="cover"
      />
      <View style={styles.clinicHeaderRow}>
        <Text style={styles.clinicName}>{clinic.name}</Text>
        <Text style={styles.clinicDistance}>
          {clinic.distance} <Text style={styles.awayText}>away</Text>
        </Text>
      </View>
      <View style={styles.dividerSubtle} />
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Address</Text>
        <Text style={styles.infoValue}>{clinic.address}</Text>
      </View>
      <View style={[styles.infoRow, styles.infoRowHours]}>
        <Text style={styles.infoLabel}>Hours</Text>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>{renderHours(clinic.operatingHours)}</View>
      </View>
      <View style={styles.dividerSubtle} />
      <View style={styles.servicesContainer}>
        <Text style={styles.servicesLabel}>Services:</Text>
        <View style={styles.servicesTags}>
          {clinic.services.slice(0, 3).map((service: string, i: number) => {
            const Icon = SERVICE_ICONS[service as keyof typeof SERVICE_ICONS] || User;
            return (
              <View key={i} style={styles.serviceTag}>
                <Icon size={14} color="#2563EB" style={{ marginRight: 5 }} />
                <Text style={styles.serviceTagText}>{service}</Text>
              </View>
            );
          })}
          {clinic.services.length > 3 && (
            <View style={styles.serviceTag}>
              <PlusCircle size={14} color="#2563EB" style={{ marginRight: 5 }} />
              <Text style={styles.serviceTagText}>+{clinic.services.length - 3} more</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.clinicFooter}>
        <View style={{ flex: 1 }} />
        <View style={styles.selectButton}>
          <Text style={styles.selectButtonText}>Select clinic</Text>
          <ChevronRight size={16} color="#fff" style={styles.selectButtonIcon} />
        </View>
      </View>
    </TouchableOpacity>
  );

  const handleClinicSelect = (clinic: any) => {
    router.push({
      pathname: '/book-visit/select-datetime',
      params: { clinicId: clinic.id, clinicData: JSON.stringify(clinic) }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#1E40AF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select a Clinic</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarRoot}>
        <View style={styles.progressBarBg} />
        <View style={styles.progressBarActive} />
        <View style={styles.progressDotsRow}>
          <View style={[styles.progressDotNew, styles.progressDotActiveNew, { left: 0 }]} />
          <View style={[styles.progressDotNew, styles.progressDotInactiveNew, { left: '45%' }]} />
          <View style={[styles.progressDotNew, styles.progressDotInactiveNew, { left: '90%' }]} />
        </View>
      </View>

      {/* Search & Filter Row */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by clinic name or location"
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          <Search size={20} color="#1E40AF" style={styles.searchIconInside} />
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          activeOpacity={0.8}
          onPress={() => setFilterDropdownVisible((v) => !v)}
        >
          <FilterIcon size={20} color="#1E40AF" />
        </TouchableOpacity>
      </View>

      {/* Inline Filter Dropdown */}
      {filterDropdownVisible && (
        <View style={styles.dropdownMenu}>
          <Text style={styles.filterTitle}>Filter by Service</Text>
          {SERVICES.map((service) => (
            <TouchableOpacity
              key={service}
              style={styles.checkboxRow}
              onPress={() => toggleService(service)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.checkboxBox,
                selectedServices.includes(service) && styles.checkboxCheckedBox,
              ]}>
                {selectedServices.includes(service) && (
                  <Check size={16} color="#2563EB" />
                )}
              </View>
              <Text
                style={[
                  styles.checkboxLabel,
                  selectedServices.includes(service) && styles.checkboxLabelChecked,
                ]}
              >
                {service}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={() => setFilterDropdownVisible(false)}
          >
            <Text style={styles.modalCloseBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Clinics List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <View style={styles.clinicsList}>
          {filteredClinics.length > 0 ? (
            filteredClinics.map(renderClinicCard)
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No clinics found</Text>
              <Text style={styles.emptyStateSubtext}>
                Try adjusting your search or filter criteria
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const BLUE = '#2563EB';
const LIGHT_BLUE = '#DBEAFE';

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
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  headerSpacer: {
    width: 40,
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
  // --- Progress Bar Styles --- 
  progressBarRoot: {
    height: 26,
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: -6,
    paddingHorizontal: 36,
    position: 'relative',
  },
  progressBarBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    top: '50%',
    marginTop: -2,
  },
  progressBarActive: {
    position: 'absolute',
    left: 0,
    width: 55,
    height: 4,
    borderRadius: 2,
    backgroundColor: BLUE,
    top: '50%',
    marginTop: -2,
    zIndex: 1,
  },
  progressDotsRow: {
    position: 'absolute',
    top: '50%',
    left: 50,
    right: 0,
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
    marginTop: -9,
    pointerEvents: 'none',
    paddingHorizontal: 16,
  },
  progressDotNew: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'absolute',
  },
  progressDotActiveNew: {
    backgroundColor: BLUE,
    borderColor: BLUE,
    zIndex: 10,
  },
  progressDotInactiveNew: {
    backgroundColor: '#E5E7EB',
    borderColor: '#E5E7EB',
    zIndex: 10,
  },
  // --- Search & Filter Row ---
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 10,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center', 
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 5,
    marginRight: 0,
    position: 'relative',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    paddingRight: 30,
  },
  searchIconInside: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -5,
  },
  filterButton: {
    marginLeft: 0,
    height: 53,
    width: 53,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // --- Inline Filter Dropdown Styles ---
  dropdownMenu: {
    position: 'absolute',
    left: 150,
    right: 24,
    top: 200, // adjust for your header/search row height
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    zIndex: 50,
  },
  filterTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    marginBottom: 0,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxCheckedBox: {
    backgroundColor: '#DBEAFE',
    borderColor: '#2563EB',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter-Regular',
  },
  checkboxLabelChecked: {
    color: '#2563EB',
    fontFamily: 'Inter-SemiBold',
  },
  modalCloseBtn: {
    marginTop: 16,
    backgroundColor: '#2563EB',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
  },
  scrollView: {
    flex: 1,
  },
  clinicsList: {
    paddingHorizontal: 24,
  },
  clinicCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    paddingBottom: 18,
  },
  clinicImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginBottom: 12,
  },
  clinicHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingHorizontal: 18,
  },
  clinicName: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    flex: 1,
    marginRight: 8,
  },
  clinicDistance: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Inter-Medium',
    minWidth: 90,
    textAlign: 'right',
  },
  awayText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Inter-Medium',
  },
  dividerSubtle: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 10,
    marginTop: 2,
    marginHorizontal: 18,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 2,
  },
  infoRowHours: {
    marginBottom: 8,
    paddingTop: 0,
    paddingBottom: 2,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter-Medium',
    width: 74,
    paddingTop: 2,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    color: '#374151',
    fontFamily: 'Inter-Regular',
    marginLeft: 8,
    flexWrap: 'wrap',
  },
  servicesContainer: {
    marginBottom: 10,
    paddingHorizontal: 18,
  },
  servicesLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 5,
  },
  servicesTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  serviceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LIGHT_BLUE,
    marginRight: 6,
    marginBottom: 6,
  },
  serviceTagText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: BLUE,
    marginLeft: 2,
  },
  clinicFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 18,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E40AF',
    paddingHorizontal: 17,
    paddingVertical: 9,
    borderRadius: 8,
    marginLeft: 8,
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  selectButtonIcon: {
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
});
