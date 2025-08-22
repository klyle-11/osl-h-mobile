import { Observable, from, map, tap, catchError, of, BehaviorSubject, distinctUntilChanged } from 'rxjs';
import { Document, Highlight, Annotation } from '../types';

interface StorageState {
    documents: Document[];
    highlights: Highlight[];
    annotations: Annotation[];
    isLoading: boolean;
}

class ReactiveStorageService {
    private storageState = new BehaviorSubject<StorageState>({
        documents: [],
        highlights: [],
        annotations: [],
        isLoading: false
    });

    // Public observables
    public documents$ = this.storageState.pipe(
        map(state => state.documents),
        distinctUntilChanged()
    );

    public highlights$ = this.storageState.pipe(
        map(state => state.highlights),
        distinctUntilChanged()
    );

    public annotations$ = this.storageState.pipe(
        map(state => state.annotations),
        distinctUntilChanged()
    );

    public isLoading$ = this.storageState.pipe(
        map(state => state.isLoading),
        distinctUntilChanged()
    );

    // Document operations
    getDocuments(): Observable<Document[]> {
        return from(this.loadFromStorage<Document[]>('documents', [])).pipe(
            tap(documents => this.updateState({ documents })),
            catchError(error => {
                console.error('Error loading documents:', error);
                return of([]);
            })
        );
    }

    saveDocument(document: Document): Observable<Document> {
        const currentState = this.storageState.value;
        const existingIndex = currentState.documents.findIndex(doc => doc.id === document.id);
        
        let updatedDocuments: Document[];
        if (existingIndex >= 0) {
            updatedDocuments = [...currentState.documents];
            updatedDocuments[existingIndex] = document;
        } else {
            updatedDocuments = [...currentState.documents, document];
        }

        return from(this.saveToStorage('documents', updatedDocuments)).pipe(
            map(() => {
                this.updateState({ documents: updatedDocuments });
                return document;
            }),
            catchError(error => {
                console.error('Error saving document:', error);
                throw error;
            })
        );
    }

    updateDocument(document: Document): Observable<Document> {
        return this.saveDocument(document);
    }

    deleteDocument(documentId: string): Observable<void> {
        const currentState = this.storageState.value;
        const updatedDocuments = currentState.documents.filter(doc => doc.id !== documentId);

        return from(this.saveToStorage('documents', updatedDocuments)).pipe(
            map(() => {
                this.updateState({ documents: updatedDocuments });
            }),
            catchError(error => {
                console.error('Error deleting document:', error);
                throw error;
            })
        );
    }

    // Highlight operations
    getHighlights(documentId?: string): Observable<Highlight[]> {
        return from(this.loadFromStorage<Highlight[]>('highlights', [])).pipe(
            map(highlights => documentId ? highlights.filter(h => h.documentId === documentId) : highlights),
            tap(highlights => this.updateState({ highlights: this.storageState.value.highlights })),
            catchError(error => {
                console.error('Error loading highlights:', error);
                return of([]);
            })
        );
    }

    saveHighlight(highlight: Highlight): Observable<Highlight> {
        const currentState = this.storageState.value;
        const existingIndex = currentState.highlights.findIndex(h => h.id === highlight.id);
        
        let updatedHighlights: Highlight[];
        if (existingIndex >= 0) {
            updatedHighlights = [...currentState.highlights];
            updatedHighlights[existingIndex] = highlight;
        } else {
            updatedHighlights = [...currentState.highlights, highlight];
        }

        return from(this.saveToStorage('highlights', updatedHighlights)).pipe(
            map(() => {
                this.updateState({ highlights: updatedHighlights });
                return highlight;
            }),
            catchError(error => {
                console.error('Error saving highlight:', error);
                throw error;
            })
        );
    }

