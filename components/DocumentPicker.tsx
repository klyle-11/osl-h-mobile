import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native';
import { pickFile } from '../utils/pickFile';
import { reactiveStorageService } from '../utils/reactiveStorageService';
import { fileHandlerService } from '../utils/fileHandlerService';
import { dateUtils } from '../utils/dateUtils';
import { Document } from '../types';
import { Subscription } from 'rxjs';
import { StorageErrorBoundary } from './ErrorBoundary';

type Props = {
    onDocumentSelect: (document: Document) => void;
};

export const DocumentPicker = ({ onDocumentSelect }: Props) => {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const subscriptionsRef = useRef<Subscription[]>([]);

    useEffect(() => {
        loadDocuments();
        return () => {
            // Clean up subscriptions
            subscriptionsRef.current.forEach(sub => sub.unsubscribe());
            subscriptionsRef.current = [];
        };
    }, []);

    const loadDocuments = () => {
        const documentsSubscription = reactiveStorageService.documents$.subscribe({
            next: (documents) => setDocuments(documents),
            error: (error) => console.error('Error loading documents:', error)
        });
        subscriptionsRef.current.push(documentsSubscription);
        
        // Initialize storage
        reactiveStorageService.initialize().subscribe();
    };

    const handlePickDocument = () => {
        setIsLoading(true);
        
        // Subscribe to upload progress
        const progressSubscription = fileHandlerService.uploadProgress$.subscribe({
            next: (progress) => {
                console.log('File upload progress:', progress);
            }
        });
        subscriptionsRef.current.push(progressSubscription);
        
        const filePickSubscription = fileHandlerService.pickFile().subscribe({
            next: (result) => {
                let documentType: 'pdf' | 'epub' | 'text' = 'text';
                
                if (result.type.includes('pdf')) {
                    documentType = 'pdf';
                } else if (result.type.includes('epub') || result.name.endsWith('.epub')) {
                    documentType = 'epub';
                } else if (result.type.includes('text') || result.name.endsWith('.txt')) {
                    documentType = 'text';
                }
                
                const newDocument: Document = {
                    id: `doc_${Date.now()}`,
                    title: result.name || 'Unknown Document',
                    name: result.name || 'Unknown Document',
                    path: result.uri,
                    content: '',
                    type: documentType,
                    createdAt: dateUtils.now(),
                    lastModified: dateUtils.now(),
                    lastOpened: dateUtils.now()
                };

                const saveSubscription = reactiveStorageService.saveDocument(newDocument).subscribe({
                    next: (savedDocument) => {
                        onDocumentSelect(savedDocument);
                        setIsLoading(false);
                    },
                    error: (error) => {
                        console.error('Error saving document:', error);
                        Alert.alert('Error', 'Failed to save document');
                        setIsLoading(false);
                    }
                });
                subscriptionsRef.current.push(saveSubscription);
            },
            error: (error) => {
                console.error('Error picking file:', error);
                Alert.alert('Error', 'Failed to pick file');
                setIsLoading(false);
            }
        });
        subscriptionsRef.current.push(filePickSubscription);
    };

    const handleAddSampleDocument = () => {
        const sampleDocument: Document = {
            id: `sample_${Date.now()}`,
            title: 'Sample Text Document',
            name: 'Sample Text Document',
            path: 'sample://text',
            content: '', // Will be loaded when viewing
            type: 'text',
            createdAt: dateUtils.now(),
            lastModified: dateUtils.now(),
            lastOpened: dateUtils.now()
        };

        const saveSubscription = reactiveStorageService.saveDocument(sampleDocument).subscribe({
            next: (savedDocument) => {
                onDocumentSelect(savedDocument);
            },
            error: (error) => {
                console.error('Error saving sample document:', error);
                Alert.alert('Error', 'Failed to create sample document');
            }
        });
        subscriptionsRef.current.push(saveSubscription);
    };

    const handleDocumentPress = (document: Document) => {
        // Update last opened timestamp
        const updatedDocument = {
            ...document,
            lastOpened: dateUtils.now(),
            lastModified: dateUtils.now()
        };
        
        const updateSubscription = reactiveStorageService.updateDocument(updatedDocument).subscribe({
            next: (updated) => {
                onDocumentSelect(updated);
            },
            error: (error) => {
                console.error('Error updating document:', error);
                // Still allow selection even if update fails
                onDocumentSelect(document);
            }
        });
        subscriptionsRef.current.push(updateSubscription);
    };

    const renderDocument = ({ item }: { item: Document }) => {
        return (
            <TouchableOpacity
                style={styles.documentItem}
                onPress={() => handleDocumentPress(item)}
            >
                <View style={styles.documentInfo}>
                    <Text style={styles.documentName}>{item.name}</Text>
                    <Text style={styles.documentType}>{item.type.toUpperCase()}</Text>
                    <Text style={styles.documentDate}>
                        Last opened: {dateUtils.formatDate(item.lastOpened)}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <StorageErrorBoundary>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Documents</Text>
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.addButton, styles.sampleButton]}
                            onPress={handleAddSampleDocument}
                        >
                            <Text style={styles.addButtonText}>📄 Sample</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={handlePickDocument}
                            disabled={isLoading}
                        >
                            <Text style={styles.addButtonText}>
                                {isLoading ? 'Adding...' : '+ Add Document'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {documents.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>
                            No documents yet. Add your first PDF or EPUB!
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={documents}
                        renderItem={renderDocument}
                        keyExtractor={(item) => item.id}
                        style={styles.documentList}
                    />
                )}
            </View>
        </StorageErrorBoundary>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    addButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    sampleButton: {
        backgroundColor: '#34C759',
    },
    addButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    documentList: {
        flex: 1,
        padding: 16,
    },
    documentItem: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    documentInfo: {
        flex: 1,
    },
    documentName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    documentType: {
        fontSize: 14,
        color: '#007AFF',
        fontWeight: '500',
        marginBottom: 4,
    },
    documentDate: {
        fontSize: 12,
        color: '#666',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyStateText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
    },
});
