import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { HighlightableText } from './HighlightableText';
import { PDFViewer } from './PDFViewer';
import { Highlight, TextSelection, Document } from '../types';
import { enhancedEpubParser, EnhancedEPUBContent, EPUBElement, EPUBChapter } from '../utils/enhancedEpubParser';
import { Subscription } from 'rxjs';
import { DocumentErrorBoundary, EPUBParsingErrorBoundary } from './ErrorBoundary';

// Helper functions for content conversion
const convertEnhancedContentToText = (content: EnhancedEPUBContent): string => {
    let text = '';
    
    content.chapters.forEach((chapter, chapterIndex) => {
        // Add chapter title
        if (chapter.title) {
            text += `${chapter.title}\n\n`;
        }
        
        // Add page break marker if needed
        if (chapter.pageBreakBefore) {
            text += '[PAGE BREAK]\n\n';
        }
        
        // Convert chapter content
        text += convertElementsToText(chapter.content);
        
        // Add spacing between chapters
        if (chapterIndex < content.chapters.length - 1) {
            text += '\n\n';
        }
        
        // Add page break marker if needed
        if (chapter.pageBreakAfter) {
            text += '\n[PAGE BREAK]\n';
        }
    });
    
    return text;
};

const convertElementsToText = (elements: EPUBElement[]): string => {
    return elements.map(element => {
        if (typeof element.content === 'string') {
            switch (element.type) {
                case 'heading':
                    const headingPrefix = '#'.repeat(element.level || 1);
                    return `${headingPrefix} ${element.content}\n\n`;
                case 'paragraph':
                    return `${element.content}\n\n`;
                case 'blockquote':
                    return `> ${element.content}\n\n`;
                case 'list-item':
                    return `• ${element.content}\n`;
                case 'page-break':
                    return '[PAGE BREAK]\n';
                case 'footnote':
                    return `[Footnote: ${element.content}]\n`;
                default:
                    return `${element.content}\n\n`;
            }
        } else if (Array.isArray(element.content)) {
            return convertElementsToText(element.content);
        }
        return '';
    }).join('');
};

type Props = {
    document: Document;
    highlights: Highlight[];
    onTextSelection: (selection: TextSelection) => void;
    onHighlightPress: (highlight: Highlight) => void;
}

