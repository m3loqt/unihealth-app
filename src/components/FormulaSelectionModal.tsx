import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Pressable, StyleSheet, Dimensions, ScrollView, Platform, TextInput,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import Tooltip from './ui/Tooltip';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface FormulaOption {
  abbreviation: string;
  meaning: string;
  unit: string;
  takeUnit: string;
  totalQuantityUnit: string;
}

interface FormulaSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (formula: string) => void;
  userRole: 'patient' | 'specialist';
}

const FORMULA_OPTIONS: FormulaOption[] = [
  { abbreviation: 'Cap, caps', meaning: 'Capsule', unit: 'mg or g', takeUnit: 'capsule(s)', totalQuantityUnit: 'capsule(s)' },
  { abbreviation: 'El, elix', meaning: 'Elixir', unit: 'mL', takeUnit: 'mL(s)', totalQuantityUnit: 'bottle(s)' },
  { abbreviation: 'sol', meaning: 'Solution', unit: 'mL', takeUnit: 'mL(s) or drop(s)', totalQuantityUnit: 'bottle(s) or mL(s)' },
  { abbreviation: 'Sp', meaning: 'Spirit', unit: 'mL', takeUnit: 'mL(s)', totalQuantityUnit: 'bottle(s)' },
  { abbreviation: 'Sup, supp', meaning: 'Suppository', unit: 'mg or g', takeUnit: 'suppository(ies)', totalQuantityUnit: 'suppository(ies)' },
  { abbreviation: 'Susp', meaning: 'Suspension', unit: 'mg or mL', takeUnit: 'mL(s)', totalQuantityUnit: 'bottle(s)' },
  { abbreviation: 'Syr', meaning: 'Syrup', unit: 'mL', takeUnit: 'mL(s)', totalQuantityUnit: 'bottle(s)' },
  { abbreviation: 'tab, tabs', meaning: 'Tablet', unit: 'mg or g', takeUnit: 'tablet(s)', totalQuantityUnit: 'tablet(s)' },
  { abbreviation: 'tr, tinct.', meaning: 'Tincture', unit: 'mL', takeUnit: 'mL(s)', totalQuantityUnit: 'bottle(s)' },
  { abbreviation: 'Ung, oint.', meaning: 'Ointment', unit: 'g', takeUnit: 'grams', totalQuantityUnit: 'tube(s)' },
  { abbreviation: 'Cream', meaning: 'Cream', unit: 'g', takeUnit: 'grams', totalQuantityUnit: 'tube(s)' },
  { abbreviation: 'Inhaler', meaning: 'Inhaler', unit: 'puff', takeUnit: 'puff(s)', totalQuantityUnit: 'inhaler(s)' },
];

export default function FormulaSelectionModal({
  visible,
  onClose,
  onSelect,
  userRole,
}: FormulaSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return FORMULA_OPTIONS;
    const query = searchQuery.toLowerCase().trim();
    return FORMULA_OPTIONS.filter(option => 
      option.abbreviation.toLowerCase().includes(query) ||
      option.meaning.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleSelect = (option: FormulaOption) => {
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
                <Text style={styles.modalTitle}>Select Formula</Text>
                {userRole === 'specialist' && (
                  <Tooltip
                    title="Formula Abbreviations Guide"
                    content="Common pharmaceutical formula abbreviations used in prescriptions:
                    
• Cap, caps = Capsule (Take: capsule(s), Total: capsule(s))
• El, elix = Elixir (Take: mL(s), Total: bottle(s))
• sol = Solution (Take: mL(s) or drop(s), Total: bottle(s) or mL(s))
• Sp = Spirit (Take: mL(s), Total: bottle(s))
• Sup, supp = Suppository (Take: suppository(ies), Total: suppository(ies))
• Susp = Suspension (Take: mL(s), Total: bottle(s))
• Syr = Syrup (Take: mL(s), Total: bottle(s))
• tab, tabs = Tablet (Take: tablet(s), Total: tablet(s))
• tr, tinct. = Tincture (Take: mL(s), Total: bottle(s))
• Ung, oint. = Ointment (Take: grams, Total: tube(s))
• Cream = Cream (Take: grams, Total: tube(s))
• Inhaler = Inhaler (Take: puff(s), Total: inhaler(s))"
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
                  placeholder="Search formula options..."
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
              style={styles.formulaOptionsContainer}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.formulaOptionsContent}
            >
              {filteredOptions.length === 0 ? (
                <View style={styles.noResultsContainer}>
                  <Text style={styles.noResultsText}>No formula options found</Text>
                  <Text style={styles.noResultsSubtext}>Try searching with different keywords</Text>
                </View>
              ) : (
                <View style={styles.formulaOptions}>
                  {filteredOptions.map((option, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.formulaOption}
                      onPress={() => handleSelect(option)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.formulaOptionContent}>
                        <Text style={styles.formulaOptionText}>
                          {userRole === 'specialist' ? option.abbreviation : option.meaning}
                        </Text>
                        {userRole === 'patient' && (
                          <Text style={styles.formulaOptionSubtext}>({option.abbreviation})</Text>
                        )}
                        <Text style={styles.formulaOptionUnit}>Take: {option.takeUnit}</Text>
                        <Text style={styles.formulaOptionUnit}>Total: {option.totalQuantityUnit}</Text>
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
  formulaOptionsContainer: {
    flex: 1,
  },
  formulaOptionsContent: {
    padding: 24,
    paddingTop: 16,
  },
  formulaOptions: { 
    gap: 12 
  },
  formulaOption: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 70,
  },
  formulaOptionContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  formulaOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
    textAlign: 'center',
  },
  formulaOptionSubtext: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  formulaOptionUnit: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
    fontStyle: 'italic',
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