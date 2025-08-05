import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, FileText, Calendar, Pill, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TabBarProps {
  activeTab?: string;
}

export default function TabBar({ activeTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();

  const TABS = [
    { name: 'index', icon: Home },
    { name: 'appointments', icon: Calendar },
    { name: 'prescriptions', icon: Pill },
    { name: 'certificates', icon: FileText },
    { name: 'profile', icon: User },
  ];

  const getActiveTab = () => {
    if (activeTab) return activeTab;
    if (pathname === '/' || pathname === '') return 'index';
    return pathname.replace('/', '');
  };

  const currentActiveTab = getActiveTab();

  return (
    <View style={[styles.tabContainer, { }]}> 
      {TABS.map(({ name, icon: Icon }) => {
        const isFocused = currentActiveTab === name;

        return (
          <TouchableOpacity
            key={name}
            onPress={() => router.push(name === 'index' ? '/(patient)/tabs' : `/(patient)/tabs/${name}`)}
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
    height: 70, // Make the touch area as tall as the tab bar
  },
  iconWrapper: {
    width: 44,
    height: '100%', // Fills the height so content is always centered
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
