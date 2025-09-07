import React, { useState, useRef, useEffect } from 'react';
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
  Dimensions,
  Pressable,
  Alert,
} from 'react-native';
import {
  FileText, Search, Shield, Activity, Syringe, Heart, Stethoscope,
  Filter, ChevronDown, Check, X, Clock, CheckCircle
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/auth/useAuth';
import { databaseService, Certificate } from '@/services/database/firebase';
import { safeDataAccess } from '@/utils/safeDataAccess';
import LoadingState from '@/components/ui/LoadingState';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { dataValidation } from '@/utils/dataValidation';
import { useDeepMemo } from '@/utils/performance';

const { width: screenWidth } = Dimensions.get('window');
const cardWidth = (screenWidth - 64) / 2;

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Valid', value: 'valid' },
  { label: 'Expired', value: 'expired' },
];

const SORT_OPTIONS = [
  { key: 'date', label: 'By Date' },
  { key: 'type', label: 'Alphabetical' },
  { key: 'doctor', label: 'By Doctor' },
  { key: 'validUntil', label: 'Valid Until' },
];

export default function CertificatesScreen() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showSort, setShowSort] = useState(false);
  const [sortDropdownPos, setSortDropdownPos] = useState({ top: 0, right: 0 });
  const sortBtnRef = useRef<View>(null);
  const [userCertificates, setUserCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Header initials for logged in user
  const userInitials = (() => {
    const fullName = safeDataAccess.getUserFullName(user, user?.email || 'User');
    return fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || 'U';
  })();

  // Load certificates from database
  useEffect(() => {
    if (user && user.uid) {
      loadCertificates();
    }
  }, [user]);

  const loadCertificates = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get certificates from patientMedicalHistory node
      const medicalHistory = await databaseService.getMedicalHistoryByPatient(user.uid);
      
      // Extract all certificates from medical history entries
      const allCertificates: any[] = [];
      medicalHistory.forEach((entry) => {
        if (entry.certificates && Array.isArray(entry.certificates)) {
          entry.certificates.forEach((cert) => {
            allCertificates.push({
              ...cert,
                             // Add consultation info for routing
               consultationId: entry.id,
               consultationDate: entry.consultationDate,
               provider: entry.provider,
               // Additional doctor details for enhanced display
               doctorDetails: {
                 id: entry.provider?.id,
                 firstName: entry.provider?.firstName,
                 lastName: entry.provider?.lastName,
                 providerType: entry.provider?.providerType,
                 sourceSystem: entry.provider?.sourceSystem,
               },
              // Map certificate fields to match the expected structure
              id: cert.id || `${entry.id}_${cert.type}_${Date.now()}`,
              issueDate: cert.createdAt || entry.consultationDate,
              expiryDate: cert.validUntil || '',
              status: (() => {
                if (cert.validUntil) {
                  return new Date(cert.validUntil) < new Date() ? 'Expired' : 'Valid';
                }
                // If no expiry date, check if it's older than 1 year
                const issueDate = new Date(cert.createdAt || entry.consultationDate);
                const oneYearAgo = new Date();
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                return issueDate < oneYearAgo ? 'Expired' : 'Valid';
              })(),
                             specialistId: (() => {
                 // Try to get doctor name from multiple sources
                 if (entry.provider?.firstName && entry.provider?.lastName) {
                   return `Dr. ${entry.provider.firstName} ${entry.provider.lastName}`;
                 }
                 if (entry.provider?.firstName) {
                   return `Dr. ${entry.provider.firstName}`;
                 }
                 if (entry.provider?.lastName) {
                   return `Dr. ${entry.provider.lastName}`;
                 }
                 // Fallback to provider ID if available
                 if (entry.provider?.id) {
                   return `Dr. ${entry.provider.id}`;
                 }
                 return 'Dr. Unknown Doctor';
               })(),
              description: cert.description || cert.type,
            });
          });
        }
      });
      
      // Sort by issue date (newest first)
      const sortedCertificates = allCertificates.sort((a, b) => 
        new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
      );
      
      setUserCertificates(sortedCertificates);
    } catch (error) {
      console.error('Error loading certificates:', error);
      setError('Failed to load certificates. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    loadCertificates();
  };

  // Performance optimization: memoize filtered and sorted certificates
  const filteredCertificates = useDeepMemo(() => {
    return userCertificates
      .filter((cert) => {
        const matchesSearch =
          cert.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cert.specialistId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cert.description?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus =
          statusFilter === 'all' || cert.status?.toLowerCase() === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'date':
            return new Date(b.issueDate || '').getTime() - new Date(a.issueDate || '').getTime();
          case 'type':
            return (a.type || '').localeCompare(b.type || '');
          case 'doctor':
            return (a.specialistId || '').localeCompare(b.specialistId || '');
          case 'validUntil':
            return new Date(b.expiryDate || '').getTime() - new Date(a.expiryDate || '').getTime();
          default:
            return 0;
        }
      });
  }, [userCertificates, searchQuery, statusFilter, sortBy]);

  const getStatusColors = (status: string) => {
    return {
      bg: '#F9FAFB',
      text: '#374151',
      border: '#D1D5DB',
    };
  };

  // --- Improved Sort Dropdown ---
  const renderSortDropdown = () => {
    if (!showSort) return null;
    return (
      <Pressable
        style={styles.dropdownBackdrop}
        onPress={() => setShowSort(false)}
      >
        <View style={[styles.sortDropdown, {
          top: sortDropdownPos.top,
          right: sortDropdownPos.right
        }]}>
          {SORT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.sortDropdownItem,
                sortBy === option.key && styles.sortDropdownActiveItem,
              ]}
              onPress={() => {
                setSortBy(option.key);
                setShowSort(false);
              }}
            >
              <Text
                style={[
                  styles.sortDropdownText,
                  sortBy === option.key && styles.sortDropdownActiveText,
                ]}
              >
                {option.label}
              </Text>
              {sortBy === option.key && (
                <Check size={16} color="#1E40AF" style={{ marginLeft: 6 }} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    );
  };

  // Handle dropdown position calculation
  const handleShowSort = () => {
    if (sortBtnRef.current) {
      sortBtnRef.current.measureInWindow((x, y, w, h) => {
        setSortDropdownPos({
          top: y + h - 50,
          right: screenWidth - (x + w),
        });
        setShowSort(true);
      });
    } else {
      setShowSort(true);
    }
  };

  const renderPDFThumbnail = (certificate: Certificate) => {
    const statusColors = getStatusColors(certificate.status);
    return (
      <View style={styles.pdfThumbnail}>
        <View style={styles.pdfPages}>
          <View style={[styles.pdfPage, styles.pdfPageMain]}>
            <View style={styles.pdfHeader}>
              <View style={styles.pdfHeaderLine} />
              <View style={[styles.pdfHeaderLine, { width: '60%' }]} />
            </View>
            <View style={styles.pdfContent}>
              <View style={styles.pdfLine} />
              <View style={[styles.pdfLine, { width: '80%' }]} />
              <View style={[styles.pdfLine, { width: '90%' }]} />
              <View style={[styles.pdfLine, { width: '70%' }]} />
            </View>
            <View
              style={[
                styles.certificateIconOverlay,
                { backgroundColor: '#1E40AF15' },
              ]}
            >
              <FileText size={16} color="#1E40AF" />
            </View>
          </View>
          <View style={[styles.pdfPage, styles.pdfPageShadow]} />
        </View>
        <View
          style={[
            styles.statusLabel,
            {
              backgroundColor: statusColors.bg,
              borderColor: statusColors.border,
              zIndex: 99,
            },
          ]}
        >
          <Text style={styles.statusLabelText}>
            {certificate.status}
          </Text>
        </View>
      </View>
    );
  };

  const renderCertificateCard = (certificate: any) => (
    <TouchableOpacity
      key={certificate.id}
      style={[styles.certificateCard, { width: cardWidth }]}
      activeOpacity={0.7}
      onPress={() => {
        // Route to the appropriate e-certificate based on type
        let route = '/e-certificate-fit-to-work'; // default fallback
        
        if (certificate.type === 'Fit to Work Certificate') {
          route = '/e-certificate-fit-to-work';
        } else if (certificate.type === 'Medical/Sickness Certificate') {
          route = '/e-certificate-medical-sickness';
        } else if (certificate.type === 'Fit to Travel Certificate') {
          route = '/e-certificate-fit-to-travel';
        }
        // Pass the consultation ID and certificate ID for proper data loading
        router.push(route + `?id=${certificate.consultationId}&certificateId=${certificate.id}` as any);
      }}
    >
      {renderPDFThumbnail(certificate)}
      <View style={styles.cardContent}>
        <Text style={styles.certificateType} numberOfLines={2}>
          {certificate.type || 'Medical Certificate'}
        </Text>
        <Text style={styles.issuedByLabel} numberOfLines={1}>
          Issued by
        </Text>
        <Text style={styles.doctorName} numberOfLines={1}>
          {certificate.specialistId || 'Dr. Unknown Doctor'}
        </Text>
        <Text style={styles.issuedDate}>
          {certificate.issueDate ? new Date(certificate.issueDate).toLocaleDateString() : 'Date not specified'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <FileText size={48} color="#9CA3AF" />
      </View>
      <Text style={styles.emptyTitle}>
        {loading ? 'Loading certificates...' : 'No certificates found'}
      </Text>
      <Text style={styles.emptyDescription}>
        {loading 
          ? 'Please wait while we load your certificates...'
          : 'Your medical certificates will appear here once they\'re issued by healthcare providers.'
        }
      </Text>
    </View>
  );

  const renderGrid = () => {
    const rows = [];
    for (let i = 0; i < filteredCertificates.length; i += 2) {
      const leftCard = filteredCertificates[i];
      const rightCard = filteredCertificates[i + 1];
      rows.push(
        <View key={i} style={styles.gridRow}>
          {renderCertificateCard(leftCard)}
          {rightCard && renderCertificateCard(rightCard)}
        </View>
      );
    }
    return rows;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Medical Certificates</Text>
        <TouchableOpacity 
          style={styles.profileButton}
          onPress={() => router.push('/(patient)/tabs/profile')}
        >
          <Text style={styles.profileInitialsText}>{userInitials}</Text>
        </TouchableOpacity>
      </View>

      {/* Filters Container */}
      <View style={styles.filtersContainer}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputContainer}>
            <Search size={18} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search certificates"
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={handleShowSort}
            ref={sortBtnRef}
          >
            <View style={styles.sortButtonContainer}>
              <Filter size={18} color="#6B7280" />
              <ChevronDown size={16} color="#6B7280" />
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.filtersBarRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContent}
          >
            <View style={styles.filtersLeft}>
              {FILTERS.map((filter) => {
                const getFilterIcon = (filterValue: string) => {
                  switch (filterValue.toLowerCase()) {
                    case 'all':
                      return <Search size={14} color={statusFilter === filter.value ? "#FFFFFF" : "#6B7280"} />;
                    case 'valid':
                      return <CheckCircle size={14} color={statusFilter === filter.value ? "#FFFFFF" : "#6B7280"} />;
                    case 'expired':
                      return <X size={14} color={statusFilter === filter.value ? "#FFFFFF" : "#6B7280"} />;
                    default:
                      return null;
                  }
                };

                return (
                  <TouchableOpacity
                    key={filter.value}
                    style={[
                      styles.filterButton,
                      statusFilter === filter.value && styles.activeFilterButton,
                    ]}
                    onPress={() => setStatusFilter(filter.value)}
                  >
                    {getFilterIcon(filter.value)}
                    <Text
                      style={[
                        styles.filterText,
                        statusFilter === filter.value && styles.activeFilterText,
                      ]}
                    >
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
        {renderSortDropdown()}
      </View>

      {/* Certificates List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }} // <--- Added here
      >
        <View style={styles.certificatesList}>
          {loading && error ? (
            <LoadingState message={error} />
          ) : filteredCertificates.length === 0 ? renderEmptyState() : renderGrid()}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 24,
    color: '#1F2937',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  profileInitialsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12,
    paddingTop: 0,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 0,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 64,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    paddingVertical: 0,
  },
  filtersBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
    position: 'relative',
    zIndex: 1,
  },
  filtersContent: {
    gap: 8,
    alignItems: 'center',
    paddingVertical: 2,
  },
  filtersLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 6,
    gap: 6,
  },
  activeFilterButton: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  filterText: {
    fontSize: 14,
    color: '#6B7280',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  sortButton: {
    height: 64, // Match search bar height
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -4 }], // Move up 4 pixels to align with search bar
  },
  sortButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 4,
    minHeight: 64,
  },
  scrollView: {
    flex: 1,
  },
  certificatesList: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  certificateCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'visible',
  },
  pdfThumbnail: {
    position: 'relative',
    height: 120,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfPages: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  pdfPage: {
    position: 'absolute',
    width: '80%',
    height: '90%',
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pdfPageMain: {
    top: 0,
    left: '10%',
    zIndex: 2,
    padding: 8,
  },
  pdfPageShadow: {
    top: 4,
    left: '15%',
    zIndex: 1,
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  pdfHeader: {
    marginBottom: 8,
  },
  pdfHeaderLine: {
    height: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 4,
    borderRadius: 1,
  },
  pdfContent: {
    flex: 1,
  },
  pdfLine: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 4,
    borderRadius: 0.5,
  },
  certificateIconOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusLabel: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 99,
    marginTop: 0,
    marginRight: 0,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 58,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  statusLabelText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.1,
    color: '#374151',
  },
  cardContent: {
    alignItems: 'flex-start',
  },
  certificateType: {
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 4,
    lineHeight: 18,
  },
  issuedByLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 2,
    fontFamily: 'Inter-Regular',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  doctorName: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  issuedDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Dropdown (improved)
  dropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 1000,
  },
  sortDropdown: {
    position: 'absolute',
    minWidth: 170,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 8,
    zIndex: 1100,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  sortDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  sortDropdownText: {
    fontSize: 15,
    color: '#374151',
  },
  sortDropdownActiveItem: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  sortDropdownActiveText: {
    color: '#1E40AF',
    fontFamily: 'Inter-Medium',
  },
});

 
 