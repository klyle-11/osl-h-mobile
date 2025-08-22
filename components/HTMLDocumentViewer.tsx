import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Text, Platform } from 'react-native';
import { HighlightableText } from './HighlightableText';
import { PDFViewer } from './PDFViewer';
import { Highlight, TextSelection, Document } from '../types';
import { simpleEpubParser } from '../utils/simpleEpubParser';
import type { SimpleEPUBContent, ParseProgress } from '../utils/simpleEpubParser';
import { Subscription } from 'rxjs';
import { DocumentErrorBoundary } from './ErrorBoundary';

type Props = {
    document: Document;
    highlights: Highlight[];
    onTextSelection: (selection: TextSelection) => void;
    onHighlightPress: (highlight: Highlight) => void;
}

export const HTMLDocumentViewer = ({ document, highlights, onTextSelection, onHighlightPress }: Props) => {
    const [documentContent, setDocumentContent] = useState<string>('');
    const [htmlContent, setHtmlContent] = useState<SimpleEPUBContent | null>(null);
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
            setHtmlContent(null);
            
            if (document.type === 'pdf') {
                setIsLoading(false);
                return;
            }

            // Handle sample document
            if (document.path === 'sample://text') {
                const sampleText = `# Chapter 1: Introduction

This is a sample document for testing the highlighting and annotation features of the web app.

Here is some text that can be highlighted and annotated. You can click on individual words or phrases to create highlights.

# Chapter 2: Text Selection

When you click on a word, it will be selected. When you click on another word, it will create a selection range that can be saved as a highlight.

Once text is highlighted, you can click on the highlighted text to add annotations and comments.

# Chapter 3: Persistence

This system allows for persistent storage of highlights and annotations that will be saved across browser sessions using localStorage.

The app supports both PDF and EPUB documents with preserved HTML formatting.`;
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
                    
                    const progressSubscription = simpleEpubParser.progress$.subscribe({
                        next: (progress: ParseProgress) => {
                            setParseProgress(progress.progress);
                            setLoadingMessage(progress.message);
                        },
                        error: (error: any) => {
                            console.error('Progress tracking error:', error);
                        }
                    });
                    subscriptionsRef.current.push(progressSubscription);
                    
                    const parseSubscription = simpleEpubParser.parseEPUB(arrayBuffer).subscribe({
                        next: (result: SimpleEPUBContent) => {
                            console.log('Simple EPUB parsing successful', result);
                            setHtmlContent(result);
                            
                            // Convert HTML to plain text for highlighting compatibility
                            const plainText = convertHtmlToText(result.htmlContent);
                            setDocumentContent(plainText);
                            setIsLoading(false);
                        },
                        error: (error: any) => {
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

    // Convert HTML to plain text for highlighting compatibility
    const convertHtmlToText = (html: string): string => {
        return html
            .replace(/<h([1-6])[^>]*>/gi, (match, level) => `\n${'#'.repeat(parseInt(level))} `)
            .replace(/<\/h[1-6]>/gi, '\n\n')
            .replace(/<p[^>]*>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<div[^>]*>/gi, '\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<blockquote[^>]*>/gi, '\n> ')
            .replace(/<\/blockquote>/gi, '\n\n')
            .replace(/<li[^>]*>/gi, '• ')
            .replace(/<\/li>/gi, '\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#8220;/g, '"')
            .replace(/&#8221;/g, '"')
            .replace(/&#8216;/g, "'")
            .replace(/&#8217;/g, "'")
            .replace(/&#8211;/g, '–')
            .replace(/&#8212;/g, '—')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n[ \t]+/g, '\n')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    };

    const renderContent = () => {
        // For web platform, we can render HTML directly
        if (Platform.OS === 'web' && htmlContent && htmlContent.htmlContent) {
            return (
                <div
                    style={{
                        fontSize: '18px',
                        lineHeight: '28px',
                        color: '#333',
                        maxWidth: '100%',
                        wordWrap: 'break-word'
                    }}
                    dangerouslySetInnerHTML={{ __html: htmlContent.htmlContent }}
                />
            );
        }

        // Fallback to highlightable text for mobile or when HTML content is not available
        return (
            <HighlightableText 
                text={documentContent}
                highlights={highlights}
                onTextSelection={onTextSelection}
                onHighlightPress={onHighlightPress}
            />
        );
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
                    {document.name?.endsWith('.epub') ? 'Preserving original HTML formatting...' : 'Please wait...'}
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
                {htmlContent && htmlContent.tableOfContents.length > 0 && (
                    <View style={styles.tocContainer}>
                        <Text style={styles.tocTitle}>Table of Contents</Text>
                        {htmlContent.tableOfContents.slice(0, 10).map((item: any, index: number) => (
                            <Text key={index} style={[styles.tocItem, { paddingLeft: item.level * 12 }]}>
                                {item.title}
                            </Text>
                        ))}
                    </View>
                )}
                
                <ScrollView 
                    style={styles.scrollView} 
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={true}
                >
                    {renderContent()}
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
    tocContainer: {
        backgroundColor: '#f8f9fa',
        padding: 16,
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#007AFF',
        maxHeight: 200,
    },
    tocTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
    },
    tocItem: {
        fontSize: 14,
        color: '#007AFF',
        marginBottom: 6,
        paddingVertical: 2,
    },
});