export const EnhancedDocumentViewer = ({ document, highlights, onTextSelection, onHighlightPress }: Props) => {
    const [documentContent, setDocumentContent] = useState<string>('');
    const [enhancedContent, setEnhancedContent] = useState<EnhancedEPUBContent | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState('Loading document...');
    const [parseProgress, setParseProgress] = useState(0);
    const subscriptionsRef = useRef<Subscription[]>([]);

    useEffect(() => {
        loadDocument();
        return () => {
            subscriptionsRef.current.forEach(sub => sub.unsubscribe());
            subscriptionsRef.current = [];
        };
    }, [document]);

    const loadDocument = () => {
        try {
            setIsLoading(true);
            setParseProgress(0);
            setEnhancedContent(null);
            
            if (document.type === 'pdf') {
                setIsLoading(false);
                return;
            }

            if (document.path === 'sample://text') {
                const sampleText = `# Chapter 1: Introduction

This is a sample document for testing the highlighting and annotation features of the web app.

Here is some text that can be highlighted and annotated. You can click on individual words or phrases to create highlights.

# Chapter 2: Text Selection

When you click on a word, it will be selected. When you click on another word, it will create a selection range that can be saved as a highlight.

Once text is highlighted, you can click on the highlighted text to add annotations and comments.

# Chapter 3: Persistence

This system allows for persistent storage of highlights and annotations that will be saved across browser sessions using localStorage.

The app supports both PDF and EPUB documents with enhanced formatting preservation.`;
                setDocumentContent(sampleText);
                setIsLoading(false);
                return;
            }

            // Handle EPUB files
            if (document.type === 'epub' && 
                (document.path?.startsWith('data:application/epub+zip') || 
                 document.path?.startsWith('data:application/octet-stream') ||
                 document.name?.endsWith('.epub'))) {
                
                try {
                    setLoadingMessage('Reading EPUB file...');
                    
                    const base64Data = document.path!.split(',')[1];
                    if (!base64Data) {
                        throw new Error('Invalid data URL format');
                    }
                    
                    const binaryString = atob(base64Data);
                    const arrayBuffer = new ArrayBuffer(binaryString.length);
                    const uint8Array = new Uint8Array(arrayBuffer);
                    for (let i = 0; i < binaryString.length; i++) {
                        uint8Array[i] = binaryString.charCodeAt(i);
                    }
                    
                    const progressSubscription = enhancedEpubParser.progress$.subscribe({
                        next: (progress) => {
                            setParseProgress(progress.progress);
                            setLoadingMessage(progress.message);
                        },
                        error: (error) => {
                            console.error('Progress tracking error:', error);
                        }
                    });
                    subscriptionsRef.current.push(progressSubscription);
                    
                    const parseSubscription = enhancedEpubParser.parseEPUB(arrayBuffer).subscribe({
                        next: (result) => {
                            console.log('Enhanced EPUB parsing successful', result);
                            setEnhancedContent(result);
                            const plainText = convertEnhancedContentToText(result);
                            setDocumentContent(plainText);
                            setIsLoading(false);
                        },
                        error: (error) => {
                            console.error('Error parsing EPUB:', error);
                            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                            setDocumentContent(`Error loading EPUB file: ${errorMessage}\n\nPlease ensure this is a valid EPUB file and try again.`);
                            setIsLoading(false);
                        }
                    });
                    
                    subscriptionsRef.current.push(parseSubscription);
                    return;
                } catch (error) {
                    console.error('Error parsing EPUB:', error);
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                    setDocumentContent(`Error loading EPUB file: ${errorMessage}\n\nPlease ensure this is a valid EPUB file and try again.`);
                    setIsLoading(false);
                    return;
                }
            }

            // Handle other document types
            if (document.path?.startsWith('data:text/')) {
                const base64Data = document.path.split(',')[1];
                if (base64Data) {
                    setDocumentContent(atob(base64Data));
                } else {
                    setDocumentContent(document.path);
                }
                setIsLoading(false);
                return;
            }

            if (document.content) {
                setDocumentContent(document.content);
                setIsLoading(false);
                return;
            }

            // Default fallback
            const sampleText = `This is a sample document for testing the highlighting and annotation features of the web app.

Here is some text that can be highlighted and annotated. You can click on individual words or phrases to create highlights.`;
            setDocumentContent(sampleText);
            setIsLoading(false);
        } catch (error) {
            console.error('Error loading document:', error);
            setDocumentContent('Error loading document. Please try again.');
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>{loadingMessage}</Text>
                {parseProgress > 0 && (
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: `${parseProgress}%` }]} />
                        </View>
                        <Text style={styles.progressText}>{parseProgress}%</Text>
                    </View>
                )}
                <Text style={styles.loadingSubtext}>
                    {document.name?.endsWith('.epub') ? 'Preserving original formatting and structure...' : 'Please wait...'}
                </Text>
            </View>
        );
    }

    if (document.type === 'pdf') {
        return (
            <PDFViewer 
                documentPath={document.path || ''}
                highlights={highlights}
                onTextSelection={onTextSelection}
                onHighlightPress={onHighlightPress}
            />
        );
    }

    return (
        <DocumentErrorBoundary>
            <View style={styles.container}>
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    <HighlightableText 
                        text={documentContent}
                        highlights={highlights}
                        onTextSelection={onTextSelection}
                        onHighlightPress={onHighlightPress}
                    />
                </ScrollView>
            </View>
        </DocumentErrorBoundary>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
        minHeight: '100%',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 80,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        minHeight: 200,
        padding: 20,
    },
    loadingText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
        textAlign: 'center',
    },
    loadingSubtext: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 20,
    },
    progressContainer: {
        width: '100%',
        maxWidth: 300,
        marginVertical: 16,
    },
    progressBar: {
        height: 8,
        backgroundColor: '#e0e0e0',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#007AFF',
        borderRadius: 4,
    },
    progressText: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
        fontWeight: '500',
    },
});
