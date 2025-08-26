import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { X } from 'lucide-react-native';
import Button from './Button';

interface TimePickerProps {
  visible: boolean;
  onClose: () => void;
  onTimeSelect: (time: string) => void;
  currentTime?: string;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const PERIODS = ['AM', 'PM'];

export default function TimePicker({ 
  visible, 
  onClose, 
  onTimeSelect, 
  currentTime 
}: TimePickerProps) {
  const [selectedHour, setSelectedHour] = useState(9);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');

  const handleConfirm = () => {
    const timeString = `${selectedHour.toString().padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')} ${selectedPeriod}`;
    onTimeSelect(timeString);
    onClose();
  };

  const formatTime = (hour: number, minute: number, period: string) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Select Time</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.timeDisplay}>
            <Text style={styles.timeText}>
              {formatTime(selectedHour, selectedMinute, selectedPeriod)}
            </Text>
          </View>

          <View style={styles.pickerContainer}>
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>Hour</Text>
              <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                {HOURS.map(hour => (
                  <TouchableOpacity
                    key={hour}
                    style={[
                      styles.pickerItem,
                      selectedHour === hour && styles.pickerItemSelected
                    ]}
                    onPress={() => setSelectedHour(hour)}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      selectedHour === hour && styles.pickerItemTextSelected
                    ]}>
                      {hour.toString().padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>Minute</Text>
              <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                {MINUTES.map(minute => (
                  <TouchableOpacity
                    key={minute}
                    style={[
                      styles.pickerItem,
                      selectedMinute === minute && styles.pickerItemSelected
                    ]}
                    onPress={() => setSelectedMinute(minute)}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      selectedMinute === minute && styles.pickerItemTextSelected
                    ]}>
                      {minute.toString().padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>Period</Text>
              <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                {PERIODS.map(period => (
                  <TouchableOpacity
                    key={period}
                    style={[
                      styles.pickerItem,
                      selectedPeriod === period && styles.pickerItemSelected
                    ]}
                    onPress={() => setSelectedPeriod(period as 'AM' | 'PM')}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      selectedPeriod === period && styles.pickerItemTextSelected
                    ]}>
                      {period}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.footer}>
            <Button
              title="Cancel"
              onPress={onClose}
              variant="outline"
              style={styles.cancelButton}
            />
            <Button
              title="Confirm"
              onPress={handleConfirm}
              style={styles.confirmButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  timeDisplay: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#F9FAFB',
  },
  timeText: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  pickerContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginBottom: 12,
  },
  pickerScroll: {
    height: 200,
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
    minWidth: 60,
    alignItems: 'center',
  },
  pickerItemSelected: {
    backgroundColor: '#1E40AF',
  },
  pickerItemText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
  pickerItemTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 1,
  },
});
