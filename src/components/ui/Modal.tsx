import React from 'react';
import {
  View,
  Modal as RNModal,
  StyleSheet,
  Pressable,
  ViewStyle,
} from 'react-native';
import { COLORS } from '../../constants/colors';

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  showBackdrop?: boolean;
  backdropOpacity?: number;
  animationType?: 'none' | 'slide' | 'fade';
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  children,
  title,
  showBackdrop = true,
  backdropOpacity = 0.5,
  animationType = 'fade',
  style,
  contentStyle,
}) => {
  const handleBackdropPress = () => {
    if (showBackdrop) {
      onClose();
    }
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType={animationType}
      onRequestClose={onClose}
      accessibilityViewIsModal={true}
      accessibilityLabel="Modal dialog"
    >
      <View style={styles.container}>
        {showBackdrop && (
          <Pressable 
            onPress={handleBackdropPress}
            style={styles.backdrop}
            accessibilityRole="button"
            accessibilityLabel="Close modal"
          >
            <View
              style={[
                styles.backdropOverlay,
                {
                  backgroundColor: `rgba(0, 0, 0, ${backdropOpacity})`,
                },
              ]}
            />
          </Pressable>
        )}
        <View
          style={[
            styles.content,
            style,
          ]}
          accessibilityRole="dialog"
          accessibilityLabel={title || "Modal content"}
        >
          <View style={[styles.modalContent, contentStyle]}>
            {children}
          </View>
        </View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1001,
  },
  backdropOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    zIndex: 1002,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
});

export default Modal; 