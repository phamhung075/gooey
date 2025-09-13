import { useState, useEffect } from 'react';

const AUTO_SCROLL_KEY = 'claude-auto-scroll-enabled';

/**
 * Custom hook for managing auto-scroll preferences
 * Stores the setting in localStorage and provides methods to toggle it
 */
export const useAutoScroll = () => {
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(AUTO_SCROLL_KEY);
      return saved !== null ? JSON.parse(saved) : true; // Default to enabled
    } catch {
      return true; // Default to enabled if parsing fails
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(AUTO_SCROLL_KEY, JSON.stringify(isAutoScrollEnabled));
    } catch (error) {
      console.warn('Failed to save auto-scroll preference:', error);
    }
  }, [isAutoScrollEnabled]);

  const toggleAutoScroll = () => {
    setIsAutoScrollEnabled(prev => !prev);
  };

  return {
    isAutoScrollEnabled,
    toggleAutoScroll,
    setAutoScrollEnabled: setIsAutoScrollEnabled
  };
};