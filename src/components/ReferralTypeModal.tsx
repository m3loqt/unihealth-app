import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Platform,
  StatusBar,
} from 'react-native';
import { Stethoscope, User, X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ReferralTypeModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectGeneralist: () => void;
  onSelectSpecialist: () => void;
}

export default function ReferralTypeModal({
  visible,
  onClose,
  onSelectGeneralist,
  onSelectSpecialist,
}: ReferralTypeModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView intensity={22} style={styles.blurView}>
          <View style={styles.overlay} />
        </BlurView>
      </Pressable>
      <View style={styles.modalContainer}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.referralAvatar}>
                  <Stethoscope size={20} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.headerTitle}>Refer Patient</Text>
                  <Text style={styles.headerSubtitle}>Choose the type of healthcare provider</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            {/* Divider */}
            <View style={styles.divider} />
            
            {/* Options */}
            <View style={styles.optionsContainer}>
              {/* Generalist Option */}
              <TouchableOpacity
                style={styles.optionButton}
                onPress={() => {
                  onSelectGeneralist();
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.optionContent}>
                  <View style={styles.iconContainer}>
                    <User size={24} color="#1E40AF" />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.optionTitle}>Generalist</Text>
                    <Text style={styles.optionDescription}>
                      Return to primary care physician
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Specialist Option */}
              <TouchableOpacity
                style={styles.optionButton}
                onPress={() => {
                  onSelectSpecialist();
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.optionContent}>
                  <View style={styles.iconContainer}>
                    <Stethoscope size={24} color="#1E40AF" />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.optionTitle}>Specialist</Text>
                    <Text style={styles.optionDescription}>
                      Refer to medical specialist
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    zIndex: 1,
  },
  blurView: { 
    flex: 1 
  },
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.34)' 
  },
  modalContainer: {
    flex: 1, 
    justifyContent: 'flex-end', 
    zIndex: 2,
  },
  safeArea: { 
    width: '100%' 
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    minHeight: 300,
  },
  header: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  referralAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18, 
    fontFamily: 'Inter-Bold', 
    color: '#1F2937', 
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13, 
    fontFamily: 'Inter-Regular', 
    color: '#6B7280',
  },
  closeButton: {
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#E5E7EB',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 18,
  },
});
