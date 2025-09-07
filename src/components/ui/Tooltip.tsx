import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
  Dimensions,
  ScrollView,
  FlatList,
} from 'react-native';
import { HelpCircle, X } from 'lucide-react-native';
import { COLORS } from '../../constants/colors';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface TooltipProps {
  title?: string;
  content: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
}

export default function Tooltip({
  title = 'Help',
  content,
  size = 20,
  color = '#6B7280',
  backgroundColor = '#F3F4F6',
}: TooltipProps) {
  const [visible, setVisible] = useState(false);

  const handlePress = () => {
    setVisible(true);
  };

  const handleClose = () => {
    setVisible(false);
  };

  return (
    <>
             <TouchableOpacity
         style={styles.tooltipButton}
         onPress={handlePress}
         activeOpacity={0.7}
       >
         <HelpCircle size={size} color={color} />
       </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.tooltipContainer}>
            <View style={styles.tooltipContent}>
              <View style={styles.tooltipHeader}>
                <Text style={styles.tooltipTitle}>{title}</Text>
                <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                  <X size={18} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <ScrollView 
                style={styles.tooltipBody}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.tooltipScrollContent}
              >
                <Text style={styles.tooltipText}>
                  {content.replace(/^[^•]*\n/, '')}
                </Text>
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  tooltipButton: {
    padding: 4,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tooltipContainer: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_HEIGHT * 0.7,
    maxWidth: 400,
  },
  tooltipContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tooltipTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    flex: 1,
  },
  closeButton: {
    padding: 4,
    borderRadius: 8,
  },
  tooltipBody: {
    flex: 1,
  },
  tooltipScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 30,
  },
  tooltipText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 24,
    marginBottom: 6,
  },
  descriptionText: {
    marginBottom: 20,
  },
  bulletPoint: {
    marginLeft: 0,
    marginBottom: 8,
    paddingLeft: 8,
  },
});