    deleteHighlight(highlightId: string): Observable<void> {
        const currentState = this.storageState.value;
        const updatedHighlights = currentState.highlights.filter(h => h.id !== highlightId);
        
        // Also remove associated annotations
        const updatedAnnotations = currentState.annotations.filter(a => a.highlightId !== highlightId);

        return from(Promise.all([
            this.saveToStorage('highlights', updatedHighlights),
            this.saveToStorage('annotations', updatedAnnotations)
        ])).pipe(
            map(() => {
                this.updateState({ 
                    highlights: updatedHighlights,
                    annotations: updatedAnnotations
                });
            }),
            catchError(error => {
                console.error('Error deleting highlight:', error);
                throw error;
            })
        );
    }

    // Annotation operations
    getAnnotations(highlightId?: string): Observable<Annotation[]> {
        return from(this.loadFromStorage<Annotation[]>('annotations', [])).pipe(
            map(annotations => highlightId ? annotations.filter(a => a.highlightId === highlightId) : annotations),
            tap(annotations => this.updateState({ annotations: this.storageState.value.annotations })),
            catchError(error => {
                console.error('Error loading annotations:', error);
                return of([]);
            })
        );
    }

    saveAnnotation(annotation: Annotation): Observable<Annotation> {
        const currentState = this.storageState.value;
        const existingIndex = currentState.annotations.findIndex(a => a.id === annotation.id);
        
        let updatedAnnotations: Annotation[];
        if (existingIndex >= 0) {
            updatedAnnotations = [...currentState.annotations];
            updatedAnnotations[existingIndex] = annotation;
        } else {
            updatedAnnotations = [...currentState.annotations, annotation];
        }

        return from(this.saveToStorage('annotations', updatedAnnotations)).pipe(
            map(() => {
                this.updateState({ annotations: updatedAnnotations });
                return annotation;
            }),
            catchError(error => {
                console.error('Error saving annotation:', error);
                throw error;
            })
        );
    }

    deleteAnnotation(annotationId: string): Observable<void> {
        const currentState = this.storageState.value;
        const updatedAnnotations = currentState.annotations.filter(a => a.id !== annotationId);

        return from(this.saveToStorage('annotations', updatedAnnotations)).pipe(
            map(() => {
                this.updateState({ annotations: updatedAnnotations });
            }),
            catchError(error => {
                console.error('Error deleting annotation:', error);
                throw error;
            })
        );
    }

    // Initialize - load all data
    initialize(): Observable<StorageState> {
        this.updateState({ isLoading: true });
        
        return from(Promise.all([
            this.loadFromStorage<Document[]>('documents', []),
            this.loadFromStorage<Highlight[]>('highlights', []),
            this.loadFromStorage<Annotation[]>('annotations', [])
        ])).pipe(
            map(([documents, highlights, annotations]) => {
                const state = { documents, highlights, annotations, isLoading: false };
                this.updateState(state);
                return state;
            }),
            catchError(error => {
                console.error('Error initializing storage:', error);
                const errorState = { documents: [], highlights: [], annotations: [], isLoading: false };
                this.updateState(errorState);
                return of(errorState);
            })
        );
    }

    private updateState(partialState: Partial<StorageState>): void {
        const currentState = this.storageState.value;
        this.storageState.next({ ...currentState, ...partialState });
    }

    private async loadFromStorage<T>(key: string, defaultValue: T): Promise<T> {
        try {
            const item = localStorage.getItem(key);
            if (!item) return defaultValue;
            
            // Custom deserializer to handle Date strings
            const parsed = JSON.parse(item, (key, value) => {
                // Check if the value looks like a date string
                if (typeof value === 'string' && 
                    (key === 'createdAt' || key === 'lastModified' || key === 'lastOpened') &&
                    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
                    return new Date(value);
                }
                return value;
            });
            
            return parsed;
        } catch (error) {
            console.error(`Error loading ${key} from storage:`, error);
            return defaultValue;
        }
    }

    private async saveToStorage<T>(key: string, value: T): Promise<void> {
        try {
            // Custom serializer to handle Date objects
            const serializedValue = JSON.stringify(value, (key, val) => {
                if (val instanceof Date) {
                    return val.toISOString();
                }
                return val;
            });
            localStorage.setItem(key, serializedValue);
        } catch (error) {
            console.error(`Error saving ${key} to storage:`, error);
            throw error;
        }
    }
}

export const reactiveStorageService = new ReactiveStorageService();
