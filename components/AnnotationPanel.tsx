import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Highlight, Annotation, TextSelection } from '../types';
import { dateUtils } from '../utils/dateUtils';
import { ErrorBoundary } from './ErrorBoundary';

type Props = {
    isVisible: boolean;
    onClose: () => void;
    selectedText?: TextSelection;
    selectedHighlight?: Highlight;
    existingAnnotations?: Annotation[];
    onSaveHighlight: (highlight: Highlight) => void;
    onSaveAnnotation: (annotation: Annotation) => void;
    onDeleteHighlight?: (highlightId: string) => void;
    onDeleteAnnotation?: (annotationId: string) => void;
};

export const AnnotationPanel = ({ 
    isVisible, 
    onClose, 
    selectedText,
    selectedHighlight,
    existingAnnotations = [],
    onSaveHighlight,
    onSaveAnnotation,
    onDeleteHighlight,
    onDeleteAnnotation
}: Props) => {
    const [comment, setComment] = useState<string>('');
    const [isAddingNote, setIsAddingNote] = useState(false);

    useEffect(() => {
        if (isVisible && selectedText) {
            setIsAddingNote(true);
        } else {
            setIsAddingNote(false);
        }
        setComment('');
    }, [isVisible, selectedText]);

    const handleSaveHighlight = () => {
        if (!selectedText) return;
        
        const highlightId = `highlight_${Date.now()}`;
        const newHighlight: Highlight = {
            id: highlightId,
            text: selectedText.text,
            startIndex: selectedText.startIndex,
            endIndex: selectedText.endIndex,
            documentId: 'current_document',
            createdAt: dateUtils.now(),
            color: 'yellow',
            cfi: selectedText.cfi
        };
        
        onSaveHighlight(newHighlight);
        
        if (comment.trim()) {
            const annotation: Annotation = {
                id: `annotation_${Date.now()}`,
                highlightId: highlightId,
                content: comment.trim(),
                text: comment.trim(), // For backward compatibility
                createdAt: dateUtils.now(),
                lastModified: dateUtils.now()
            };
            onSaveAnnotation(annotation);
        }
        
        setComment('');
        onClose();
    };

    const handleSaveAnnotation = () => {
        if (!selectedHighlight || !comment.trim()) return;
        
        const annotation: Annotation = {
            id: `annotation_${Date.now()}`,
            highlightId: selectedHighlight.id,
            content: comment.trim(),
            text: comment.trim(), // For backward compatibility
            createdAt: dateUtils.now(),
            lastModified: dateUtils.now()
        };
        
        onSaveAnnotation(annotation);
        setComment('');
        setIsAddingNote(false);
    };

    const handleDeleteHighlight = () => {
        if (!selectedHighlight) return;
        
        if (confirm('Are you sure you want to delete this highlight and all its annotations?')) {
            onDeleteHighlight?.(selectedHighlight.id);
            onClose();
        }
    };

    const handleDeleteAnnotation = (annotationId: string) => {
        if (confirm('Are you sure you want to delete this annotation?')) {
            onDeleteAnnotation?.(annotationId);
        }
    };

    if (!isVisible) return null;

    return (
        <ErrorBoundary
            fallback={({ error, retry }) => (
                <View style={styles.overlay}>
                    <View style={styles.panel}>
                        <View style={styles.header}>
                            <Text style={styles.headerTitle}>Annotation Error</Text>
                            <TouchableOpacity onPress={onClose}>
                                <Text style={styles.closeButton}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.content}>
                            <Text style={styles.errorText}>
                                Failed to load annotation panel. Please try again.
                            </Text>
                            <TouchableOpacity onPress={retry} style={styles.primaryButton}>
                                <Text style={styles.primaryButtonText}>Try Again</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
        >
            <View style={styles.overlay}>
                <View style={styles.panel}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>
                            {selectedText ? 'New Highlight' : 'Highlight Details'}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Text style={styles.closeButton}>✕</Text>
                        </TouchableOpacity>
                    </View>

                <ScrollView style={styles.content}>
                    {selectedText && (
                        <View style={styles.selectedTextContainer}>
                            <Text style={styles.selectedTextLabel}>Selected Text:</Text>
                            <Text style={styles.selectedText}>"{selectedText.text}"</Text>
                        </View>
                    )}

                    {selectedHighlight && (
                        <View style={styles.selectedTextContainer}>
                            <Text style={styles.selectedTextLabel}>Highlighted Text:</Text>
                            <Text style={styles.selectedText}>"{selectedHighlight.text}"</Text>
                        </View>
                    )}

                    {existingAnnotations.length > 0 && (
                        <View style={styles.annotationsContainer}>
                            <Text style={styles.annotationsLabel}>Annotations:</Text>
                            {existingAnnotations.map((annotation) => (
                                <View key={annotation.id} style={styles.annotationItem}>
                                    <Text style={styles.annotationText}>{annotation.text}</Text>
                                    <TouchableOpacity 
                                        onPress={() => handleDeleteAnnotation(annotation.id)}
                                        style={styles.deleteButton}
                                    >
                                        <Text style={styles.deleteButtonText}>Delete</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}

                    {(selectedText || selectedHighlight) && (
                        <View style={styles.noteSection}>
                            {!isAddingNote ? (
                                <TouchableOpacity 
                                    onPress={() => setIsAddingNote(true)}
                                    style={styles.addNoteButton}
                                >
                                    <Text style={styles.addNoteButtonText}>+ Add Note</Text>
                                </TouchableOpacity>
                            ) : (
                                <>
                                    <TextInput
                                        value={comment}
                                        onChangeText={setComment}
                                        placeholder="Add your note here..."
                                        style={styles.input}
                                        multiline
                                        numberOfLines={4}
                                    />
                                    <View style={styles.noteActions}>
                                        <TouchableOpacity 
                                            onPress={() => setIsAddingNote(false)}
                                            style={styles.cancelButton}
                                        >
                                            <Text style={styles.cancelButtonText}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            onPress={selectedText ? handleSaveHighlight : handleSaveAnnotation}
                                            style={styles.saveButton}
                                        >
                                            <Text style={styles.saveButtonText}>
                                                {selectedText ? 'Save Highlight' : 'Save Note'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </View>
                    )}
                </ScrollView>

                <View style={styles.footer}>
                    {selectedHighlight && onDeleteHighlight && (
                        <TouchableOpacity 
                            onPress={handleDeleteHighlight}
                            style={styles.dangerButton}
                        >
                            <Text style={styles.dangerButtonText}>Delete Highlight</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
        </ErrorBoundary>
    );
};

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
        zIndex: 1000,
    },
    panel: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '70%',
        minHeight: '30%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    closeButton: {
        fontSize: 18,
        color: '#666',
        padding: 4,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    selectedTextContainer: {
        marginBottom: 16,
    },
    selectedTextLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
    },
    selectedText: {
        fontSize: 16,
        color: '#333',
        fontStyle: 'italic',
        backgroundColor: '#f9f9f9',
        padding: 12,
        borderRadius: 8,
    },
    annotationsContainer: {
        marginBottom: 16,
    },
    annotationsLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
    },
    annotationItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    annotationText: {
        flex: 1,
        fontSize: 14,
        color: '#333',
    },
    deleteButton: {
        backgroundColor: '#ff4444',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
    },
    deleteButtonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    noteSection: {
        marginBottom: 16,
    },
    addNoteButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    addNoteButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 12,
        minHeight: 100,
    },
    noteActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    cancelButton: {
        backgroundColor: '#f0f0f0',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        flex: 1,
        marginRight: 8,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        flex: 1,
        marginLeft: 8,
        alignItems: 'center',
    },
    saveButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    primaryButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 8,
    },
    primaryButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    dangerButton: {
        backgroundColor: '#ff4444',
        paddingVertical: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    dangerButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    errorText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginVertical: 20,
        paddingHorizontal: 16,
    },
});