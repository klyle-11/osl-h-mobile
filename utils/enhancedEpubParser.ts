import { Observable, from, map, switchMap, tap, catchError, of, BehaviorSubject } from 'rxjs';
import JSZip from 'jszip';

export interface EPUBChapter {
    id: string;
    title: string;
    content: EPUBElement[];
    pageBreakBefore?: boolean;
    pageBreakAfter?: boolean;
}

export interface EPUBElement {
    type: 'heading' | 'paragraph' | 'blockquote' | 'list' | 'list-item' | 'page-break' | 'footnote' | 'image' | 'div';
    level?: number; // For headings (1-6)
    content: string | EPUBElement[];
    id?: string;
    className?: string;
    footnoteRef?: string;
    href?: string; // For footnote links
    src?: string; // For images
    style?: { [key: string]: string };
}

export interface EPUBTableOfContents {
    id: string;
    title: string;
    href: string;
    level: number;
    children?: EPUBTableOfContents[];
}

export interface EnhancedEPUBContent {
    title: string;
    author: string;
    chapters: EPUBChapter[];
    tableOfContents: EPUBTableOfContents[];
    footnotes: { [id: string]: string };
    pageBreaks: number[]; // Character positions of page breaks
}

export interface EPUBParseProgress {
    stage: 'loading' | 'extracting-structure' | 'parsing-toc' | 'parsing-content' | 'processing-formatting' | 'complete' | 'error';
    message: string;
    progress: number; // 0-100
    chaptersProcessed?: number;
    totalChapters?: number;
}

class EnhancedEPUBParser {
    private progressSubject = new BehaviorSubject<EPUBParseProgress>({
        stage: 'loading',
        message: 'Starting enhanced EPUB parsing...',
        progress: 0
    });

    public progress$ = this.progressSubject.asObservable();

    parseEPUB(arrayBuffer: ArrayBuffer): Observable<EnhancedEPUBContent> {
        this.progressSubject.next({
            stage: 'loading',
            message: 'Loading EPUB file...',
            progress: 10
        });

        return from(JSZip.loadAsync(arrayBuffer)).pipe(
            tap(() => this.progressSubject.next({
                stage: 'extracting-structure',
                message: 'Extracting EPUB structure...',
                progress: 20
            })),
            switchMap(zip => this.extractEPUBStructure(zip)),
            switchMap(({ zip, metadata, manifestItems, spineIds, tocPath }) => 
                this.parseTableOfContents(zip, metadata, tocPath).pipe(
                    map(tableOfContents => ({ zip, metadata, manifestItems, spineIds, tableOfContents }))
                )
            ),
            switchMap(({ zip, metadata, manifestItems, spineIds, tableOfContents }) => 
                this.processEnhancedContent(zip, metadata, manifestItems, spineIds, tableOfContents)
            ),
            tap(() => this.progressSubject.next({
                stage: 'complete',
                message: 'Enhanced EPUB parsing complete!',
                progress: 100
            })),
            catchError(error => {
                this.progressSubject.next({
                    stage: 'error',
                    message: `Error: ${error.message}`,
                    progress: 0
                });
                throw error;
            })
        );
    }

