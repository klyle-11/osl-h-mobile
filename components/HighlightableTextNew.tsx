import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Text, Pressable, StyleSheet, View, Platform } from 'react-native';
import { Highlight, TextSelection } from '../types';
import { HighlightErrorBoundary } from './ErrorBoundary';

type Props = {
    text: string;
    highlights: Highlight[];
    onTextSelection: (selection: TextSelection) => void;
    onHighlightPress: (highlight: Highlight) => void;
}

export const HighlightableText = ({ text, highlights, onTextSelection, onHighlightPress }: Props) => {
    const [selectionStart, setSelectionStart] = useState<number | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
    const [isWebSelectionMode, setIsWebSelectionMode] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const words = text.split(' ');

    // Handle web text selection
    const handleWebSelection = useCallback(() => {
        if (Platform.OS !== 'web') return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            if (isWebSelectionMode) {
                setIsWebSelectionMode(false);
                setSelectionStart(null);
                setSelectionEnd(null);
            }
            return;
        }

        const range = selection.getRangeAt(0);
        if (range.collapsed) {
            if (isWebSelectionMode) {
                setIsWebSelectionMode(false);
                setSelectionStart(null);
                setSelectionEnd(null);
            }
            return;
        }

        // Check if selection is within our container
        const container = containerRef.current;
        if (!container) return;

        // Get all text nodes in our container
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let textNodes: Text[] = [];
        let node: Node | null;
        while (node = walker.nextNode()) {
            textNodes.push(node as Text);
        }

        // Calculate character positions
        let totalText = '';
        let nodePositions: { node: Text; start: number; end: number }[] = [];
        
        for (const textNode of textNodes) {
            const start = totalText.length;
            const nodeText = textNode.textContent || '';
            totalText += nodeText;
            nodePositions.push({
                node: textNode,
                start,
                end: totalText.length
            });
        }

        // Find selection start and end positions
        let selStart = -1;
        let selEnd = -1;

        for (const { node, start } of nodePositions) {
            if (range.startContainer === node) {
                selStart = start + range.startOffset;
            }
            if (range.endContainer === node) {
                selEnd = start + range.endOffset;
            }
        }

        if (selStart >= 0 && selEnd >= 0 && selStart !== selEnd) {
            const selectedText = totalText.substring(selStart, selEnd).trim();
            if (selectedText.length > 0) {
                setIsWebSelectionMode(true);
                setSelectionStart(selStart);
                setSelectionEnd(selEnd);

                // Create the text selection object
                const textSelection: TextSelection = {
                    text: selectedText,
                    startIndex: selStart,
                    endIndex: selEnd
                };

                // Delay to allow for complete selection
                setTimeout(() => {
                    onTextSelection(textSelection);
                    // Clear browser selection
                    selection.removeAllRanges();
                    setIsWebSelectionMode(false);
                    setSelectionStart(null);
                    setSelectionEnd(null);
                }, 150);
            }
        }
    }, [isWebSelectionMode, onTextSelection]);

    // Set up selection change listener for web
    useEffect(() => {
        if (Platform.OS === 'web') {
            document.addEventListener('selectionchange', handleWebSelection);
            return () => {
                document.removeEventListener('selectionchange', handleWebSelection);
            };
        }
    }, [handleWebSelection]);

    const getWordStartIndex = (wordIndex: number) => {
        return words.slice(0, wordIndex).join(' ').length + (wordIndex > 0 ? 1 : 0);
    };

    const getWordEndIndex = (wordIndex: number) => {
        const startIndex = getWordStartIndex(wordIndex);
        return startIndex + words[wordIndex].length;
    };

    const isWordHighlighted = (wordIndex: number) => {
        const wordStart = getWordStartIndex(wordIndex);
        const wordEnd = getWordEndIndex(wordIndex);
        
        return highlights.some(highlight => 
            wordStart >= highlight.startIndex && wordEnd <= highlight.endIndex
        );
    };

    const isWordSelected = (wordIndex: number) => {
        if (selectionStart === null || selectionEnd === null) return false;
        
        const wordStart = getWordStartIndex(wordIndex);
        const wordEnd = getWordEndIndex(wordIndex);
        const start = Math.min(selectionStart, selectionEnd);
        const end = Math.max(selectionStart, selectionEnd);
        
        return wordStart >= start && wordEnd <= end;
    };

    const handleWordPress = (wordIndex: number) => {
        // Don't handle touch events if we're in web selection mode
        if (isWebSelectionMode) return;

        const wordStart = getWordStartIndex(wordIndex);
        const wordEnd = getWordEndIndex(wordIndex);
        
        // Check if this word is part of an existing highlight
        const existingHighlight = highlights.find(highlight => 
            wordStart >= highlight.startIndex && wordEnd <= highlight.endIndex
        );
        
        if (existingHighlight) {
            onHighlightPress(existingHighlight);
            return;
        }

        // Handle word selection for mobile
        if (selectionStart === null) {
            // Start new selection
            setSelectionStart(wordIndex);
            setSelectionEnd(wordIndex);
        } else if (selectionEnd === null) {
            // Complete selection
            setSelectionEnd(wordIndex);
            
            const start = Math.min(selectionStart, wordIndex);
            const end = Math.max(selectionStart, wordIndex);
            
            const startCharIndex = getWordStartIndex(start);
            const endCharIndex = getWordEndIndex(end);
            const selectedText = text.substring(startCharIndex, endCharIndex);
            
            const selection: TextSelection = {
                text: selectedText,
                startIndex: startCharIndex,
                endIndex: endCharIndex
            };
            
            onTextSelection(selection);
            
            // Reset selection
            setSelectionStart(null);
            setSelectionEnd(null);
        } else {
            // Reset and start new selection
            setSelectionStart(wordIndex);
            setSelectionEnd(null);
        }
    };

    const getWordStyle = (wordIndex: number) => {
        const isHighlighted = isWordHighlighted(wordIndex);
        const isSelected = isWordSelected(wordIndex);
        
        if (isHighlighted) {
            return [styles.word, styles.highlighted];
        } else if (isSelected) {
            return [styles.word, styles.selected];
        } else {
            return styles.word;
        }
    };

    const renderContent = () => {
        if (Platform.OS === 'web') {
            // For web, render as a single selectable text block with highlighting
            const renderTextWithHighlights = () => {
                let renderedText = '';
                let lastIndex = 0;
                const elements: React.ReactNode[] = [];

                // Sort highlights by start index
                const sortedHighlights = [...highlights].sort((a, b) => a.startIndex - b.startIndex);

                sortedHighlights.forEach((highlight, index) => {
                    // Add text before highlight
                    if (highlight.startIndex > lastIndex) {
                        const beforeText = text.substring(lastIndex, highlight.startIndex);
                        elements.push(
                            <span key={`before-${index}`}>{beforeText}</span>
                        );
                    }

                    // Add highlighted text
                    const highlightedText = text.substring(highlight.startIndex, highlight.endIndex);
                    elements.push(
                        <span 
                            key={`highlight-${index}`}
                            style={{
                                backgroundColor: highlight.color || 'yellow',
                                padding: '2px',
                                borderRadius: '2px',
                                cursor: 'pointer'
                            }}
                            onClick={() => onHighlightPress(highlight)}
                        >
                            {highlightedText}
                        </span>
                    );

                    lastIndex = highlight.endIndex;
                });

                // Add remaining text
                if (lastIndex < text.length) {
                    const remainingText = text.substring(lastIndex);
                    elements.push(
                        <span key="remaining">{remainingText}</span>
                    );
                }

                return elements;
            };

            return (
                <div
                    ref={containerRef}
                    style={{
                        fontSize: '18px',
                        lineHeight: '28px',
                        padding: '16px',
                        userSelect: 'text',
                        cursor: 'text',
                        color: '#333'
                    }}
                >
                    {renderTextWithHighlights()}
                </div>
            );
        }

        // For mobile, render as pressable words
        return (
            <View style={styles.container}>
                <Text style={styles.text}>
                    {words.map((word: string, index: number) => (
                        <Pressable 
                            key={index}
                            onPress={() => handleWordPress(index)}
                            style={({ pressed }) => [
                                getWordStyle(index),
                                pressed && styles.pressed
                            ]}
                        >
                            <Text style={styles.wordText}>{word} </Text>
                        </Pressable>
                    ))}
                </Text>
            </View>
        );
    };

    return (
        <HighlightErrorBoundary>
            {renderContent()}
        </HighlightErrorBoundary>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    text: { 
        fontSize: 18, 
        lineHeight: 28,
        flexWrap: 'wrap',
        flexDirection: 'row',
    },
    word: {
        marginRight: 2,
    },
    wordText: {
        fontSize: 18,
        lineHeight: 28,
    },
    highlighted: { 
        backgroundColor: 'yellow',
        paddingHorizontal: 2,
        borderRadius: 2,
    },
    selected: { 
        backgroundColor: 'lightblue',
        paddingHorizontal: 2,
        borderRadius: 2,
    },
    pressed: { 
        opacity: 0.7,
    },
});
