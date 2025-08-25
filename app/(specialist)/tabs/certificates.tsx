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
  RefreshControl,
} from 'react-native';
import {
  FileText, Search, Download, Eye, ChevronDown, Check
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { databaseService, Certificate } from '../../../src/services/database/firebase';
import { safeDataAccess } from '../../../src/utils/safeDataAccess';
import LoadingState from '../../../src/components/ui/LoadingState';
import ErrorBoundary from '../../../src/components/ui/ErrorBoundary';
import { dataValidation } from '../../../src/utils/dataValidation';
import { useDeepMemo } from '../../../src/utils/performance';
import SpecialistHeader from '../../../src/components/navigation/SpecialistHeader';

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
  { key: 'patient', label: 'By Patient' },
  { key: 'validUntil', label: 'Valid Until' },
];

export default function SpecialistCertificatesScreen() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showSort, setShowSort] = useState(false);
  const [sortDropdownPos, setSortDropdownPos] = useState({ top: 0, right: 0 });
  const sortBtnRef = useRef<any>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load certificates from Firebase
  useEffect(() => {
    if (user && user.uid) {
      loadCertificates();
    }
  }, [user]);

  const loadCertificates = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      const specialistCertificates = await databaseService.getCertificatesBySpecialist(user.uid);
      
      // Validate certificates data
      const validCertificates = dataValidation.validateArray(specialistCertificates, dataValidation.isValidCertificate);
      console.log('Loaded certificates:', validCertificates.length);
      setCertificates(validCertificates);
    } catch (error) {
      console.error('Error loading certificates:', error);
      setError('Failed to load certificates. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCertificates();
    setRefreshing(false);
  };

  const handleRetry = () => {
    setError(null);
    loadCertificates();
  };

  // Performance optimization: memoize filtered and sorted certificates
  const filteredCertificates = useDeepMemo(() => {
    return certificates
      .filter((cert) => {
        const matchesSearch =
          cert.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cert.patientId.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus =
          statusFilter === 'all' || cert.status.toLowerCase() === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'date':
            return new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime();
          case 'type':
            return a.type.localeCompare(b.type);
          case 'patient':
            return a.patientId.localeCompare(b.patientId);
          case 'validUntil':
            return new Date(b.expiryDate || '').getTime() - new Date(a.expiryDate || '').getTime();
          default:
            return 0;
        }
      });
  }, [certificates, searchQuery, statusFilter, sortBy]);

  const getStatusColors = (status: string) => {
    switch (status) {
      case 'Valid':
        return {
          bg: '#EFF6FF',
          text: '#1E40AF',
          border: '#93C5FD',
        };
      case 'Expired':
        return {
          bg: '#FEF2F2',
          text: '#EF4444',
          border: '#FCA5A5',
        };
      default:
        return {
          bg: '#F3F4F6',
          text: '#6B7280',
          border: '#E5E7EB',
        };
    }
  };

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
        }]}
        >
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

  const handleShowSort = () => {
    if (sortBtnRef.current) {
      sortBtnRef.current.measureInWindow((x: number, y: number, w: number, h: number) => {
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

  const renderCertificateCard = (certificate: Certificate) => {
    const statusColors = getStatusColors(certificate.status);
    return (
      <View
        key={certificate.id}
        style={[styles.certificateCard, { width: cardWidth }]}
      >
        <View style={styles.pdfThumbnail}>
          <View style={styles.pdfPages}>
            <View style={[styles.pdfPage, styles.pdfPageMain]} />
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
            <Text style={[styles.statusLabelText, { color: statusColors.text }]}>
              {certificate.status}
            </Text>
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
        <View style={styles.cardContent}>
          <Text style={styles.certificateType} numberOfLines={2}>
            {certificate.type || 'Medical Certificate'}
          </Text>
          <Text style={styles.doctorName} numberOfLines={1}>
            {certificate.patientId || 'Patient ID not available'}
          </Text>
          <Text style={styles.issuedDate}>
            {certificate.issueDate ? new Date(certificate.issueDate).toLocaleDateString() : 'Date not specified'}
          </Text>
          <View style={styles.gridActions}>
            <TouchableOpacity style={styles.secondaryButton}>
              <Eye size={20} color="#374151" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton}>
              <Download size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <FileText size={48} color="#9CA3AF" />
      </View>
      <Text style={styles.emptyTitle}>
        {'No certificates issued yet'}
      </Text>
      <Text style={styles.emptyDescription}>
        {'Certificates you issue for patients will appear here.'}
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
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      {/* Header */}
      <SpecialistHeader title="Certificates Issued" />
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
        </View>
        <View style={styles.filtersBarRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContent}
          >
            <View style={styles.filtersLeft}>
              {FILTERS.map((filter) => (
                <TouchableOpacity
                  key={filter.value}
                  style={[
                    styles.filterButton,
                    statusFilter === filter.value && styles.activeFilterButton,
                  ]}
                  onPress={() => setStatusFilter(filter.value)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      statusFilter === filter.value && styles.activeFilterText,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={handleShowSort}
            ref={sortBtnRef}
          >
            <ChevronDown size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>
        {renderSortDropdown()}
      </View>
      {/* Certificates List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.certificatesList}>
          {loading ? (
            <LoadingState
              message="Loading certificates..."
              variant="inline"
              size="large"
            />
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : filteredCertificates.length === 0 ? (
            renderEmptyState()
          ) : (
            renderGrid()
          )}
        </View>
      </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
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
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12,
    paddingTop: 0,
  },
  searchRow: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 36,
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
    gap: 10,
    alignItems: 'center',
    paddingVertical: 2,
  },
  filtersLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 6,
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
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginLeft: 12,
    paddingHorizontal: 14,
    alignSelf: 'center',
    zIndex: 10,
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
  },
  cardContent: {
    alignItems: 'flex-start',
  },
  certificateType: {
    fontSize:16,
    color: '#1F2937',
    marginBottom: 4,
    lineHeight: 18,
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
  gridActions: {
    flexDirection: 'row',
    marginTop: 16,
    alignSelf: 'stretch',
    justifyContent: 'space-between',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#1E40AF',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginLeft: 4,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'center',
    marginRight: 4,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
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
    backgroundColor: '#F9FAFB',
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
    fontWeight: 'bold',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
});