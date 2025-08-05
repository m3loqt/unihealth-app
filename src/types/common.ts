export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface LoadingState {
  loading: boolean;
  error: string | null;
}

export interface ModalState {
  visible: boolean;
  data?: any;
}

export interface FormState {
  isValid: boolean;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
}

export interface FilterState {
  activeFilter: string;
  filters: string[];
}

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

export interface SearchState {
  query: string;
  results: any[];
  searching: boolean;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: boolean;
  biometricEnabled: boolean;
} 