import { v4 as uuidv4 } from 'uuid';

// Web localStorage implementation
export const AsyncStorage = {
  setItem: async (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('Error setting item in localStorage:', error);
    }
  },
  
  getItem: async (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('Error getting item from localStorage:', error);
      return null;
    }
  },
  
  removeItem: async (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing item from localStorage:', error);
    }
  }
};

export { uuidv4 };
