import { useMemo, useCallback, useRef, useEffect, useState } from 'react';

// Deep comparison utility for objects and arrays
export const deepEqual = (a: any, b: any): boolean => {
  if (a === b) return true;
  
  if (a == null || b == null) return false;
  
  if (typeof a !== typeof b) return false;
  
  if (typeof a !== 'object') return false;
  
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  
  return true;
};

// Memoization hook with deep comparison
export const useDeepMemo = <T>(factory: () => T, deps: any[]): T => {
  const depsRef = useRef<any[]>([]);
  const valueRef = useRef<T | undefined>(undefined);
  
  if (!deepEqual(deps, depsRef.current)) {
    depsRef.current = deps;
    valueRef.current = factory();
  }
  
  return valueRef.current!;
};

// Stable callback hook that only changes when dependencies change
export const useStableCallback = <T extends (...args: any[]) => any>(
  callback: T,
  deps: any[]
): T => {
  return useCallback(callback, deps);
};

// Debounce hook for expensive operations
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
};

// Throttle hook for frequent operations
export const useThrottle = <T>(value: T, limit: number): T => {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastRan = useRef(Date.now());
  
  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, limit - (Date.now() - lastRan.current));
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, limit]);
  
  return throttledValue;
};

// Intersection observer hook for lazy loading
export const useIntersectionObserver = (
  callback: IntersectionObserverCallback,
  options: IntersectionObserverInit = {}
) => {
  const observerRef = useRef<IntersectionObserver | null>(null);
  
  useEffect(() => {
    observerRef.current = new IntersectionObserver(callback, options);
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [callback, options]);
  
  return observerRef.current;
};

// Performance measurement hook
export const usePerformanceMeasure = (operationName: string) => {
  const startTimeRef = useRef<number | undefined>(undefined);
  
  const startMeasure = useCallback(() => {
    startTimeRef.current = global.performance.now();
  }, []);
  
  const endMeasure = useCallback(() => {
    if (startTimeRef.current) {
      const duration = global.performance.now() - startTimeRef.current;
      console.log(`${operationName} took ${duration.toFixed(2)}ms`);
      startTimeRef.current = undefined;
    }
  }, [operationName]);
  
  return { startMeasure, endMeasure };
};

// Export performance utilities
export const performanceUtils = {
  deepEqual,
  useDeepMemo,
  useStableCallback,
  useDebounce,
  useThrottle,
  useIntersectionObserver,
  usePerformanceMeasure,
};

export default performanceUtils;
