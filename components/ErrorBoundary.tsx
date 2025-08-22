import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} retry={this.handleRetry} />;
      }

      return (
        <View style={styles.errorContainer}>
          <View style={styles.errorContent}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorMessage}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </Text>
            {__DEV__ && this.state.error && (
              <Text style={styles.errorStack}>
                {this.state.error.stack}
              </Text>
            )}
            <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

// Specialized error boundaries for different components
export const DocumentErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={({ error, retry }) => (
      <View style={styles.errorContainer}>
        <View style={styles.errorContent}>
          <Text style={styles.errorIcon}>📄</Text>
          <Text style={styles.errorTitle}>Document Error</Text>
          <Text style={styles.errorMessage}>
            Failed to load or display the document. This might be due to an unsupported format or corrupted file.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={retry}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    )}
    onError={(error) => console.error('Document error:', error)}
  >
    {children}
  </ErrorBoundary>
);

export const EPUBParsingErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={({ error, retry }) => (
      <View style={styles.errorContainer}>
        <View style={styles.errorContent}>
          <Text style={styles.errorIcon}>📚</Text>
          <Text style={styles.errorTitle}>EPUB Parsing Error</Text>
          <Text style={styles.errorMessage}>
            Unable to parse the EPUB file. The file might be corrupted or use an unsupported EPUB format.
          </Text>
          <Text style={styles.suggestion}>
            Try selecting a different EPUB file or check if the file opens in other EPUB readers.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={retry}>
            <Text style={styles.retryButtonText}>Select Different File</Text>
          </TouchableOpacity>
        </View>
      </View>
    )}
    onError={(error) => console.error('EPUB parsing error:', error)}
  >
    {children}
  </ErrorBoundary>
);

export const HighlightErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={({ error, retry }) => (
      <View style={styles.errorContainer}>
        <View style={styles.errorContent}>
          <Text style={styles.errorIcon}>✏️</Text>
          <Text style={styles.errorTitle}>Highlighting Error</Text>
          <Text style={styles.errorMessage}>
            There was an issue with the highlighting system. Your highlights might not display correctly.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={retry}>
            <Text style={styles.retryButtonText}>Refresh View</Text>
          </TouchableOpacity>
        </View>
      </View>
    )}
    onError={(error) => console.error('Highlighting error:', error)}
  >
    {children}
  </ErrorBoundary>
);

export const StorageErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={({ error, retry }) => (
      <View style={styles.errorContainer}>
        <View style={styles.errorContent}>
          <Text style={styles.errorIcon}>💾</Text>
          <Text style={styles.errorTitle}>Storage Error</Text>
          <Text style={styles.errorMessage}>
            Unable to save or load data. This might be due to insufficient storage space or browser restrictions.
          </Text>
          <Text style={styles.suggestion}>
            Check your browser's storage settings and try clearing some space.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={retry}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    )}
    onError={(error) => console.error('Storage error:', error)}
  >
    {children}
  </ErrorBoundary>
);

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorContent: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  suggestion: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  errorStack: {
    fontSize: 12,
    color: '#999',
    textAlign: 'left',
    marginBottom: 16,
    fontFamily: 'monospace',
    backgroundColor: '#f8f8f8',
    padding: 8,
    borderRadius: 4,
    maxHeight: 100,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
