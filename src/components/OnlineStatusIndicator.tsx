import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUserOnlineStatus } from '../hooks/useOnlineStatus';

interface OnlineStatusIndicatorProps {
  userId: string;
  showText?: boolean;
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

export const OnlineStatusIndicator: React.FC<OnlineStatusIndicatorProps> = ({
  userId,
  showText = false,
  size = 'medium',
  style
}) => {
  const { isOnline, status, formattedLastSeen, loading } = useUserOnlineStatus(userId);
  
  // Debug logging
  console.log('🔍 OnlineStatusIndicator Debug:', {
    userId,
    isOnline,
    status,
    loading,
    formattedLastSeen
  });

  if (loading) {
    return (
      <View style={[styles.container, style]}>
        <View style={[styles.dot, styles.loading, getSizeStyles(size)]} />
        {showText && <Text style={styles.text}>Loading...</Text>}
      </View>
    );
  }

  const getStatusColor = () => {
    if (!isOnline) return '#9CA3AF'; // Gray for offline
    
    switch (status?.status) {
      case 'online':
        return '#10B981'; // Green
      case 'away':
        return '#F59E0B'; // Yellow
      case 'busy':
        return '#EF4444'; // Red
      default:
        return '#9CA3AF'; // Gray
    }
  };

  const getStatusText = () => {
    if (!isOnline) return `Last seen ${formattedLastSeen}`;
    
    switch (status?.status) {
      case 'online':
        return 'Online';
      case 'away':
        return 'Away';
      case 'busy':
        return 'Busy';
      default:
        return 'Offline';
    }
  };

  const dotColor = getStatusColor();
  
  return (
    <View style={[styles.container, style]}>
      <View style={[styles.dot, { backgroundColor: dotColor }, getSizeStyles(size)]} />
      {showText && (
        <Text style={[styles.text, { color: dotColor }]}>
          {getStatusText()}
        </Text>
      )}
    </View>
  );
};

const getSizeStyles = (size: 'small' | 'medium' | 'large') => {
  switch (size) {
    case 'small':
      return {
        width: 8,
        height: 8,
        borderRadius: 4,
      };
    case 'large':
      return {
        width: 16,
        height: 16,
        borderRadius: 8,
      };
    default: // medium
      return {
        width: 12,
        height: 12,
        borderRadius: 6,
      };
  }
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  loading: {
    backgroundColor: '#D1D5DB',
    opacity: 0.6,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
});

interface OnlineStatusBadgeProps {
  userId: string;
  style?: any;
}

export const OnlineStatusBadge: React.FC<OnlineStatusBadgeProps> = ({
  userId,
  style
}) => {
  const { isOnline, status, formattedLastSeen } = useUserOnlineStatus(userId);

  if (!isOnline) {
    return (
      <View style={[badgeStyles.badge, badgeStyles.offlineBadge, style]}>
        <Text style={badgeStyles.badgeText}>Last seen {formattedLastSeen}</Text>
      </View>
    );
  }

  const getBadgeStyle = () => {
    switch (status?.status) {
      case 'online':
        return badgeStyles.onlineBadge;
      case 'away':
        return badgeStyles.awayBadge;
      case 'busy':
        return badgeStyles.busyBadge;
      default:
        return badgeStyles.offlineBadge;
    }
  };

  const getStatusText = () => {
    switch (status?.status) {
      case 'online':
        return 'Online';
      case 'away':
        return 'Away';
      case 'busy':
        return 'Busy';
      default:
        return 'Offline';
    }
  };

  return (
    <View style={[badgeStyles.badge, getBadgeStyle(), style]}>
      <Text style={badgeStyles.badgeText}>{getStatusText()}</Text>
    </View>
  );
};

const badgeStyles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  onlineBadge: {
    backgroundColor: '#10B981',
  },
  awayBadge: {
    backgroundColor: '#F59E0B',
  },
  busyBadge: {
    backgroundColor: '#EF4444',
  },
  offlineBadge: {
    backgroundColor: '#9CA3AF',
  },
});

// Merge badge styles with main styles
Object.assign(styles, badgeStyles);
