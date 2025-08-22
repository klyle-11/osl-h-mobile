import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { ReactReader } from 'react-reader';
import { Document as AppDocument, Highlight, TextSelection } from '../types';

type Props = {
  document: AppDocument;
  highlights: Highlight[];
  onTextSelection: (selection: TextSelection) => void;
  onHighlightPress: (highlight: Highlight) => void;
};

// react-reader doesn't expose typed styles prop in our version; rely on defaults

export const EPUBReader = ({ document, highlights, onTextSelection, onHighlightPress }: Props) => {
  const [location, setLocation] = useState<string | number>(0);
  const renditionRef = useRef<any>(null);

  // Prepare the book URL from data URL or blob
  const bookUrl = useMemo(() => {
    return document.path || '';
  }, [document.path]);

  // Apply or refresh annotations when highlights or rendition change
  useEffect(() => {
    const r = renditionRef.current;
    if (!r) return;
    try {
      // Clear previous annotations to avoid duplicates
      // epub.js adds each highlight under a specific type key
      (r.annotations?._annotations || [])
        .slice()
        .forEach((a: any) => {
          try { r.annotations.remove(a.cfiRange, 'highlight'); } catch {}
        });
      // Re-add current highlights
      highlights.forEach((h) => {
        if (!h.cfi) return;
        try {
          r.annotations.highlight(
            h.cfi,
            {},
            (e: any) => onHighlightPress(h),
            undefined,
            { fill: 'hotpink', 'fill-opacity': '0.5' }
          );
        } catch {}
      });
    } catch {}
  }, [highlights]);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.unsupported}>
        <Text style={styles.unsupportedTitle}>EPUB not supported</Text>
        <Text style={styles.unsupportedText}>Open this on the web to view EPUBs.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
  <ReactReader
        url={bookUrl}
        location={location}
        locationChanged={setLocation}
        getRendition={(rendition: any) => {
          renditionRef.current = rendition;
          // Selection callback to capture CFI and text
          try {
            rendition.on('selected', (cfiRange: string, contents: any) => {
              contents.window?.getSelection()?.removeAllRanges?.();
              rendition.annotations.add('highlight', cfiRange, {}, undefined, 'epub-highlight');
              contents.highlight(cfiRange, {}, undefined, 'epub-highlight');
              // Extract text for UX
              contents.range(cfiRange).then((range: Range) => {
                const text = range.toString();
                onTextSelection({ text, startIndex: 0, endIndex: text.length, cfi: cfiRange });
              }).catch(() => {
                onTextSelection({ text: '', startIndex: 0, endIndex: 0, cfi: cfiRange });
              });
            });
          } catch {}
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  unsupported: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  unsupportedTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  unsupportedText: { color: '#666' },
});

export default EPUBReader;
