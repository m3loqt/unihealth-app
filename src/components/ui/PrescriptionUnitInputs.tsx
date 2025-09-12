import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DynamicUnitInput } from './DynamicUnitInput';
import { getFormulaTakeUnit, getFormulaTotalQuantityUnit } from '../../utils/formatting';

export interface PrescriptionUnitInputsProps {
  formula?: string;
  takeValue: string;
  onTakeChange: (value: string) => void;
  totalValue: string;
  onTotalChange: (value: string) => void;
  takePlaceholder?: string;
  totalPlaceholder?: string;
  style?: any;
}

export const PrescriptionUnitInputs: React.FC<PrescriptionUnitInputsProps> = ({
  formula,
  takeValue,
  onTakeChange,
  totalValue,
  onTotalChange,
  takePlaceholder = "Take amount",
  totalPlaceholder = "Total quantity",
  style,
}) => {
  const takeUnit = formula ? getFormulaTakeUnit(formula) : '';
  const totalUnit = formula ? getFormulaTotalQuantityUnit(formula) : '';

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputRow}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Take <Text style={styles.requiredAsterisk}>*</Text></Text>
          <DynamicUnitInput
            value={takeValue}
            onChangeText={onTakeChange}
            formula={formula}
            unitType="take"
            placeholder={takePlaceholder}
            style={styles.input}
          />
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Total Quantity <Text style={styles.requiredAsterisk}>*</Text></Text>
          <DynamicUnitInput
            value={totalValue}
            onChangeText={onTotalChange}
            formula={formula}
            unitType="total"
            placeholder={totalPlaceholder}
            style={styles.input}
          />
        </View>
      </View>
      
      {formula && (
        <View style={styles.unitInfo}>
          <Text style={styles.unitInfoText}>
            Take: {takeUnit} • Total: {totalUnit}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 6,
  },
  requiredAsterisk: {
    color: '#EF4444',
    fontWeight: 'bold',
  },
  input: {
    marginBottom: 0,
  },
  unitInfo: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  unitInfoText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    fontStyle: 'italic',
  },
});
