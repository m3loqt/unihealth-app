import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Pressable, StyleSheet, Dimensions, ScrollView, Platform, TextInput,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import Tooltip from './ui/Tooltip';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface FrequencyOption {
  abbreviation: string;
  meaning: string;
}

interface FrequencySelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (frequency: string) => void;
  userRole: 'patient' | 'specialist';
}

const FREQUENCY_OPTIONS: FrequencyOption[] = [
  { abbreviation: 'ac', meaning: 'before meals' },
  { abbreviation: 'pc', meaning: 'after meals' },
  { abbreviation: 'daily', meaning: 'every day, daily' },
  { abbreviation: 'bid', meaning: 'twice a day' },
  { abbreviation: 'tid', meaning: 'three times a day' },
  { abbreviation: 'qid', meaning: 'four times a day' },
  { abbreviation: 'qh', meaning: 'every hour' },
  { abbreviation: 'at bedtime', meaning: 'at bedtime, hour of sleep' },
  { abbreviation: 'qn', meaning: 'every night' },
  { abbreviation: 'stat', meaning: 'immediately' },
  { abbreviation: 'q2h', meaning: 'Every 2 hours' },
  { abbreviation: 'q4h', meaning: 'Every 4 hours' },
  { abbreviation: 'q6h', meaning: 'Every 6 hours' },
  { abbreviation: 'q8h', meaning: 'Every 8 hours' },
  { abbreviation: 'q12h', meaning: 'Every 12 hours' },
  { abbreviation: 'every other day', meaning: 'every other day' },
  { abbreviation: 'prn', meaning: 'as needed' },
  { abbreviation: '3 times weekly', meaning: 'three times per week' },
  { abbreviation: 'biw', meaning: 'twice per week' },
  { abbreviation: 'qw', meaning: 'once per week' },
];

export default function FrequencySelectionModal({
  visible,
  onClose,
  onSelect,
  userRole,
}: FrequencySelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter frequency options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) {
      return FREQUENCY_OPTIONS;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return FREQUENCY_OPTIONS.filter(option => 
      option.abbreviation.toLowerCase().includes(query) ||
      option.meaning.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleSelect = (option: FrequencyOption) => {
    const selectedValue = userRole === 'specialist' ? option.abbreviation : option.meaning;
    onSelect(selectedValue);
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
                <Text style={styles.modalTitle}>Select Frequency</Text>
                {userRole === 'specialist' && (
                  <Tooltip
                    title="Time Abbreviations Guide"
                    content="Common medical time abbreviations used in prescriptions:
                    
• ac = before meals
• pc = after meals  
• bid = twice a day
• tid = three times a day
• qid = four times a day
• qh = every hour
• q2h = every 2 hours
• q4h = every 4 hours
• q6h = every 6 hours
• q8h = every 8 hours
• q12h = every 12 hours
• prn = as needed
• stat = immediately
• at bedtime = at bedtime
• qn = every night
• biw = twice per week
• qw = once per week"
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
            
            {/* Search Input */}
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <Search size={18} color="#9CA3AF" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search frequency options..."
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
              style={styles.frequencyOptionsContainer}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.frequencyOptionsContent}
            >
              {filteredOptions.length === 0 ? (
                <View style={styles.noResultsContainer}>
                  <Text style={styles.noResultsText}>No frequency options found</Text>
                  <Text style={styles.noResultsSubtext}>
                    Try searching with different keywords
                  </Text>
                </View>
              ) : (
                <View style={styles.frequencyOptions}>
                  {filteredOptions.map((option, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.frequencyOption}
                      onPress={() => handleSelect(option)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.frequencyOptionText}>
                        {userRole === 'specialist' ? option.abbreviation : option.meaning}
                      </Text>
                      {userRole === 'patient' && (
                        <Text style={styles.frequencyOptionSubtext}>
                          ({option.abbreviation})
                        </Text>
                      )}
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
  frequencyOptionsContainer: {
    flex: 1,
  },
  frequencyOptionsContent: {
    padding: 24,
    paddingTop: 16,
  },
  frequencyOptions: { 
    gap: 12 
  },
  frequencyOption: {
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
  frequencyOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
    textAlign: 'center',
  },
  frequencyOptionSubtext: {
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
