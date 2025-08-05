import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, Users, Calendar, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SpecialistTabBarProps {
  activeTab?: string;
}

export default function SpecialistTabBar({ activeTab }: SpecialistTabBarProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();

  const TABS = [
    { name: 'index', icon: Home, route: '/(specialist)/tabs' },
    { name: 'patients', icon: Users, route: '/(specialist)/tabs/patients' },
    { name: 'appointments', icon: Calendar, route: '/(specialist)/tabs/appointments' },
    { name: 'profile', icon: User, route: '/(specialist)/tabs/profile' },
  ];

  const getActiveTab = () => {
    if (activeTab) return activeTab;
    if (pathname === '/(specialist)/tabs' || pathname === '/(specialist)/tabs/') return 'index';
    return pathname.split('/').pop();
  };

  const currentActiveTab = getActiveTab();

  return (
    <View style={[styles.tabContainer, {}]}>
      {TABS.map(({ name, icon: Icon, route }) => {
        const isFocused = currentActiveTab === name;

        return (
          <TouchableOpacity
            key={name}
            onPress={() => router.push(route)}
            style={styles.tab}
            activeOpacity={0.9}
          >
            <View style={styles.iconWrapper}>
              <Icon
                size={22}
                color={'#FFFFFF'}
                strokeWidth={isFocused ? 2.5 : 2}
              />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
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
});