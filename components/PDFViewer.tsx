import React, { useState } from 'react';
import { View, StyleSheet, Text, Alert } from 'react-native';
import { Highlight, TextSelection } from '../types';

type Props = {
    documentPath: string;
    highlights: Highlight[];
    onTextSelection?: (selection: TextSelection) => void;
    onHighlightPress?: (highlight: Highlight) => void;
}

export const PDFViewer = ({ documentPath, highlights, onTextSelection, onHighlightPress }: Props) => {
    const [currentPage, setCurrentPage] = useState(1);

    // For now, show a placeholder for PDF viewing
    // In a real app, you'd integrate with react-native-pdf or similar
    
    return (
        <View style={styles.container}>
            <View style={styles.pdfPlaceholder}>
                <Text style={styles.placeholderText}>
                    📄 PDF Viewer
                </Text>
                <Text style={styles.placeholderSubText}>
                    {documentPath}
                </Text>
                <Text style={styles.placeholderNote}>
                    PDF viewing requires additional setup for production use.
                    For now, use the sample text document to test highlighting features.
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    pdfPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    placeholderText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 16,
    },
    placeholderSubText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 24,
        textAlign: 'center',
    },
    placeholderNote: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
    },
});
