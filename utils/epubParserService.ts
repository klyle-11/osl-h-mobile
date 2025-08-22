import { Observable, from, map, switchMap, tap, catchError, of, BehaviorSubject, combineLatest } from 'rxjs';
import JSZip from 'jszip';

export interface EPUBContent {
    title: string;
    author: string;
    content: string;
}

export interface EPUBParseProgress {
    stage: 'loading' | 'extracting-structure' | 'parsing-content' | 'processing-files' | 'complete' | 'error';
    message: string;
    progress: number; // 0-100
    filesProcessed?: number;
    totalFiles?: number;
}

class EPUBParserService {
    private progressSubject = new BehaviorSubject<EPUBParseProgress>({
        stage: 'loading',
        message: 'Starting EPUB parsing...',
        progress: 0
    });

    public progress$ = this.progressSubject.asObservable();

    parseEPUB(arrayBuffer: ArrayBuffer): Observable<EPUBContent> {
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
            switchMap(({ zip, metadata, manifestItems, spineIds }) => 
                this.processContent(zip, metadata, manifestItems, spineIds)
            ),
            tap(() => this.progressSubject.next({
                stage: 'complete',
                message: 'EPUB parsing complete!',
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
                        
                        if (manifestMatches) {
                            manifestMatches.forEach(match => {
                                const idMatch = match.match(/id=["']([^"']+)["']/);
                                const hrefMatch = match.match(/href=["']([^"']+)["']/);
                                if (idMatch && hrefMatch) {
                                    manifestItems[idMatch[1]] = hrefMatch[1];
                                }
                            });
                        }

                        return {
                            zip,
                            metadata: { title, author, opfDir },
                            manifestItems,
                            spineIds
                        };
                    })
                );
            }),
            tap(() => this.progressSubject.next({
                stage: 'parsing-content',
                message: 'Parsing content structure...',
                progress: 40
            }))
        );
    }

    private processContent(
        zip: JSZip, 
        metadata: { title: string; author: string; opfDir: string },
        manifestItems: { [key: string]: string },
        spineIds: string[]
    ): Observable<EPUBContent> {
        const maxFiles = 20; // Limit files to prevent performance issues
        const filesToProcess = spineIds.slice(0, maxFiles);

        if (filesToProcess.length === 0) {
            return this.fallbackExtraction(zip, metadata);
        }

        this.progressSubject.next({
            stage: 'processing-files',
            message: 'Processing content files...',
            progress: 50,
            filesProcessed: 0,
            totalFiles: filesToProcess.length
        });

        return this.processFilesSequentially(zip, metadata, manifestItems, filesToProcess, 0, '');
    }

    private processFilesSequentially(
        zip: JSZip,
        metadata: { title: string; author: string; opfDir: string },
        manifestItems: { [key: string]: string },
        spineIds: string[],
        index: number,
        accumulatedContent: string
    ): Observable<EPUBContent> {
        if (index >= spineIds.length) {
            const finalContent = accumulatedContent.trim() || 'No readable content found';
            return of({
                title: metadata.title,
                author: metadata.author,
                content: finalContent
            });
        }

        const spineId = spineIds[index];
        const filePath = manifestItems[spineId];
        
        if (!filePath) {
            return this.processFilesSequentially(zip, metadata, manifestItems, spineIds, index + 1, accumulatedContent);
        }

        const fullPath = metadata.opfDir + filePath;
        
        return from(zip.file(fullPath)?.async('text') || Promise.resolve(null)).pipe(
            map(fileContent => {
                let textContent = '';
                if (fileContent) {
                    textContent = this.htmlToText(fileContent);
                }
                return accumulatedContent + (textContent ? textContent + '\n\n' : '');
            }),
            tap(() => {
                const progress = 50 + Math.round((index + 1) / spineIds.length * 40);
                this.progressSubject.next({
                    stage: 'processing-files',
                    message: `Processing file ${index + 1} of ${spineIds.length}...`,
                    progress,
                    filesProcessed: index + 1,
                    totalFiles: spineIds.length
                });
            }),
            switchMap(newAccumulatedContent => 
                this.processFilesSequentially(zip, metadata, manifestItems, spineIds, index + 1, newAccumulatedContent)
            ),
            catchError(() => 
                this.processFilesSequentially(zip, metadata, manifestItems, spineIds, index + 1, accumulatedContent)
            )
        );
    }

    private fallbackExtraction(zip: JSZip, metadata: { title: string; author: string; opfDir: string }): Observable<EPUBContent> {
        this.progressSubject.next({
            stage: 'processing-files',
            message: 'Using alternative content extraction...',
            progress: 60
        });

        const htmlFiles = Object.keys(zip.files)
            .filter(filename => 
                filename.match(/\.(html|xhtml|htm)$/i) && 
                !filename.startsWith('__MACOSX') &&
                !filename.includes('jacket') &&
                !filename.includes('cover') &&
                !filename.includes('titlepage')
            )
            .sort()
            .slice(0, 10); // Limit for performance

        if (htmlFiles.length === 0) {
            return of({
                title: metadata.title,
                author: metadata.author,
                content: 'No readable content found in EPUB file'
            });
        }

        return this.processHtmlFilesSequentially(zip, metadata, htmlFiles, 0, '');
    }

    private processHtmlFilesSequentially(
        zip: JSZip,
        metadata: { title: string; author: string; opfDir: string },
        htmlFiles: string[],
        index: number,
        accumulatedContent: string
    ): Observable<EPUBContent> {
        if (index >= htmlFiles.length) {
            return of({
                title: metadata.title,
                author: metadata.author,
                content: accumulatedContent.trim() || 'No readable content found'
            });
        }

        const filename = htmlFiles[index];

        return from(zip.file(filename)?.async('text') || Promise.resolve(null)).pipe(
            map(fileContent => {
                let textContent = '';
                if (fileContent) {
                    textContent = this.htmlToText(fileContent);
                }
                return accumulatedContent + (textContent ? textContent + '\n\n' : '');
            }),
            tap(() => {
                const progress = 60 + Math.round((index + 1) / htmlFiles.length * 30);
                this.progressSubject.next({
                    stage: 'processing-files',
                    message: `Processing alternative file ${index + 1} of ${htmlFiles.length}...`,
                    progress
                });
            }),
            switchMap(newAccumulatedContent => 
                this.processHtmlFilesSequentially(zip, metadata, htmlFiles, index + 1, newAccumulatedContent)
            )
        );
    }

    private htmlToText(html: string): string {
        return html
            // Remove unwanted elements first
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            
            // Preserve structural elements
            .replace(/<h([1-6])[^>]*>/gi, (match, level) => `\n${'#'.repeat(parseInt(level))} `)
            .replace(/<\/h[1-6]>/gi, '\n\n')
            
            // Handle paragraphs and divs with proper spacing
            .replace(/<p[^>]*>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<div[^>]*>/gi, '\n')
            .replace(/<\/div>/gi, '\n')
            
            // Handle blockquotes
            .replace(/<blockquote[^>]*>/gi, '\n> ')
            .replace(/<\/blockquote>/gi, '\n\n')
            
            // Handle lists
            .replace(/<ul[^>]*>/gi, '\n')
            .replace(/<\/ul>/gi, '\n')
            .replace(/<ol[^>]*>/gi, '\n')
            .replace(/<\/ol>/gi, '\n')
            .replace(/<li[^>]*>/gi, '• ')
            .replace(/<\/li>/gi, '\n')
            
            // Handle line breaks
            .replace(/<br\s*\/?>/gi, '\n')
            
            // Handle page breaks
            .replace(/<div[^>]*page-break[^>]*>/gi, '\n[PAGE BREAK]\n')
            
            // Remove all remaining HTML tags
            .replace(/<[^>]+>/g, ' ')
            
            // Handle HTML entities
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
            
            // Clean up whitespace while preserving intentional line breaks
            .replace(/[ \t]+/g, ' ')
            .replace(/\n[ \t]+/g, '\n')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
}

export const epubParserService = new EPUBParserService();
