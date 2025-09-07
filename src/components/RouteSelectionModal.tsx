import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Pressable, StyleSheet, Dimensions, ScrollView, Platform, TextInput,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import Tooltip from './ui/Tooltip';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface RouteOption {
  abbreviation: string;
  meaning: string;
  requiresInput?: boolean;
}

interface RouteSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (route: string) => void;
  userRole: 'patient' | 'specialist';
}

const ROUTE_OPTIONS: RouteOption[] = [
  { abbreviation: 'right ear', meaning: 'right ear' },
  { abbreviation: 'left ear', meaning: 'left ear' },
  { abbreviation: 'each ear', meaning: 'each ear' },
  { abbreviation: 'HHN', meaning: 'handheld nebulizer' },
  { abbreviation: 'IM', meaning: 'intramuscularly' },
  { abbreviation: 'IV', meaning: 'intravenously' },
  { abbreviation: 'IVTT', meaning: 'intravenous therapy technique' },
  { abbreviation: 'IVP', meaning: 'intravenous push' },
  { abbreviation: 'IVPB', meaning: 'intravenous piggyback' },
  { abbreviation: 'MDI', meaning: 'metered-dose inhaler' },
  { abbreviation: 'NEB', meaning: 'nebulizer' },
  { abbreviation: 'NGT or ng', meaning: 'nasogastric tube' },
  { abbreviation: 'in the right eye', meaning: 'in the right eye' },
  { abbreviation: 'in the left eye', meaning: 'in the left eye' },
  { abbreviation: 'in both eyes', meaning: 'in both eyes' },
  { abbreviation: 'po or PO', meaning: 'by mouth' },
  { abbreviation: 'pr or PR', meaning: 'in the rectum' },
  { abbreviation: 'subcutaneously, Sub q', meaning: 'subcutaneously, Sub q' },
  { abbreviation: 'SL', meaning: 'Sublingual, under the tongue' },
  { abbreviation: 'S & S', meaning: 'swish and swallow' },
];

export default function RouteSelectionModal({
  visible,
  onClose,
  onSelect,
  userRole,
}: RouteSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return ROUTE_OPTIONS;
    const query = searchQuery.toLowerCase().trim();
    return ROUTE_OPTIONS.filter(option => 
      option.abbreviation.toLowerCase().includes(query) ||
      option.meaning.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleSelect = (option: RouteOption) => {
    const selectedValue = userRole === 'specialist' ? option.abbreviation : option.meaning;
    onSelect(selectedValue);
    onClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={handleClose}>
        <View style={styles.modalContainer}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View style={styles.titleContainer}>
                <Text style={styles.modalTitle}>Select Route</Text>
                {userRole === 'specialist' && (
                  <Tooltip
                    title="Route Abbreviations Guide"
                    content="• right ear = right ear
• left ear = left ear
• each ear = each ear
• HHN = handheld nebulizer
• IM = intramuscularly
• IV = intravenously
• IVTT = intravenous therapy technique
• IVP = intravenous push
• IVPB = intravenous piggyback
• MDI = metered-dose inhaler
• NEB = nebulizer
• NGT or ng = nasogastric tube
• in the right eye = in the right eye
• in the left eye = in the left eye
• in both eyes = in both eyes
• po or PO = by mouth
• pr or PR = in the rectum
• subcutaneously, Sub q = subcutaneously, Sub q
• SL = Sublingual, under the tongue
• S & S = swish and swallow"
                    size={16}
                    color="#6B7280"
                    backgroundColor="#F3F4F6"
                  />
                )}
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <Search size={18} color="#9CA3AF" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search route options..."
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity style={styles.clearButton} onPress={() => setSearchQuery('')}>
                    <X size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <ScrollView 
              style={styles.routeOptionsContainer}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.routeOptionsContent}
            >
              {filteredOptions.length === 0 ? (
                <View style={styles.noResultsContainer}>
                  <Text style={styles.noResultsText}>No route options found</Text>
                  <Text style={styles.noResultsSubtext}>Try searching with different keywords</Text>
                </View>
              ) : (
                <View style={styles.routeOptions}>
                  {filteredOptions.map((option, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.routeOption}
                      onPress={() => handleSelect(option)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.routeOptionContent}>
                        <Text style={styles.routeOptionText}>
                          {userRole === 'specialist' ? option.abbreviation : option.meaning}
                        </Text>
                        {userRole === 'patient' && (
                          <Text style={styles.routeOptionSubtext}>({option.abbreviation})</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: Platform.OS === 'ios' ? 60 : 40,
  },
  modalContainer: { 
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 400 : SCREEN_WIDTH * 0.9,
    maxHeight: Platform.OS === 'web' ? SCREEN_HEIGHT * 0.7 : SCREEN_HEIGHT * 0.75,
    minHeight: Platform.OS === 'web' ? 400 : 500,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    flex: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeButton: {
    padding: 4,
    borderRadius: 8,
  },

  searchContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
    borderRadius: 8,
  },
  routeOptionsContainer: {
    flex: 1,
  },
  routeOptionsContent: {
    padding: 24,
    paddingTop: 16,
  },
  routeOptions: { 
    gap: 12 
  },
  routeOption: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 56,
  },
  routeOptionContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
    textAlign: 'center',
  },
  routeOptionSubtext: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },

  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
  },

});
