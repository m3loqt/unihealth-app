import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Bell, Calendar, User } from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '../../hooks/auth/useAuth';
import { getFirstName } from '../../utils/string';

interface SpecialistHeaderProps {
  title?: string;
  showGreeting?: boolean;
  showNotificationBadge?: boolean;
  notificationCount?: number;
}

export default function SpecialistHeader({ 
  title, 
  showGreeting = false, 
  showNotificationBadge = true,
  notificationCount = 0 
}: SpecialistHeaderProps) {
  const { user } = useAuth();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {showGreeting ? (
          <>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>Dr. {user?.firstName || (user as any)?.name || 'Specialist'}</Text>
          </>
        ) : (
          <Text style={styles.headerTitle}>{title}</Text>
        )}
      </View>
      
      <View style={styles.headerIcons}>
        <TouchableOpacity style={styles.iconButton}>
          <Bell size={24} color="#6B7280" />
          {showNotificationBadge && notificationCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationText}>
                {notificationCount > 9 ? '9+' : notificationCount.toString()}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={() => router.push('/(specialist)/schedule')}
        >
          <Calendar size={24} color="#6B7280" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={() => router.push('/(specialist)/tabs/profile')}
        >
          {user?.firstName || (user as any)?.name ? (
            <View style={styles.profileInitials}>
              <Text style={styles.profileInitialsText}>
                {getFirstName((user as any).name || user.firstName).charAt(0).toUpperCase()}
              </Text>
            </View>
          ) : (
            <Image
              source={{ uri: 'https://via.placeholder.com/36' }}
              style={styles.profileImage}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  userName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    position: 'relative',
    padding: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Inter-Bold',
  },
  profileInitials: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitialsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
});
