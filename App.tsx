import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { DocumentPicker } from './components/DocumentPicker';
import { DocumentViewer } from './components/DocumentViewer';
import { AnnotationPanel } from './components/AnnotationPanel';
import { reactiveStorageService } from './utils/reactiveStorageService';
import { Document, Highlight, Annotation, TextSelection } from './types';
import { Subscription } from 'rxjs';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedText, setSelectedText] = useState<TextSelection | null>(null);
  const [selectedHighlight, setSelectedHighlight] = useState<Highlight | null>(null);
  const [annotationPanelVisible, setAnnotationPanelVisible] = useState(false);
  const [currentAnnotations, setCurrentAnnotations] = useState<Annotation[]>([]);
  const subscriptionsRef = useRef<Subscription[]>([]);

  useEffect(() => {
    // Initialize storage and subscribe to changes
    const initSubscription = reactiveStorageService.initialize().subscribe();
    subscriptionsRef.current.push(initSubscription);

    // Subscribe to highlights changes
    const highlightsSubscription = reactiveStorageService.highlights$.subscribe({
      next: (allHighlights) => {
        console.log('All highlights received:', allHighlights);
        if (currentDocument) {
          const documentHighlights = allHighlights.filter(h => h.documentId === currentDocument.id);
          console.log('Document highlights for', currentDocument.id, ':', documentHighlights);
          setHighlights(documentHighlights);
        }
      }
    });
    subscriptionsRef.current.push(highlightsSubscription);

    // Subscribe to annotations changes
    const annotationsSubscription = reactiveStorageService.annotations$.subscribe({
      next: (allAnnotations) => setAnnotations(allAnnotations)
    });
    subscriptionsRef.current.push(annotationsSubscription);

    return () => {
      // Clean up subscriptions
      subscriptionsRef.current.forEach(sub => sub.unsubscribe());
      subscriptionsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (currentDocument) {
      loadDocumentData();
    }
  }, [currentDocument]);

  const loadDocumentData = () => {
    if (!currentDocument) return;
    
    // The reactive subscriptions will automatically update the state
    // when highlights and annotations change
  };

  const handleDocumentSelect = (document: Document) => {
    setCurrentDocument(document);
  };

  const handleBackToDocuments = () => {
    setCurrentDocument(null);
    setSelectedText(null);
    setSelectedHighlight(null);
    setAnnotationPanelVisible(false);
  };

  const handleTextSelection = (selection: TextSelection) => {
    setSelectedText(selection);
    setSelectedHighlight(null);
    setCurrentAnnotations([]);
    setAnnotationPanelVisible(true);
  };

  const handleHighlightPress = (highlight: Highlight) => {
    setSelectedHighlight(highlight);
    setSelectedText(null);
    
    // Load annotations for this highlight from the current annotations state
    const highlightAnnotations = annotations.filter(a => a.highlightId === highlight.id);
    setCurrentAnnotations(highlightAnnotations);
    setAnnotationPanelVisible(true);
  };

  const handleSaveHighlight = (highlight: Highlight) => {
    if (!currentDocument) return;
    
    const highlightWithDocId = {
      ...highlight,
      documentId: currentDocument.id
    };
    
    const saveSubscription = reactiveStorageService.saveHighlight(highlightWithDocId).subscribe({
      next: () => {
        setSelectedText(null);
      },
      error: (error) => {
        console.error('Error saving highlight:', error);
      }
    });
    subscriptionsRef.current.push(saveSubscription);
  };

  const handleSaveAnnotation = (annotation: Annotation) => {
    const saveSubscription = reactiveStorageService.saveAnnotation(annotation).subscribe({
      next: (savedAnnotation) => {
        // If we're viewing annotations for a specific highlight, update the current list
        if (selectedHighlight && annotation.highlightId === selectedHighlight.id) {
          const updatedAnnotations = annotations.filter(a => a.highlightId === selectedHighlight.id);
          setCurrentAnnotations(updatedAnnotations);
        }
      },
      error: (error) => {
        console.error('Error saving annotation:', error);
      }
    });
    subscriptionsRef.current.push(saveSubscription);
  };

  const handleDeleteHighlight = (highlightId: string) => {
    if (!currentDocument) return;
    
    const deleteSubscription = reactiveStorageService.deleteHighlight(highlightId).subscribe({
      next: () => {
        // Clear annotation panel
        setAnnotationPanelVisible(false);
        setSelectedHighlight(null);
      },
      error: (error) => {
        console.error('Error deleting highlight:', error);
      }
    });
    subscriptionsRef.current.push(deleteSubscription);
  };

  const handleDeleteAnnotation = (annotationId: string) => {
    if (!selectedHighlight) return;
    
    const deleteSubscription = reactiveStorageService.deleteAnnotation(annotationId).subscribe({
      next: () => {
        const updatedAnnotations = annotations.filter(a => a.highlightId === selectedHighlight.id);
        setCurrentAnnotations(updatedAnnotations);
      },
      error: (error) => {
        console.error('Error deleting annotation:', error);
      }
    });
    subscriptionsRef.current.push(deleteSubscription);
  };

  const handleCloseAnnotationPanel = () => {
    setAnnotationPanelVisible(false);
    setSelectedText(null);
    setSelectedHighlight(null);
    setCurrentAnnotations([]);
  };

  return (
    <ErrorBoundary
      fallback={({ error, retry }) => (
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>App Error</Text>
            <Text style={styles.errorMessage}>
              Something went wrong with the document viewer app.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={retry}>
              <Text style={styles.retryButtonText}>Restart App</Text>
            </TouchableOpacity>
          </View>
          <StatusBar style="auto" />
        </View>
      )}
    >
      <View style={styles.container}>
        {!currentDocument ? (
          <DocumentPicker onDocumentSelect={handleDocumentSelect} />
        ) : (
          <View style={styles.documentContainer}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={handleBackToDocuments}>
                <Text style={styles.backButtonText}>← Back to Documents</Text>
              </TouchableOpacity>
            </View>
            
            <DocumentViewer
              document={currentDocument}
              highlights={highlights}
              onTextSelection={handleTextSelection}
              onHighlightPress={handleHighlightPress}
            />
            
            <AnnotationPanel
              isVisible={annotationPanelVisible}
              onClose={handleCloseAnnotationPanel}
              selectedText={selectedText || undefined}
              selectedHighlight={selectedHighlight || undefined}
              existingAnnotations={currentAnnotations}
              onSaveHighlight={handleSaveHighlight}
              onSaveAnnotation={handleSaveAnnotation}
              onDeleteHighlight={handleDeleteHighlight}
              onDeleteAnnotation={handleDeleteAnnotation}
            />
          </View>
        )}
        
        <StatusBar style="auto" />
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    minHeight: '100%',
  },
  documentContainer: {
    flex: 1,
  },
  header: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
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