    private extractEPUBStructure(zip: JSZip): Observable<{
        zip: JSZip;
        metadata: { title: string; author: string; opfDir: string };
        manifestItems: { [key: string]: string };
        spineIds: string[];
        tocPath?: string;
    }> {
        return from(zip.file('META-INF/container.xml')?.async('text') || Promise.resolve(null)).pipe(
            switchMap(containerXml => {
                if (!containerXml) {
                    throw new Error('Invalid EPUB: No container.xml found');
                }

                const containerMatch = containerXml.match(/full-path="([^"]+)"/);
                if (!containerMatch) {
                    throw new Error('Invalid EPUB: No OPF file path found');
                }

                const opfPath = containerMatch[1];
                return from(zip.file(opfPath)?.async('text') || Promise.resolve(null)).pipe(
                    map(opfFile => {
                        if (!opfFile) {
                            throw new Error(`Invalid EPUB: OPF file not found at ${opfPath}`);
                        }

                        // Extract metadata
                        const titleMatch = opfFile.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/);
                        const authorMatch = opfFile.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/);
                        
                        const title = titleMatch ? titleMatch[1] : 'Unknown Title';
                        const author = authorMatch ? authorMatch[1] : 'Unknown Author';
                        const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);

                        // Extract spine
                        const spineMatches = opfFile.match(/<itemref[^>]*idref="([^"]+)"/g);
                        const spineIds = spineMatches ? spineMatches.map(match => {
                            const idMatch = match.match(/idref="([^"]+)"/);
                            return idMatch ? idMatch[1] : null;
                        }).filter(id => id !== null) as string[] : [];

                        // Extract manifest
                        const manifestItems: { [key: string]: string } = {};
                        const manifestMatches = opfFile.match(/<item[^>]*>/g);
                        
                        let tocPath: string | undefined;
                        
                        if (manifestMatches) {
                            manifestMatches.forEach(match => {
                                const idMatch = match.match(/id=["']([^"']+)["']/);
                                const hrefMatch = match.match(/href=["']([^"']+)["']/);
                                const mediaTypeMatch = match.match(/media-type=["']([^"']+)["']/);
                                
                                if (idMatch && hrefMatch) {
                                    manifestItems[idMatch[1]] = hrefMatch[1];
                                    
                                    // Look for table of contents file
                                    if (mediaTypeMatch && 
                                        (mediaTypeMatch[1] === 'application/x-dtbncx+xml' || 
                                         idMatch[1].toLowerCase().includes('toc') ||
                                         hrefMatch[1].toLowerCase().includes('toc'))) {
                                        tocPath = hrefMatch[1];
                                    }
                                }
                            });
                        }

                        return {
                            zip,
                            metadata: { title, author, opfDir },
                            manifestItems,
                            spineIds,
                            tocPath
                        };
                    })
                );
            }),
            tap(() => this.progressSubject.next({
                stage: 'parsing-toc',
                message: 'Parsing table of contents...',
                progress: 30
            }))
        );
    }

    private parseTableOfContents(
        zip: JSZip, 
        metadata: { title: string; author: string; opfDir: string },
        tocPath?: string
    ): Observable<EPUBTableOfContents[]> {
        if (!tocPath) {
            return of([]);
        }

        const fullTocPath = metadata.opfDir + tocPath;
        return from(zip.file(fullTocPath)?.async('text') || Promise.resolve(null)).pipe(
            map(tocContent => {
                if (!tocContent) {
                    return [];
                }

                const toc: EPUBTableOfContents[] = [];
                
                // Parse NCX format (EPUB 2)
                if (tocContent.includes('<navMap>')) {
                    const navPointMatches = tocContent.match(/<navPoint[^>]*>[\s\S]*?<\/navPoint>/g);
                    if (navPointMatches) {
                        navPointMatches.forEach((navPoint, index) => {
                            const idMatch = navPoint.match(/id=["']([^"']+)["']/);
                            const titleMatch = navPoint.match(/<text[^>]*>([^<]+)<\/text>/);
                            const hrefMatch = navPoint.match(/<content[^>]*src=["']([^"'#]+)/);
                            
                            if (titleMatch && hrefMatch) {
                                toc.push({
                                    id: idMatch ? idMatch[1] : `toc-${index}`,
                                    title: titleMatch[1].trim(),
                                    href: hrefMatch[1],
                                    level: 1
                                });
                            }
                        });
                    }
                }
                
                // Parse XHTML format (EPUB 3)
                else if (tocContent.includes('<nav')) {
                    const listItemMatches = tocContent.match(/<li[^>]*>[\s\S]*?<\/li>/g);
                    if (listItemMatches) {
                        listItemMatches.forEach((listItem, index) => {
                            const linkMatch = listItem.match(/<a[^>]*href=["']([^"'#]+)[^"']*["'][^>]*>([^<]+)<\/a>/);
                            if (linkMatch) {
                                toc.push({
                                    id: `toc-${index}`,
                                    title: linkMatch[2].trim(),
                                    href: linkMatch[1],
                                    level: 1
                                });
                            }
                        });
                    }
                }

                return toc;
            }),
            catchError(() => of([]))
        );
    }

    private processEnhancedContent(
        zip: JSZip, 
        metadata: { title: string; author: string; opfDir: string },
        manifestItems: { [key: string]: string },
        spineIds: string[],
        tableOfContents: EPUBTableOfContents[]
    ): Observable<EnhancedEPUBContent> {
        const maxChapters = 25; // Limit chapters to prevent performance issues
        const chaptersToProcess = spineIds.slice(0, maxChapters);

        if (chaptersToProcess.length === 0) {
            return of({
                title: metadata.title,
                author: metadata.author,
                chapters: [],
                tableOfContents,
                footnotes: {},
                pageBreaks: []
            });
        }

        this.progressSubject.next({
            stage: 'parsing-content',
            message: 'Processing enhanced content...',
            progress: 40,
            chaptersProcessed: 0,
            totalChapters: chaptersToProcess.length
        });

        return this.processChaptersSequentially(
            zip, 
            metadata, 
            manifestItems, 
            chaptersToProcess, 
            tableOfContents,
            0, 
            [], 
            {},
            []
        );
    }

    private processChaptersSequentially(
        zip: JSZip,
        metadata: { title: string; author: string; opfDir: string },
        manifestItems: { [key: string]: string },
        spineIds: string[],
        tableOfContents: EPUBTableOfContents[],
        index: number,
        accumulatedChapters: EPUBChapter[],
        accumulatedFootnotes: { [id: string]: string },
        accumulatedPageBreaks: number[]
    ): Observable<EnhancedEPUBContent> {
        if (index >= spineIds.length) {
            return of({
                title: metadata.title,
                author: metadata.author,
                chapters: accumulatedChapters,
                tableOfContents,
                footnotes: accumulatedFootnotes,
                pageBreaks: accumulatedPageBreaks
            });
        }

        const spineId = spineIds[index];
        const filePath = manifestItems[spineId];
        
        if (!filePath) {
            return this.processChaptersSequentially(
                zip, metadata, manifestItems, spineIds, tableOfContents,
                index + 1, accumulatedChapters, accumulatedFootnotes, accumulatedPageBreaks
            );
        }

        const fullPath = metadata.opfDir + filePath;
        
        return from(zip.file(fullPath)?.async('text') || Promise.resolve(null)).pipe(
            map(fileContent => {
                let chapter: EPUBChapter | null = null;
                let footnotes: { [id: string]: string } = {};
                
                if (fileContent) {
                    const { chapter: parsedChapter, footnotes: extractedFootnotes } = 
                        this.parseHTMLToStructuredContent(fileContent, spineId, filePath);
                    chapter = parsedChapter;
                    footnotes = extractedFootnotes;
                }
                
                const newChapters = chapter ? [...accumulatedChapters, chapter] : accumulatedChapters;
                const newFootnotes = { ...accumulatedFootnotes, ...footnotes };
                
                return { newChapters, newFootnotes };
            }),
            tap(() => {
                const progress = 40 + Math.round((index + 1) / spineIds.length * 50);
                this.progressSubject.next({
                    stage: 'processing-formatting',
                    message: `Processing chapter ${index + 1} of ${spineIds.length}...`,
                    progress,
                    chaptersProcessed: index + 1,
                    totalChapters: spineIds.length
                });
            }),
            switchMap(({ newChapters, newFootnotes }) => 
                this.processChaptersSequentially(
                    zip, metadata, manifestItems, spineIds, tableOfContents,
                    index + 1, newChapters, newFootnotes, accumulatedPageBreaks
                )
            ),
            catchError(() => 
                this.processChaptersSequentially(
                    zip, metadata, manifestItems, spineIds, tableOfContents,
                    index + 1, accumulatedChapters, accumulatedFootnotes, accumulatedPageBreaks
                )
            )
        );
    }

    private parseHTMLToStructuredContent(html: string, chapterId: string, filePath: string): {
        chapter: EPUBChapter;
        footnotes: { [id: string]: string };
    } {
        const footnotes: { [id: string]: string } = {};
        
        // Extract title from file path or first heading
        let chapterTitle = filePath.replace(/.*\//, '').replace(/\.(html|xhtml|htm)$/, '');
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
            chapterTitle = titleMatch[1];
        } else {
            const headingMatch = html.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i);
            if (headingMatch) {
                chapterTitle = headingMatch[1];
            }
        }

        // Remove unwanted elements
        let cleanHtml = html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<meta[^>]*>/gi, '')
            .replace(/<link[^>]*>/gi, '');

        // Extract footnotes
        const footnoteMatches = cleanHtml.match(/<div[^>]*class="footnote"[^>]*>[\s\S]*?<\/div>/gi);
        if (footnoteMatches) {
            footnoteMatches.forEach(footnoteHtml => {
                const idMatch = footnoteHtml.match(/id=["']([^"']+)["']/);
                const textMatch = footnoteHtml.match(/>([^<]+)</);
                if (idMatch && textMatch) {
                    footnotes[idMatch[1]] = textMatch[1].trim();
                }
            });
            
            // Remove footnotes from main content
            cleanHtml = cleanHtml.replace(/<div[^>]*class="footnote"[^>]*>[\s\S]*?<\/div>/gi, '');
        }

        const elements = this.parseHTMLElements(cleanHtml);

        const chapter: EPUBChapter = {
            id: chapterId,
            title: chapterTitle,
            content: elements,
            pageBreakBefore: html.includes('page-break-before'),
            pageBreakAfter: html.includes('page-break-after')
        };

        return { chapter, footnotes };
    }

    private parseHTMLElements(html: string): EPUBElement[] {
        const elements: EPUBElement[] = [];
        
        // Simple HTML parsing - in production, you'd want a proper HTML parser
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        const content = bodyMatch ? bodyMatch[1] : html;
        
        // Split by major block elements
        const blockPattern = /(<\/?(h[1-6]|p|div|blockquote|ul|ol|li|br)[^>]*>)/gi;
        const parts = content.split(blockPattern);
        
        let currentElement = '';
        let inList = false;
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i].trim();
            if (!part) continue;
            
            // Check if this is a tag
            if (part.match(/^<\/?[^>]+>$/)) {
                const tagMatch = part.match(/^<\/?([^>\s]+)/);
                if (!tagMatch) continue;
                
                const tagName = tagMatch[1].toLowerCase();
                
                if (part.startsWith('</')) {
                    // Closing tag - process accumulated content
                    if (currentElement.trim()) {
                        const element = this.createElementFromTag(tagName, currentElement);
                        if (element) {
                            elements.push(element);
                        }
                    }
                    currentElement = '';
                    
                    if (tagName === 'ul' || tagName === 'ol') {
                        inList = false;
                    }
                } else {
                    // Opening tag
                    if (tagName === 'ul' || tagName === 'ol') {
                        inList = true;
                    } else if (tagName === 'br') {
                        elements.push({ type: 'paragraph', content: '' });
                    } else if (tagName.startsWith('h')) {
                        const level = parseInt(tagName[1]);
                        if (currentElement.trim()) {
                            elements.push({ type: 'heading', level, content: currentElement.trim() });
                            currentElement = '';
                        }
                    }
                }
            } else {
                // Text content
                currentElement += part + ' ';
            }
        }
        
        // Add any remaining content
        if (currentElement.trim()) {
            elements.push({ type: 'paragraph', content: currentElement.trim() });
        }
        
        return elements.filter(el => el.content && el.content.toString().trim());
    }

    private createElementFromTag(tagName: string, content: string): EPUBElement | null {
        const cleanContent = content.replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();

        if (!cleanContent) return null;

        switch (tagName) {
            case 'h1': return { type: 'heading', level: 1, content: cleanContent };
            case 'h2': return { type: 'heading', level: 2, content: cleanContent };
            case 'h3': return { type: 'heading', level: 3, content: cleanContent };
            case 'h4': return { type: 'heading', level: 4, content: cleanContent };
            case 'h5': return { type: 'heading', level: 5, content: cleanContent };
            case 'h6': return { type: 'heading', level: 6, content: cleanContent };
            case 'p': return { type: 'paragraph', content: cleanContent };
            case 'div': return { type: 'div', content: cleanContent };
            case 'blockquote': return { type: 'blockquote', content: cleanContent };
            case 'li': return { type: 'list-item', content: cleanContent };
            default: return { type: 'paragraph', content: cleanContent };
        }
    }
}

export const enhancedEpubParser = new EnhancedEPUBParser();
