import { AsyncStorage } from './polyfills';
import { Highlight, Annotation, Document } from '../types';

const HIGHLIGHTS_KEY = 'highlights';
const ANNOTATIONS_KEY = 'annotations';
const DOCUMENTS_KEY = 'documents';

export const StorageService = {
  // Highlights
  async getHighlights(documentId: string): Promise<Highlight[]> {
    try {
      const highlightsJson = await AsyncStorage.getItem(`${HIGHLIGHTS_KEY}_${documentId}`);
      return highlightsJson ? JSON.parse(highlightsJson) : [];
    } catch (error) {
      console.error('Error getting highlights:', error);
      return [];
    }
  },

  async saveHighlight(highlight: Highlight): Promise<void> {
    try {
      const existingHighlights = await this.getHighlights(highlight.documentId);
      const updatedHighlights = [...existingHighlights, highlight];
      await AsyncStorage.setItem(
        `${HIGHLIGHTS_KEY}_${highlight.documentId}`,
        JSON.stringify(updatedHighlights)
      );
    } catch (error) {
      console.error('Error saving highlight:', error);
    }
  },

  async deleteHighlight(documentId: string, highlightId: string): Promise<void> {
    try {
      const existingHighlights = await this.getHighlights(documentId);
      const updatedHighlights = existingHighlights.filter(h => h.id !== highlightId);
      await AsyncStorage.setItem(
        `${HIGHLIGHTS_KEY}_${documentId}`,
        JSON.stringify(updatedHighlights)
      );
    } catch (error) {
      console.error('Error deleting highlight:', error);
    }
  },

  // Annotations
  async getAnnotations(highlightId: string): Promise<Annotation[]> {
    try {
      const annotationsJson = await AsyncStorage.getItem(`${ANNOTATIONS_KEY}_${highlightId}`);
      return annotationsJson ? JSON.parse(annotationsJson) : [];
    } catch (error) {
      console.error('Error getting annotations:', error);
      return [];
    }
  },

  async saveAnnotation(annotation: Annotation): Promise<void> {
    try {
      const existingAnnotations = await this.getAnnotations(annotation.highlightId);
      const updatedAnnotations = [...existingAnnotations, annotation];
      await AsyncStorage.setItem(
        `${ANNOTATIONS_KEY}_${annotation.highlightId}`,
        JSON.stringify(updatedAnnotations)
      );
    } catch (error) {
      console.error('Error saving annotation:', error);
    }
  },

  async updateAnnotation(annotation: Annotation): Promise<void> {
    try {
      const existingAnnotations = await this.getAnnotations(annotation.highlightId);
      const updatedAnnotations = existingAnnotations.map(a => 
        a.id === annotation.id ? annotation : a
      );
      await AsyncStorage.setItem(
        `${ANNOTATIONS_KEY}_${annotation.highlightId}`,
        JSON.stringify(updatedAnnotations)
      );
    } catch (error) {
      console.error('Error updating annotation:', error);
    }
  },

  async deleteAnnotation(highlightId: string, annotationId: string): Promise<void> {
    try {
      const existingAnnotations = await this.getAnnotations(highlightId);
      const updatedAnnotations = existingAnnotations.filter(a => a.id !== annotationId);
      await AsyncStorage.setItem(
        `${ANNOTATIONS_KEY}_${highlightId}`,
        JSON.stringify(updatedAnnotations)
      );
    } catch (error) {
      console.error('Error deleting annotation:', error);
    }
  },

  // Documents
  async getDocuments(): Promise<Document[]> {
    try {
      const documentsJson = await AsyncStorage.getItem(DOCUMENTS_KEY);
      return documentsJson ? JSON.parse(documentsJson) : [];
    } catch (error) {
      console.error('Error getting documents:', error);
      return [];
    }
  },

  async saveDocument(document: Document): Promise<void> {
    try {
      const existingDocuments = await this.getDocuments();
      const updatedDocuments = [...existingDocuments, document];
      await AsyncStorage.setItem(DOCUMENTS_KEY, JSON.stringify(updatedDocuments));
    } catch (error) {
      console.error('Error saving document:', error);
    }
  },

  async updateDocument(document: Document): Promise<void> {
    try {
      const existingDocuments = await this.getDocuments();
      const updatedDocuments = existingDocuments.map(d => 
        d.id === document.id ? document : d
      );
      await AsyncStorage.setItem(DOCUMENTS_KEY, JSON.stringify(updatedDocuments));
    } catch (error) {
      console.error('Error updating document:', error);
    }
  }
};
