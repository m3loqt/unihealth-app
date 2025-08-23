import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  Dimensions,
  ScrollView,
  Platform,
  TextInput,
} from 'react-native';
import { Search, X } from 'lucide-react-native';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface DurationUnitOption {
  value: string;
  label: string;
}

interface DurationUnitSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (unit: string) => void;
  userRole?: 'patient' | 'specialist';
}

const DURATION_UNIT_OPTIONS: DurationUnitOption[] = [
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
  { value: 'years', label: 'Years' },
];

export default function DurationUnitSelectionModal({
  visible,
  onClose,
  onSelect,
  userRole = 'specialist',
}: DurationUnitSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter duration unit options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) {
      return DURATION_UNIT_OPTIONS;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return DURATION_UNIT_OPTIONS.filter(option => 
      option.value.toLowerCase().includes(query) ||
      option.label.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleSelect = (option: DurationUnitOption) => {
    onSelect(option.value);
    onClose();
  };

  const handleClose = () => {
    setSearchQuery(''); // Clear search when closing
    onClose();
  };

  const clearSearch = () => {
    setSearchQuery('');
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
                <Text style={styles.modalTitle}>Select Duration Unit</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            {/* Search Input */}
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <Search size={18} color="#9CA3AF" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search duration units..."
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity style={styles.clearButton} onPress={clearSearch}>
                    <X size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <ScrollView 
              style={styles.durationUnitOptionsContainer}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.durationUnitOptionsContent}
            >
              {filteredOptions.length === 0 ? (
                <View style={styles.noResultsContainer}>
                  <Text style={styles.noResultsText}>No duration units found</Text>
                  <Text style={styles.noResultsSubtext}>
                    Try searching with different keywords
                  </Text>
                </View>
              ) : (
                <View style={styles.durationUnitOptions}>
                  {filteredOptions.map((option, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.durationUnitOption}
                      onPress={() => handleSelect(option)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.durationUnitOptionText}>
                        {option.label}
                      </Text>
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
  durationUnitOptionsContainer: {
    flex: 1,
  },
  durationUnitOptionsContent: {
    padding: 24,
    paddingTop: 16,
  },
  durationUnitOptions: { 
    gap: 12 
  },
  durationUnitOption: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  durationUnitOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
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
