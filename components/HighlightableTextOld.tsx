import React, { useState, useRef, useEffect } from 'react';
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
    const [isWebSelectionActive, setIsWebSelectionActive] = useState(false);
    const containerRef = useRef<View>(null);
    const textContainerRef = useRef<HTMLDivElement>(null);

    const words = text.split(' ');
    
    // Handle web text selection
    useEffect(() => {
        if (Platform.OS === 'web') {
            const handleSelectionChange = () => {
                const selection = window.getSelection();
                if (!selection || selection.rangeCount === 0) {
                    setIsWebSelectionActive(false);
                    return;
                }

                const range = selection.getRangeAt(0);
                if (range.collapsed) {
                    setIsWebSelectionActive(false);
                    return;
                }

                // Check if selection is within our text container
                const container = textContainerRef.current;
                if (!container || !container.contains(range.commonAncestorContainer)) {
                    return;
                }

                const selectedText = selection.toString().trim();
                if (selectedText.length === 0) {
                    setIsWebSelectionActive(false);
                    return;
                }

                // Calculate character indices for the selection
                const fullText = text;
                const beforeRange = range.cloneRange();
                beforeRange.selectNodeContents(container);
                beforeRange.setEnd(range.startContainer, range.startOffset);
                const beforeText = beforeRange.toString();
                
                const startIndex = beforeText.length;
                const endIndex = startIndex + selectedText.length;

                // Set selection state
                setSelectionStart(startIndex);
                setSelectionEnd(endIndex);
                setIsWebSelectionActive(true);

                // Create text selection object
                const textSelection: TextSelection = {
                    text: selectedText,
                    startIndex: startIndex,
                    endIndex: endIndex
                };

                // Trigger the selection callback after a short delay to allow for double-click selections
                setTimeout(() => {
                    if (window.getSelection()?.toString().trim() === selectedText) {
                        onTextSelection(textSelection);
                        // Clear the browser selection
                        selection.removeAllRanges();
                        setIsWebSelectionActive(false);
                    }
                }, 100);
            };

            document.addEventListener('selectionchange', handleSelectionChange);
            
            return () => {
                document.removeEventListener('selectionchange', handleSelectionChange);
            };
        }
    }, [text, onTextSelection]);

    const getWordStartIndex = (wordIndex: number) => {
        return words.slice(0, wordIndex).join(' ').length + (wordIndex > 0 ? 1 : 0);
    };

    const getWordEndIndex = (wordIndex: number) => {
        return getWordStartIndex(wordIndex) + words[wordIndex].length;
    };

    const isWordHighlighted = (wordIndex: number) => {
        const wordStart = getWordStartIndex(wordIndex);
        const wordEnd = getWordEndIndex(wordIndex);
        
        return highlights.some(highlight => 
            wordStart >= highlight.startIndex && wordEnd <= highlight.endIndex
        );
    };

    const isWordSelected = (wordIndex: number) => {
        if (isWebSelectionActive && selectionStart !== null && selectionEnd !== null) {
            const wordStart = getWordStartIndex(wordIndex);
            const wordEnd = wordStart + words[wordIndex].length;
            return wordStart >= selectionStart && wordEnd <= selectionEnd;
        }

        if (selectionStart === null || selectionEnd === null) return false;
        const start = Math.min(selectionStart, selectionEnd);
        const end = Math.max(selectionStart, selectionEnd);
        return wordIndex >= start && wordIndex <= end;
    };

    const handleWordPress = (wordIndex: number) => {
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

        // Handle text selection
        if (selectionStart === null) {
            setSelectionStart(wordIndex);
        } else if (selectionEnd === null) {
            setSelectionEnd(wordIndex);
            const start = Math.min(selectionStart, wordIndex);
            const end = Math.max(selectionStart, wordIndex);
            
            const selectedText = words.slice(start, end + 1).join(' ');
            const textStart = getWordStartIndex(start);
            const textEnd = getWordEndIndex(end);
            
            onTextSelection({
                text: selectedText,
                startIndex: textStart,
                endIndex: textEnd
            });
            
            setSelectionStart(null);
            setSelectionEnd(null);
        } else {
            // Reset selection and start new one
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

    return (
        <HighlightErrorBoundary>
            <View style={styles.container} ref={containerRef}>
                <Text 
                    style={[styles.text, Platform.OS === 'web' && styles.webSelectableText]}
                    ref={Platform.OS === 'web' ? textContainerRef : undefined}
                    // @ts-ignore - Web-specific props
                    selectable={Platform.OS === 'web'}
                    // @ts-ignore - Web-specific props  
                    userSelect={Platform.OS === 'web' ? 'text' : undefined}
                >
                    {words.map((word: string, index: number) => (
                        <Pressable 
                            key={index}
                            onPress={() => handleWordPress(index)}
                            style={({ pressed }) => [
                                getWordStyle(index),
                                pressed && styles.pressed
                            ]}
                            // Disable touch events when web selection is active
                            disabled={isWebSelectionActive}
                        >
                            <Text 
                                style={styles.wordText}
                                // @ts-ignore - Web-specific props
                                selectable={Platform.OS === 'web'}
                            >
                                {word}{' '}
                            </Text>
                        </Pressable>
                    ))}
                </Text>
            </View>
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
    webSelectableText: {
        // @ts-ignore - Web-specific styles
        userSelect: 'text',
        cursor: 'text',
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