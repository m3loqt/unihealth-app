import React from 'react';
import { View, TextInput, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { COLORS } from '../../constants/colors';
import { determineUnit, getFormulaTakeUnit, getFormulaTotalQuantityUnit } from '../../utils/formatting';

export interface DynamicUnitInputProps {
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  formula?: string;
  unitType?: 'take' | 'total' | 'auto';
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'number-pad';
  style?: ViewStyle;
  inputStyle?: TextStyle;
  onFocus?: () => void;
  onBlur?: () => void;
}

export const DynamicUnitInput: React.FC<DynamicUnitInputProps> = ({
  placeholder,
  value,
  onChangeText,
  formula,
  unitType = 'auto',
  keyboardType = 'numeric',
  style,
  inputStyle,
  onFocus,
  onBlur,
}) => {
  // Determine the unit based on the formula and unit type
  const getUnit = () => {
    if (!formula) return '';
    
    switch (unitType) {
      case 'take':
        return getFormulaTakeUnit(formula);
      case 'total':
        return getFormulaTotalQuantityUnit(formula);
      case 'auto':
      default:
        const numericValue = parseFloat(value) || 0;
        return determineUnit(formula, numericValue);
    }
  };
  
  const unit = getUnit();
  
  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          keyboardType={keyboardType}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        {unit && (
          <Text style={styles.unitText}>
            {unit}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  input: {
    flex: 1,
    padding: 12,
    paddingRight: 50, // Extra padding to make room for unit text
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    backgroundColor: 'transparent',
  },
  unitText: {
    position: 'absolute',
    right: 12,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    fontWeight: '500',
  },
});
