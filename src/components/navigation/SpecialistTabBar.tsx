import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Modal, Alert } from 'react-native';
import { useRouter, usePathname, type Href } from 'expo-router';
import { Home, Users, Calendar, User, QrCode } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../../hooks/data/useNotifications';
import { BarCodeScanner } from 'expo-barcode-scanner';

interface SpecialistTabBarProps {
  activeTab?: string;
}

// Icon prop shape for lucide-react-native components
type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

// Strongly-typed route union for expo-router
type RoutePath =
  | '/(specialist)/tabs'
  | '/(specialist)/tabs/patients'
  | '/(specialist)/tabs/appointments'
  | '/(specialist)/tabs/profile';

type Tab = {
  name: 'index' | 'patients' | 'qr-code' | 'appointments' | 'profile';
  icon: IconComponent;
  route: RoutePath | null; // null for action button
  isAction?: boolean;
};

export default function SpecialistTabBar({ activeTab }: SpecialistTabBarProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { unreadCount } = useNotifications();

  // QR Code state
  const [showQRModal, setShowQRModal] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('🔔 Specialist TabBar - Unread count:', unreadCount);
  }, [unreadCount]);

  // QR Code permission effect
  useEffect(() => {
    const getBarCodeScannerPermissions = async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    };
    getBarCodeScannerPermissions();
  }, []);

  // Pre-typed constants for navigation from scanner
  const PATIENTS_ROUTE: RoutePath = '/(specialist)/tabs/patients';

  // QR Code scan handler
  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setShowQRModal(false);

    try {
      const qrData = JSON.parse(data);
      console.log('QR Code scanned:', qrData);

      if (qrData.patientId) {
        router.push(PATIENTS_ROUTE);
        Alert.alert('Patient Found', `Patient ID: ${qrData.patientId}\nRedirecting to patients list...`);
      } else {
        Alert.alert('QR Code Scanned', `Data: ${data}`);
      }
    } catch (_error) {
      console.log('QR Code scanned (plain text):', data);
      Alert.alert('QR Code Scanned', `Content: ${data}`);
    }
  };

  const handleScanAgain = () => setScanned(false);
  const handleCloseQRModal = () => {
    setShowQRModal(false);
    setScanned(false);
  };

  const TABS: Readonly<Tab[]> = [
    { name: 'index',        icon: Home,     route: '/(specialist)/tabs' },
    { name: 'patients',     icon: Users,    route: '/(specialist)/tabs/patients' },
    { name: 'qr-code',      icon: QrCode,   route: null, isAction: true },
    { name: 'appointments', icon: Calendar, route: '/(specialist)/tabs/appointments' },
    { name: 'profile',      icon: User,     route: '/(specialist)/tabs/profile' },
  ] as const;

  const getActiveTab = (): Tab['name'] | undefined => {
    if (activeTab) return activeTab as Tab['name'];
    if (pathname === '/(specialist)/tabs' || pathname === '/(specialist)/tabs/') return 'index';
    return pathname.split('/').pop() as Tab['name'] | undefined;
  };

  const currentActiveTab = getActiveTab();

  return (
    <>
      <View style={[styles.tabContainer, { paddingBottom: Math.max(insets.bottom * 0.1, 0) }]}>
        {TABS.map(({ name, icon: Icon, route, isAction }) => {
          const isFocused = currentActiveTab === name;
          const showBadge = name === 'profile' && (unreadCount ?? 0) > 0;

          if (isAction) {
            // Special handling for QR Code button
            return (
              <TouchableOpacity
                key={name}
                onPress={() => setShowQRModal(true)}
                style={[styles.tab, styles.qrTab]}
                activeOpacity={0.9}
              >
                <View style={[styles.iconWrapper, styles.qrIconWrapper]}>
                  <Icon size={24} color="#FFFFFF" strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={name}
              onPress={() => {
                if (route) router.push(route as Href);
              }}
              style={styles.tab}
              activeOpacity={0.9}
            >
              <View style={styles.iconWrapper}>
                <Icon size={22} color="#FFFFFF" strokeWidth={isFocused ? 2.5 : 2} />
                {showBadge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {(unreadCount ?? 0) > 99 ? '99+' : String(unreadCount ?? 0)}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* QR Code Scanner Modal */}
      <Modal
        visible={showQRModal}
        transparent
        animationType="slide"
        onRequestClose={handleCloseQRModal}
      >
        <View style={styles.qrModalContainer}>
          <View style={styles.qrModalHeader}>
            <Text style={styles.qrModalTitle}>Scan QR Code</Text>
            <TouchableOpacity style={styles.qrCloseButton} onPress={handleCloseQRModal}>
              <Text style={styles.qrCloseButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.qrScannerContainer}>
            {hasPermission === null ? (
              <Text style={styles.qrPermissionText}>Requesting camera permission...</Text>
            ) : hasPermission === false ? (
              <Text style={styles.qrPermissionText}>No access to camera</Text>
            ) : scanned ? (
              <View style={styles.qrScannedContainer}>
                <Text style={styles.qrScannedText}>QR Code scanned successfully!</Text>
                <TouchableOpacity style={styles.qrScanAgainButton} onPress={handleScanAgain}>
                  <Text style={styles.qrScanAgainButtonText}>Scan Again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <BarCodeScanner
                onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
                style={styles.qrScanner}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    flexDirection: 'row',
    backgroundColor: '#1E40AF',
    borderRadius: 20,
    height: 70,
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
    zIndex: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'red',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // QR Code button styles
  qrTab: {
    flex: 0.8, // Make QR button slightly smaller
  },
  qrIconWrapper: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#059669', // Green background for QR button
  },
  // QR Modal styles
  qrModalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#000000',
  },
  qrModalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  qrCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  qrScannerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrScanner: {
    width: '100%',
    height: '100%',
  },
  qrPermissionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
  qrScannedContainer: {
    alignItems: 'center',
    padding: 20,
  },
  qrScannedText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 20,
    textAlign: 'center',
  },
  qrScanAgainButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  qrScanAgainButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
});
