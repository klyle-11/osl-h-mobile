import React from 'react';
import { Document, Highlight, TextSelection } from '../types';
import { EPUBReader } from './EPUBReader';
import { EnhancedDocumentViewer } from './EnhancedDocumentViewer';
import { PDFViewer } from './PDFViewer';

type Props = {
    document: Document;
    highlights: Highlight[];
    onTextSelection: (selection: TextSelection) => void;
    onHighlightPress: (highlight: Highlight) => void;
}

export const DocumentViewer = ({ document, highlights, onTextSelection, onHighlightPress }: Props) => {
    // Use EPUBViewer for EPUB documents
    if (document.type === 'epub' && 
        (document.path?.startsWith('data:application/epub+zip') || 
         document.path?.startsWith('data:application/octet-stream') ||
         document.name?.endsWith('.epub'))) {
        
        return (
            <EPUBReader
                document={document}
                highlights={highlights}
                onTextSelection={onTextSelection}
                onHighlightPress={onHighlightPress}
            />
        );
    }

    // Use PDFViewer for PDF documents
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

    // Use EnhancedDocumentViewer for other text-based documents
    return (
        <EnhancedDocumentViewer
            document={document}
            highlights={highlights}
            onTextSelection={onTextSelection}
            onHighlightPress={onHighlightPress}
        />
    );
};