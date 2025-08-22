import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Platform, ScrollView, TextInput, Modal, Pressable } from 'react-native';
import { Highlight, TextSelection, Document as AppDocument } from '../types';
import { DocumentErrorBoundary } from './ErrorBoundary';
import { simpleEpubParser, SimpleEPUBContent } from '../utils/simpleEpubParser';
import { Subscription } from 'rxjs';

type Props = {
    document: AppDocument;
    highlights: Highlight[];
    onTextSelection: (selection: TextSelection) => void;
    onHighlightPress: (highlight: Highlight) => void;
}

export const EPUBViewer = ({ document: doc, highlights, onTextSelection, onHighlightPress }: Props) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [epubContent, setEpubContent] = useState<SimpleEPUBContent | null>(null);
    const [currentChapter, setCurrentChapter] = useState(0);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingMessage, setLoadingMessage] = useState('Loading...');
    const [viewMode, setViewMode] = useState<'continuous' | 'paginated'>('continuous');
    const [chapterContents, setChapterContents] = useState<string[]>([]);
    const subscriptionsRef = useRef<Subscription[]>([]);
    const scrollViewRef = useRef<ScrollView>(null);
    const chapterRefs = useRef<{ [key: number]: number }>({});
    const [selectedHighlight, setSelectedHighlight] = useState<Highlight | null>(null);
    const [annotationPanelVisible, setAnnotationPanelVisible] = useState(false);
    const [newAnnotation, setNewAnnotation] = useState('');
    const annotationPanelRef = useRef<any>(null);
    // Web-only: container ref used to apply DOM-based highlights
    const contentContainerRef = useRef<any>(null);
    const selectionAnchorRef = useRef<{ node: Node; offset: number } | null>(null);
    const selectionRangeRef = useRef<Range | null>(null);
    const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
    const movedRef = useRef<boolean>(false);
    const awaitingSecondClickRef = useRef<boolean>(false);
    const clickTimerRef = useRef<any>(null);

    // Finalize selection on release (pointer-only)
    const finalizeSelection = (e?: any) => {
        if (typeof window === 'undefined' || !('getSelection' in window)) return;
        const sel = window.getSelection && window.getSelection();
        let text = sel ? sel.toString() : '';

    // If no selection text (e.g., two-tap), try to create from anchor/focus only if not dragged
    if ((!text || !text.trim()) && selectionAnchorRef.current && e && !movedRef.current) {
            const focus = getCaretFromEvent(e);
            if (focus) {
                try {
                    sel?.removeAllRanges();
                    const range = window.document.createRange();
                    const a = selectionAnchorRef.current;
                    if (a) {
                        try {
                            range.setStart(a.node, a.offset);
                            range.setEnd(focus.node, focus.offset);
                        } catch {
                            range.setStart(focus.node, focus.offset);
                            range.setEnd(a.node, a.offset);
                        }
                        sel?.addRange(range);
                        text = sel ? sel.toString() : '';
                        if (!text || !text.trim()) {
                            // Fallback to word at caret
                            const wordRange = buildWordRange(focus.node, focus.offset);
                            if (wordRange) {
                                sel?.removeAllRanges();
                                sel?.addRange(wordRange);
                                text = sel ? sel.toString() : '';
                            }
                        }
                    }
                } catch {}
            }
        }

        if (text && text.trim()) {
            // Store the exact range for immediate DOM highlighting
            try {
                if (sel && sel.rangeCount > 0) {
                    selectionRangeRef.current = sel.getRangeAt(0).cloneRange();
                }
            } catch {}
            handleTextSelection(text);
        }
        // Do not clear selection; leave it visible until panel interaction
        selectionAnchorRef.current = null;
        pointerStartRef.current = null;
        movedRef.current = false;
    };

    // Get caret position from a pointer/mouse/touch event
    const getCaretFromEvent = (evt: any): { node: Node; offset: number } | null => {
        try {
            const doc = window.document as any;
            let x = 0, y = 0;
            if (evt.touches && evt.touches.length) {
                x = evt.touches[0].clientX; y = evt.touches[0].clientY;
            } else if (evt.changedTouches && evt.changedTouches.length) {
                x = evt.changedTouches[0].clientX; y = evt.changedTouches[0].clientY;
            } else {
                x = evt.clientX; y = evt.clientY;
            }
            if (doc.caretRangeFromPoint) {
                const range = doc.caretRangeFromPoint(x, y);
                if (range && range.startContainer) return { node: range.startContainer, offset: range.startOffset };
            }
            if (doc.caretPositionFromPoint) {
                const pos = doc.caretPositionFromPoint(x, y);
                if (pos) return { node: pos.offsetNode, offset: pos.offset };
            }
        } catch (e) {
            console.warn('getCaretFromEvent failed', e);
        }
        return null;
    };

    // Build a word range at node/offset when empty selection
    const buildWordRange = (node: Node, offset: number): Range | null => {
        try {
            if (node.nodeType !== Node.TEXT_NODE) return null;
            const text = (node.nodeValue || '');
            let start = offset;
            let end = offset;
            while (start > 0 && /\w/.test(text[start - 1])) start--;
            while (end < text.length && /\w/.test(text[end])) end++;
            if (start === end) return null;
            const range = window.document.createRange();
            range.setStart(node, start);
            range.setEnd(node, end);
            return range;
        } catch (e) {
            return null;
        }
    };

    // Pointer handlers to support drag and two-tap selection
    const onContentPointerDown = (e: any) => {
        const target = e.target as HTMLElement;
        // Ignore clicks on existing highlights or links (let links work normally)
        if (target && (target.closest('[data-highlight-id]') || target.closest('a[href]'))) return;
        if (e.currentTarget?.setPointerCapture && e.pointerId != null) {
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
        }
        const caret = getCaretFromEvent(e);
        if (caret) selectionAnchorRef.current = caret;
        const cx = e.clientX ?? (e.touches?.[0]?.clientX || 0);
        const cy = e.clientY ?? (e.touches?.[0]?.clientY || 0);
        pointerStartRef.current = { x: cx, y: cy };
        movedRef.current = false;
    };

    const onContentPointerMove = (e: any) => {
        if (!pointerStartRef.current) return;
        const x = e.clientX ?? (e.touches?.[0]?.clientX || 0);
        const y = e.clientY ?? (e.touches?.[0]?.clientY || 0);
        const dx = x - pointerStartRef.current.x;
        const dy = y - pointerStartRef.current.y;
        if ((dx * dx + dy * dy) > 25) {
            movedRef.current = true;
        }
    };

    const onContentPointerUp = (e: any) => {
        const target = e.target as HTMLElement;
        // Let links work; don't interfere with anchor clicks
        if (target && target.closest('a[href]')) {
            pointerStartRef.current = null;
            movedRef.current = false;
            return;
        }
        if (e.currentTarget?.releasePointerCapture && e.pointerId != null) {
            try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
        }
        // If this was a drag selection, finalize now on release
        if (movedRef.current) {
            requestAnimationFrame(() => finalizeSelection(e));
            return;
        }
        // Caret/tap selection: require a second click to finalize
        if (!awaitingSecondClickRef.current) {
            awaitingSecondClickRef.current = true;
            if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
            clickTimerRef.current = setTimeout(() => {
                awaitingSecondClickRef.current = false;
                clickTimerRef.current = null;
            }, 600);
            return; // first click sets anchor only
        }
        // Second click within threshold: finalize selection
        if (clickTimerRef.current) {
            clearTimeout(clickTimerRef.current);
            clickTimerRef.current = null;
        }
        awaitingSecondClickRef.current = false;
        requestAnimationFrame(() => finalizeSelection(e));
    };
    // Check if we're on web platform
    if (Platform.OS !== 'web') {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorTitle}>EPUB Not Supported</Text>
                <Text style={styles.errorText}>
                    EPUB viewing is only supported on web browsers.
                </Text>
                <Text style={styles.errorSubtext}>
                    Please use a web browser to view EPUB files.
                </Text>
            </View>
        );
    }

    useEffect(() => {
        loadEPUB();
        
        // Set up global highlight click handler for web
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            (window as any).handleHighlightClick = handleHighlightClick;
            (window as any).applyImmediateHighlight = (id: string) => {
                try {
                    const range = selectionRangeRef.current;
                    if (!range) return;
                    const span = window.document.createElement('span');
                    span.setAttribute('data-highlight-id', id);
                    span.style.backgroundColor = 'hotpink';
                    span.style.cursor = 'pointer';
                    span.style.padding = '2px 4px';
                    span.style.borderRadius = '3px';
                    span.onclick = () => handleHighlightClick(id);
                    try {
                        range.surroundContents(span);
                    } catch {
                        const contents = range.cloneContents();
                        span.appendChild(contents);
                        range.deleteContents();
                        range.insertNode(span);
                    }
                } catch (e) {
                    console.warn('applyImmediateHighlight failed', e);
                }
            };
        }
        
        // Intercept clicks on internal links to navigate within this EPUB instead of leaving the app
        if (Platform.OS === 'web') {
            const container: HTMLElement | null = contentContainerRef.current;
            const esc = (s: string) => {
                const CSSAny: any = (window as any).CSS;
                if (CSSAny && typeof CSSAny.escape === 'function') return CSSAny.escape(s);
                return s.replace(/([ #;?%&,.+*~\\':\"!^$\[\]()=>|\/])/g, '\\$1');
            };

            const onClick = (e: MouseEvent) => {
                const target = e.target as HTMLElement | null;
                if (!target) return;
                const link = (target.closest && target.closest('a[href]')) as HTMLAnchorElement | null;
                if (!link) return;
                const rawHref = link.getAttribute('href') || '';
                if (!rawHref) return;
                // Allow external links
                if (/^(https?:|mailto:|tel:)/i.test(rawHref)) {
                    return;
                }
                // Internal link – prevent default navigation
                e.preventDefault();
                e.stopPropagation();

                let hash = '';
                let file = '';
                try {
                    const u = new URL(rawHref, window.location.href);
                    hash = (u.hash || '').replace(/^#/, '');
                    file = (u.pathname || '').split('/').pop() || '';
                } catch {
                    // Fallback manual parse
                    const [pathPart, hashPart] = rawHref.split('#');
                    if (hashPart) hash = hashPart;
                    if (pathPart && !pathPart.startsWith('#')) {
                        const parts = pathPart.split('/');
                        file = parts[parts.length - 1];
                    }
                }

                const scrollToId = (id: string) => {
                    const cont: any = contentContainerRef.current;
                    if (!cont || typeof cont.querySelector !== 'function') return;
                    const el = cont.querySelector(`#${esc(id)}`) as HTMLElement | null;
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                };

                if (hash) {
                    if (viewMode === 'continuous') {
                        scrollToId(hash);
                    } else {
                        const idx = chapterContents.findIndex(html => html.includes(`id="${hash}"`) || html.includes(`name="${hash}"`));
                        if (idx >= 0) {
                            setCurrentChapter(idx);
                            setTimeout(() => scrollToId(hash), 50);
                        }
                    }
                    return;
                }

                if (file) {
                    const linkText = (link.textContent || '').trim();
                    if (viewMode === 'continuous') {
                        if (linkText) {
                            const cont: any = contentContainerRef.current;
                            const headers = Array.from((cont?.querySelectorAll?.('h1,h2,h3,h4,h5,h6') as NodeListOf<HTMLElement>) || []);
                            const targetHeading = headers.find(h => (h.textContent || '').trim().toLowerCase().includes(linkText.toLowerCase()));
                            if (targetHeading) {
                                targetHeading.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                return;
                            }
                        }
                    } else {
                        let idx = -1;
                        if (linkText) {
                            idx = chapterContents.findIndex(html => html.toLowerCase().includes(linkText.toLowerCase()));
                        }
                        if (idx < 0) {
                            const m = file.match(/(\d+)/);
                            if (m) {
                                const n = parseInt(m[1], 10);
                                if (!isNaN(n) && n - 1 >= 0 && n - 1 < chapterContents.length) idx = n - 1;
                            }
                        }
                        if (idx >= 0) {
                            setCurrentChapter(idx);
                        }
                    }
                }
            };

            if (container) container.addEventListener('click', onClick);
            return () => {
                if (container) container.removeEventListener('click', onClick);
            };
        }
        return () => {
            subscriptionsRef.current.forEach(sub => sub.unsubscribe());
            subscriptionsRef.current = [];
            
            // Clean up global handler
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                delete (window as any).handleHighlightClick;
                delete (window as any).applyImmediateHighlight;
            }
        };
    }, [doc]);

    // Debug effect for highlights
    useEffect(() => {
        console.log('Current highlights for document:', doc.id, highlights.filter(h => h.documentId === doc.id));
    }, [highlights, doc.id]);

    // Helper: clear previously applied highlight spans
    const clearDomHighlights = (container: HTMLElement, keepIds: Set<string>) => {
        try {
            const nodes = Array.from(container.querySelectorAll('[data-highlight-id]')) as HTMLElement[];
            nodes.forEach((node) => {
                const id = node.getAttribute('data-highlight-id') || '';
                if (!keepIds.has(id)) {
                    const text = window.document.createTextNode(node.textContent || '');
                    node.replaceWith(text);
                }
            });
        } catch (e) {
            console.warn('clearDomHighlights error', e);
        }
    };

    // Helper: wrap the first occurrence of text in a text node with a span
    const wrapFirstOccurrence = (container: HTMLElement, highlightText: string, id: string) => {
        if (!highlightText) return false;
        try {
            const walker = window.document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
                acceptNode(node: any) {
                    if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
                    // Skip empty/whitespace-only texts
                    return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
                }
            } as any);

            let current: any = walker.nextNode();
            while (current) {
                const value = current.nodeValue as string;
                const idx = value.indexOf(highlightText);
                if (idx !== -1) {
                    const before = value.slice(0, idx);
                    const match = value.slice(idx, idx + highlightText.length);
                    const after = value.slice(idx + highlightText.length);

                    const span = window.document.createElement('span');
                    span.setAttribute('data-highlight-id', id);
                    span.style.backgroundColor = 'hotpink';
                    span.style.cursor = 'pointer';
                    span.style.padding = '2px 4px';
                    span.style.borderRadius = '3px';
                    span.textContent = match;
                    span.onclick = () => handleHighlightClick(id);

                    const parent = current.parentNode as Node;
                    if (!parent) return false;
                    const frag = window.document.createDocumentFragment();
                    if (before) frag.appendChild(window.document.createTextNode(before));
                    frag.appendChild(span);
                    if (after) frag.appendChild(window.document.createTextNode(after));
                    parent.replaceChild(frag, current);
                    return true;
                }
                current = walker.nextNode();
            }
        } catch (e) {
            console.warn('wrapFirstOccurrence error', e);
        }
        return false;
    };

    // Apply DOM-based highlights after content is rendered
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const container: HTMLElement | null = contentContainerRef.current;
        if (!container) return;

        const existingIds = new Set(
            highlights.filter(h => h.documentId === doc.id).map((h, i) => h.id || String(i))
        );
        // Remove only spans that don't correspond to current highlights
        clearDomHighlights(container, existingIds);

        const docHighlights = highlights.filter(h => h.documentId === doc.id);
        if (!docHighlights.length) return;

        // Apply each highlight by wrapping the first occurrence of its text
        docHighlights.forEach((h, idx) => {
            const hid = h.id || String(idx);
            if (container.querySelector(`[data-highlight-id="${hid}"]`)) return;
            const applied = wrapFirstOccurrence(container, h.text, hid);
            if (!applied) {
                console.log('Highlight text not found in DOM for id/text:', hid, h.text);
            }
        });
    }, [viewMode, currentChapter, chapterContents, epubContent, highlights, doc.id]);

    const loadEPUB = async () => {
        try {
            setIsLoading(true);
            setError(null);

            if (!doc.path?.startsWith('data:')) {
                throw new Error('Invalid EPUB data');
            }

            // Convert data URL to ArrayBuffer
            const base64Data = doc.path.split(',')[1];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const arrayBuffer = bytes.buffer;

            // Subscribe to parsing progress
            const progressSubscription = simpleEpubParser.progress$.subscribe({
                next: (progress) => {
                    setLoadingProgress(progress.progress);
                    setLoadingMessage(progress.message);
                },
                error: (error) => {
                    console.error('Progress error:', error);
                }
            });
            subscriptionsRef.current.push(progressSubscription);

            // Parse EPUB
            const parseSubscription = simpleEpubParser.parseEPUB(arrayBuffer).subscribe({
                next: (content) => {
                    console.log('EPUB parsed successfully:', content);
                    setEpubContent(content);
                    
                    // Split content by chapters for paginated view
                    const chapters = splitContentByChapters(content);
                    setChapterContents(chapters);
                    
                    setIsLoading(false);
                },
                error: (error) => {
                    console.error('EPUB parsing error:', error);
                    setError(error instanceof Error ? error.message : 'Failed to parse EPUB');
                    setIsLoading(false);
                }
            });
            subscriptionsRef.current.push(parseSubscription);

        } catch (error) {
            console.error('Error loading EPUB:', error);
            setError(error instanceof Error ? error.message : 'Failed to load EPUB');
            setIsLoading(false);
        }
    };

    const splitContentByChapters = (content: SimpleEPUBContent): string[] => {
        if (content.tableOfContents.length === 0) {
            return [content.htmlContent];
        }

        // Simple approach: split by TOC headers
        const chapters: string[] = [];
        let htmlContent = content.htmlContent;
        
        // Sort TOC by order of appearance in content
        const tocTitles = content.tableOfContents.map(toc => toc.title);
        
        for (let i = 0; i < tocTitles.length; i++) {
            const currentTitle = tocTitles[i];
            const nextTitle = i < tocTitles.length - 1 ? tocTitles[i + 1] : null;
            
            // Find the current chapter start
            const startPattern = new RegExp(`<h[1-6][^>]*>\\s*${currentTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</h[1-6]>`, 'i');
            const startMatch = htmlContent.match(startPattern);
            
            if (startMatch) {
                const startIndex = htmlContent.indexOf(startMatch[0]);
                
                let endIndex = htmlContent.length;
                if (nextTitle) {
                    const endPattern = new RegExp(`<h[1-6][^>]*>\\s*${nextTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</h[1-6]>`, 'i');
                    const endMatch = htmlContent.match(endPattern);
                    if (endMatch) {
                        endIndex = htmlContent.indexOf(endMatch[0]);
                    }
                }
                
                const chapterContent = htmlContent.substring(startIndex, endIndex).trim();
                if (chapterContent) {
                    chapters.push(chapterContent);
                }
            }
        }
        
        // Fallback: if no chapters were created, return the full content
        return chapters.length > 0 ? chapters : [content.htmlContent];
    };

    const handleTextSelection = (selectedText: string) => {
        if (selectedText.trim()) {
            // Create a more robust selection object
            const selection: TextSelection = {
                text: selectedText.trim(),
                startIndex: 0, // We'll rely on text matching instead of indices
                endIndex: selectedText.length
            };
            
            console.log('Text selected for highlighting:', selection.text);
            onTextSelection(selection);
        }
    };

    // Note: String-based highlighter removed in favor of DOM-based highlighting above.

    const handleHighlightClick = (highlightId: string) => {
        const highlight = highlights.find(h => h.id === highlightId || highlights.indexOf(h).toString() === highlightId);
        if (highlight) {
            setSelectedHighlight(highlight);
            setAnnotationPanelVisible(true);
        }
    };

    const handleAnnotationSave = () => {
        if (selectedHighlight && newAnnotation.trim()) {
            // Create new annotation
            const annotation = {
                id: Date.now().toString(),
                highlightId: selectedHighlight.id || '',
                text: newAnnotation.trim(),
                createdAt: new Date()
            };
            
            // For now, we'll just log it - you can integrate with your storage service
            console.log('Saving annotation:', annotation);
            
            setNewAnnotation('');
            // Keep panel open to show the saved annotation
        }
    };

    // Save annotation if any, return true if saved
    const saveAnnotationIfAny = (): boolean => {
        if (selectedHighlight && newAnnotation.trim()) {
            const annotation = {
                id: Date.now().toString(),
                highlightId: selectedHighlight.id || '',
                text: newAnnotation.trim(),
                createdAt: new Date()
            };
            console.log('Saving annotation (auto-close):', annotation);
            setNewAnnotation('');
            return true;
        }
        return false;
    };

    const closeAnnotationPanel = () => {
        setAnnotationPanelVisible(false);
        setSelectedHighlight(null);
        setNewAnnotation('');
    };

    // Close on overlay click (outside panel), saving annotation if any
    const handleOverlayPress = () => {
        saveAnnotationIfAny();
        closeAnnotationPanel();
    };

    // Close on Escape key (web), saving annotation if any
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (!annotationPanelVisible) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                saveAnnotationIfAny();
                closeAnnotationPanel();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [annotationPanelVisible, newAnnotation, selectedHighlight]);

    // Web: detect outside clicks (anywhere outside the panel) and save+close
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (!annotationPanelVisible) return;
        const onDocMouseDown = (e: MouseEvent) => {
            const panelEl = annotationPanelRef.current as any;
            const target = e.target as Node | null;
            if (!panelEl || !target) return;
            if (panelEl.contains && !panelEl.contains(target)) {
                // Clicked outside panel
                saveAnnotationIfAny();
                closeAnnotationPanel();
            }
        };
        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, [annotationPanelVisible, newAnnotation, selectedHighlight]);

    const goToNextChapter = () => {
        if (epubContent && currentChapter < epubContent.tableOfContents.length - 1) {
            const nextChapter = currentChapter + 1;
            setCurrentChapter(nextChapter);
            
            if (viewMode === 'continuous') {
                // Scroll to the chapter in continuous mode
                scrollToChapter(nextChapter);
            }
        }
    };

    const goToPrevChapter = () => {
        if (currentChapter > 0) {
            const prevChapter = currentChapter - 1;
            setCurrentChapter(prevChapter);
            
            if (viewMode === 'continuous') {
                // Scroll to the chapter in continuous mode
                scrollToChapter(prevChapter);
            }
        }
    };

    const scrollToChapter = (chapterIndex: number) => {
        if (scrollViewRef.current && chapterRefs.current[chapterIndex] !== undefined) {
            scrollViewRef.current.scrollTo({
                y: chapterRefs.current[chapterIndex],
                animated: true
            });
        }
    };

    const handleChapterLayout = (chapterIndex: number, event: any) => {
        chapterRefs.current[chapterIndex] = event.nativeEvent.layout.y;
    };

    const toggleViewMode = () => {
        setViewMode(viewMode === 'continuous' ? 'paginated' : 'continuous');
        setCurrentChapter(0); // Reset to first chapter when switching modes
    };

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorTitle}>Failed to Load EPUB</Text>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading EPUB...</Text>
                <Text style={styles.loadingSubtext}>{loadingMessage}</Text>
                <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${loadingProgress}%` }]} />
                </View>
                <Text style={styles.progressText}>{Math.round(loadingProgress)}%</Text>
            </View>
        );
    }

    if (!epubContent) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorTitle}>No EPUB Content</Text>
                <Text style={styles.errorText}>Failed to extract EPUB content</Text>
            </View>
        );
    }

    return (
        <DocumentErrorBoundary>
            <View style={styles.container}>
                {/* Header with book info */}
                <View style={styles.header}>
                    <View style={styles.bookInfo}>
                        <Text style={styles.bookTitle}>
                            {epubContent.metadata.title || doc.name || 'Unknown Title'}
                        </Text>
                        {epubContent.metadata.author && (
                            <Text style={styles.bookAuthor}>by {epubContent.metadata.author}</Text>
                        )}
                    </View>
                    <View style={styles.controls}>
                        <TouchableOpacity
                            style={styles.viewModeButton}
                            onPress={toggleViewMode}
                        >
                            <Text style={styles.viewModeButtonText}>
                                {viewMode === 'continuous' ? '📖 Page' : '📜 Scroll'}
                            </Text>
                        </TouchableOpacity>
                        {epubContent.tableOfContents.length > 0 && (
                            <Text style={styles.chapterInfo}>
                                Chapter {currentChapter + 1} / {epubContent.tableOfContents.length}
                            </Text>
                        )}
                    </View>
                </View>

                {/* Content Area */}
                <ScrollView 
                    ref={scrollViewRef}
                    style={styles.contentContainer} 
                    showsVerticalScrollIndicator={true}
                >
                    <View style={styles.contentWrapper}>
                        {viewMode === 'continuous' ? (
                            Platform.OS === 'web' ? (
                                <div
                                    ref={contentContainerRef}
                                    style={{
                                        padding: 20,
                                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                        fontSize: '18px',
                                        lineHeight: '1.6',
                                        maxWidth: '100%',
                                        wordWrap: 'break-word',
                                        pointerEvents: 'auto',
                                        userSelect: 'text',
                                        WebkitUserSelect: 'text',
                                        msUserSelect: 'text',
                                        MozUserSelect: 'text',
                                        WebkitTouchCallout: 'default',
                                        cursor: 'text'
                                    }}
                                    dangerouslySetInnerHTML={{ __html: epubContent.htmlContent }}
                                    onPointerDown={onContentPointerDown}
                                    onPointerMove={onContentPointerMove}
                                    onPointerUp={(e: any) => onContentPointerUp(e)}
                                />
                            ) : (
                                <Text style={styles.contentText}>
                                    {epubContent.htmlContent.replace(/<[^>]*>/g, '')}
                                </Text>
                            )
                        ) : (
                            chapterContents[currentChapter] && (
                                Platform.OS === 'web' ? (
                                    <div
                                        ref={contentContainerRef}
                                        style={{
                                            padding: 20,
                                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                            fontSize: '18px',
                                            lineHeight: '1.6',
                                            maxWidth: '100%',
                                            wordWrap: 'break-word',
                                            minHeight: '80vh',
                                            pointerEvents: 'auto',
                                            userSelect: 'text',
                                            WebkitUserSelect: 'text',
                                            msUserSelect: 'text',
                                            MozUserSelect: 'text',
                                            WebkitTouchCallout: 'default',
                                            cursor: 'text'
                                        }}
                                        dangerouslySetInnerHTML={{ __html: chapterContents[currentChapter] }}
                                        onPointerDown={onContentPointerDown}
                                        onPointerMove={onContentPointerMove}
                                        onPointerUp={(e: any) => onContentPointerUp(e)}
                                    />
                                ) : (
                                    <Text style={styles.contentText}>
                                        {chapterContents[currentChapter]?.replace(/<[^>]*>/g, '')}
                                    </Text>
                                )
                            )
                        )}
                    </View>
                </ScrollView>

                {/* Navigation Controls */}
                {epubContent.tableOfContents.length > 0 && (
                    <View style={styles.navigation}>
                        <TouchableOpacity 
                            style={[styles.navButton, currentChapter === 0 && styles.navButtonDisabled]} 
                            onPress={goToPrevChapter}
                            disabled={currentChapter === 0}
                        >
                            <Text style={[styles.navButtonText, currentChapter === 0 && styles.navButtonTextDisabled]}>
                                ← {viewMode === 'paginated' ? 'Previous Chapter' : 'Scroll Up'}
                            </Text>
                        </TouchableOpacity>
                        <View style={styles.navigationInfo}>
                            <Text style={styles.navigationText}>
                                {viewMode === 'continuous' ? 'Continuous Scroll' : `Page ${currentChapter + 1} of ${chapterContents.length}`}
                            </Text>
                        </View>
                        <TouchableOpacity 
                            style={[styles.navButton, currentChapter >= epubContent.tableOfContents.length - 1 && styles.navButtonDisabled]} 
                            onPress={goToNextChapter}
                            disabled={currentChapter >= epubContent.tableOfContents.length - 1}
                        >
                            <Text style={[styles.navButtonText, currentChapter >= epubContent.tableOfContents.length - 1 && styles.navButtonTextDisabled]}>
                                {viewMode === 'paginated' ? 'Next Chapter' : 'Scroll Down'} →
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Annotation Panel Overlay */}
                <Modal
                    visible={annotationPanelVisible}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={closeAnnotationPanel}
                >
                    <View
                        style={styles.annotationOverlay}
                        onStartShouldSetResponder={() => true}
                        onResponderRelease={() => {
                            saveAnnotationIfAny();
                            closeAnnotationPanel();
                        }}
                    >
                        <View
                            ref={annotationPanelRef}
                            style={styles.annotationPanel}
                            onStartShouldSetResponder={() => true}
                        >
                            <View style={styles.annotationHeader}>
                                <Text style={styles.annotationTitle}>Highlight & Annotations</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <TouchableOpacity onPress={closeAnnotationPanel}>
                                        <Text style={styles.closeButton}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => { saveAnnotationIfAny(); closeAnnotationPanel(); }}>
                                        <Text style={[styles.closeButton, { marginLeft: 16 }]}>Save</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {selectedHighlight && (
                                <View style={styles.annotationContent}>
                                    <View style={styles.highlightedTextContainer}>
                                        <Text style={styles.highlightedTextLabel}>Selected Text:</Text>
                                        <View style={styles.highlightedTextBox}>
                                            <Text style={styles.highlightedText}>"{selectedHighlight.text}"</Text>
                                        </View>
                                    </View>

                                    <View style={styles.annotationsSection}>
                                        <Text style={styles.annotationsLabel}>Previous Annotations:</Text>
                                        <View style={styles.annotationsList}>
                                            <Text style={styles.noAnnotations}>No previous annotations</Text>
                                        </View>
                                    </View>

                                    <View style={styles.newAnnotationSection}>
                                        <Text style={styles.newAnnotationLabel}>Add Annotation:</Text>
                                        <TextInput
                                            style={styles.annotationInput}
                                            value={newAnnotation}
                                            onChangeText={setNewAnnotation}
                                            placeholder="Type your annotation here..."
                                            multiline={true}
                                            numberOfLines={3}
                                            onKeyPress={(e: any) => {
                                                const key = e?.nativeEvent?.key;
                                                if (key === 'Enter' || key === 'Return') {
                                                    saveAnnotationIfAny();
                                                    closeAnnotationPanel();
                                                }
                                            }}
                                            blurOnSubmit={false}
                                            onSubmitEditing={() => {
                                                saveAnnotationIfAny();
                                                closeAnnotationPanel();
                                            }}
                                        />
                                        <TouchableOpacity
                                            style={[styles.saveButton, !newAnnotation.trim() && { opacity: 0.6 }]}
                                            onPress={() => { saveAnnotationIfAny(); closeAnnotationPanel(); }}
                                            disabled={!newAnnotation.trim()}
                                        >
                                            <Text style={styles.saveButtonText}>Save Annotation</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                </Modal>
            </View>
        </DocumentErrorBoundary>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f8f9fa',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    bookInfo: {
        flex: 1,
    },
    bookTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    bookAuthor: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    chapterInfo: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    viewModeButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        marginRight: 12,
    },
    viewModeButtonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    contentContainer: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    contentWrapper: {
        flex: 1,
    },
    contentText: {
        fontSize: 16,
        lineHeight: 24,
        color: '#333',
        padding: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        padding: 20,
    },
    loadingText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    loadingSubtext: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 20,
    },
    progressBar: {
        width: 200,
        height: 8,
        backgroundColor: '#e0e0e0',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 10,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#007AFF',
    },
    progressText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    navigation: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f8f9fa',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    navigationInfo: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    navigationText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
        textAlign: 'center',
    },
    navButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        minWidth: 100,
        alignItems: 'center',
    },
    navButtonDisabled: {
        backgroundColor: '#cccccc',
    },
    navButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    navButtonTextDisabled: {
        color: '#999999',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        backgroundColor: '#f5f5f5',
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#d32f2f',
        marginBottom: 16,
        textAlign: 'center',
    },
    errorText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 12,
    },
    errorSubtext: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
    // Annotation Panel Styles
    annotationOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    annotationPanel: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '70%',
        minHeight: 300,
    },
    annotationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    annotationTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    closeButton: {
        fontSize: 24,
        color: '#666',
        fontWeight: 'bold',
    },
    annotationContent: {
        padding: 20,
    },
    highlightedTextContainer: {
        marginBottom: 20,
    },
    highlightedTextLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    highlightedTextBox: {
        backgroundColor: '#fff0fd',
        borderLeftWidth: 4,
        borderLeftColor: 'hotpink',
        padding: 12,
        borderRadius: 8,
    },
    highlightedText: {
        fontSize: 16,
        color: '#333',
        fontStyle: 'italic',
        lineHeight: 24,
    },
    annotationsSection: {
        marginBottom: 20,
    },
    annotationsLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    annotationsList: {
        minHeight: 40,
        padding: 12,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    noAnnotations: {
        fontSize: 14,
        color: '#999',
        fontStyle: 'italic',
        textAlign: 'center',
    },
    newAnnotationSection: {
        marginTop: 10,
    },
    newAnnotationLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    annotationInput: {
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#333',
        minHeight: 80,
        textAlignVertical: 'top',
        marginBottom: 12,
    },
    saveButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: 'center',
    },
    saveButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});
