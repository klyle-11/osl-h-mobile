/**
 * Utility functions for handling dates consistently across the app
 */

export const dateUtils = {
  /**
   * Safely convert a date value (Date, string, or undefined) to a Date object
   */
  toDate(value: Date | string | undefined): Date | undefined {
    if (!value) return undefined;
    
    if (value instanceof Date) {
      return value;
    }
    
    if (typeof value === 'string') {
      try {
        const date = new Date(value);
        return isNaN(date.getTime()) ? undefined : date;
      } catch {
        return undefined;
      }
    }
    
    return undefined;
  },

  /**
   * Safely format a date value for display
   */
  formatDate(value: Date | string | undefined, fallback: string = 'Never'): string {
    const date = this.toDate(value);
    if (!date) return fallback;
    
    try {
      return date.toLocaleDateString();
    } catch {
      return fallback;
    }
  },

  /**
   * Format a date with time
   */
  formatDateTime(value: Date | string | undefined, fallback: string = 'Never'): string {
    const date = this.toDate(value);
    if (!date) return fallback;
    
    try {
      return date.toLocaleString();
    } catch {
      return fallback;
    }
  },

  /**
   * Get current date as a proper Date object
   */
  now(): Date {
    return new Date();
  },

  /**
   * Check if a date is valid
   */
  isValidDate(value: any): value is Date {
    return value instanceof Date && !isNaN(value.getTime());
  }
};
