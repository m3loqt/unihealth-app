import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Bell, BellRing } from 'lucide-react-native';
import { useRealtimeNotificationContext } from '../../contexts/RealtimeNotificationContext';

interface NotificationToggleProps {
  onPress: () => void;
  showBadge?: boolean;
}

const NotificationToggle: React.FC<NotificationToggleProps> = ({ onPress, showBadge = true }) => {
  const { unreadCount } = useRealtimeNotificationContext();
  const [isRealtimeMode, setIsRealtimeMode] = useState(true);

  const toggleMode = () => {
    setIsRealtimeMode(!isRealtimeMode);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.notificationButton}
        onPress={onPress}
      >
        {isRealtimeMode ? (
          <BellRing size={24} color="#1E40AF" />
        ) : (
          <Bell size={24} color="#6B7280" />
        )}
        {showBadge && unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? '9+' : unreadCount.toString()}
            </Text>
          </View>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={toggleMode}
      >
        <Text style={styles.toggleText}>
          {isRealtimeMode ? 'Real-time' : 'Database'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  toggleButton: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
  },
  toggleText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
});

export default NotificationToggle;
