import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ErrorBoundary } from './ErrorBoundary';

// Test component that can trigger errors
const ErrorTriggerComponent = () => {
  const [shouldError, setShouldError] = useState(false);

  if (shouldError) {
    // This will trigger an error
    throw new Error('Test error triggered by user action');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Error Boundary Test</Text>
      <Text style={styles.description}>
        This component can trigger errors to test the error boundary functionality.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setShouldError(true)}
      >
        <Text style={styles.buttonText}>Trigger Error</Text>
      </TouchableOpacity>
    </View>
  );
};

// Test component wrapped with error boundary
export const ErrorBoundaryTest = () => {
  return (
    <ErrorBoundary>
      <ErrorTriggerComponent />
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#ff4444',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
