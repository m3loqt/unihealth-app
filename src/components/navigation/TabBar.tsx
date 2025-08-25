import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Animated, Dimensions, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, FileText, Calendar, Pill, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../../hooks/data/useNotifications';
import { COLORS } from '../../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TabBarProps {
  activeTab?: string;
}

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function TabBar({ activeTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { unreadCount } = useNotifications();

  const TABS = [
    { name: 'index', icon: Home, route: '/(patient)/tabs', label: 'Home' },
    { name: 'appointments', icon: Calendar, route: '/(patient)/tabs/appointments', label: 'Schedule' },
    { name: 'prescriptions', icon: Pill, route: '/(patient)/tabs/prescriptions', label: 'Medicines' },
    { name: 'certificates', icon: FileText, route: '/(patient)/tabs/certificates', label: 'Records' },
    { name: 'profile', icon: User, route: '/(patient)/tabs/profile', label: 'Profile' },
  ] as const;

  // Animation values for each tab
  const animatedValues = React.useRef(
    TABS.reduce((acc, tab) => {
      acc[tab.name] = new Animated.Value(0);
      return acc;
    }, {} as Record<string, Animated.Value>)
  ).current;

  const getActiveTab = () => {
    if (activeTab) return activeTab;

    if (pathname === '/' || pathname === '/(patient)/tabs' || pathname === '/(patient)/tabs/') {
      return 'index';
    }

    const segments = pathname.split('/');
    const lastSegment = segments[segments.length - 1];

    if (lastSegment === 'appointments') return 'appointments';
    if (lastSegment === 'prescriptions') return 'prescriptions';
    if (lastSegment === 'certificates') return 'certificates';
    if (lastSegment === 'profile') return 'profile';

    return 'index';
  };

  const currentActiveTab = getActiveTab();

  // Optimized animations for smooth, fast transitions
  React.useEffect(() => {
    LayoutAnimation.configureNext({
      duration: 250,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
        springDamping: 0.9,
      },
    });

    TABS.forEach((tab) => {
      const isActive = currentActiveTab === tab.name;
      Animated.timing(animatedValues[tab.name], {
        toValue: isActive ? 1 : 0,
        duration: 250,
        useNativeDriver: false,
      }).start();
    });
  }, [currentActiveTab]);

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      <View style={styles.tabBar}>
        {TABS.map(({ name, icon: Icon, route, label }) => {
          const isFocused = currentActiveTab === name;
          const showBadge = name === 'profile' && unreadCount > 0;
          const animatedValue = animatedValues[name];

          return (
            <Animated.View
              key={name}
              style={[
                styles.tabButton,
                {
                  flex: animatedValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.6], // Reduced expansion for smoother feel
                  }),
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => router.push(route)}
                style={styles.touchable}
                activeOpacity={0.8}
              >
                <Animated.View
                  style={[
                    styles.pillContainer,
                    {
                      backgroundColor: animatedValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['transparent', COLORS.white],
                      }),
                      paddingHorizontal: animatedValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [12, 14], // Reduced padding change
                      }),
                      transform: [
                        {
                          scale: animatedValue.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.02], // Minimal scale for subtlety
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Animated.View style={styles.iconContainer}>
                    <Icon
                      size={20}
                      color={isFocused ? COLORS.primary : COLORS.white}
                      strokeWidth={isFocused ? 2.5 : 2}
                      style={styles.icon}
                    />
                  </Animated.View>
                  {isFocused && (
                    <Animated.View
                      style={[
                        styles.labelContainer,
                        {
                          opacity: animatedValue,
                          transform: [
                            {
                              translateX: animatedValue.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-4, 0], // Reduced slide distance
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <Text style={[styles.label, { color: COLORS.primary }]}>
                        {label}
                      </Text>
                    </Animated.View>
                  )}
                  {showBadge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {unreadCount > 99 ? '99+' : unreadCount.toString()}
                      </Text>
                    </View>
                  )}
                </Animated.View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 1000,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.primaryDark,
    marginHorizontal: 14,
    marginBottom: 8,
    borderRadius: 24,
    height: 60,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  touchable: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 15,
    minHeight: 36,
  },
  iconContainer: {
    marginRight: 6,
  },
  icon: {},
  labelContainer: { justifyContent: 'center' },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    borderWidth: 2,
    borderColor: COLORS.primaryDark,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
