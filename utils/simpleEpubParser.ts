import JSZip from 'jszip';
import { BehaviorSubject, Observable } from 'rxjs';

export interface SimpleEPUBContent {
    htmlContent: string;
    tableOfContents: Array<{
        title: string;
        level: number;
        id?: string;
    }>;
    metadata: {
        title?: string;
        author?: string;
        language?: string;
        identifier?: string;
        publisher?: string;
        date?: string;
        description?: string;
    };
}

export interface ParseProgress {
    progress: number;
    message: string;
}

class SimpleEpubParserService {
    private progressSubject = new BehaviorSubject<ParseProgress>({ progress: 0, message: 'Starting...' });
    public progress$ = this.progressSubject.asObservable();

    parseEPUB(arrayBuffer: ArrayBuffer): Observable<SimpleEPUBContent> {
        return new Observable<SimpleEPUBContent>(observer => {
            this.parseEPUBInternal(arrayBuffer)
                .then(result => {
                    observer.next(result);
                    observer.complete();
                })
                .catch(error => {
                    observer.error(error);
                });
        });
    }

    private async parseEPUBInternal(arrayBuffer: ArrayBuffer): Promise<SimpleEPUBContent> {
        try {
            this.progressSubject.next({ progress: 10, message: 'Loading EPUB file...' });
            
            const zip = await JSZip.loadAsync(arrayBuffer);
            this.progressSubject.next({ progress: 20, message: 'Reading EPUB structure...' });

            // Find and read META-INF/container.xml
            const containerFile = zip.file('META-INF/container.xml');
            if (!containerFile) {
                throw new Error('Invalid EPUB: Missing META-INF/container.xml');
            }

            this.progressSubject.next({ progress: 30, message: 'Parsing container...' });
            const containerXml = await containerFile.async('text');
            const parser = new DOMParser();
            const containerDoc = parser.parseFromString(containerXml, 'application/xml');
            
            // Find the OPF file path
            const rootfileElement = containerDoc.querySelector('rootfile');
            if (!rootfileElement) {
                throw new Error('Invalid EPUB: No rootfile found in container.xml');
            }
            
            const opfPath = rootfileElement.getAttribute('full-path');
            if (!opfPath) {
                throw new Error('Invalid EPUB: No full-path in rootfile');
            }

            this.progressSubject.next({ progress: 40, message: 'Reading package file...' });
            
            // Read the OPF file
            const opfFile = zip.file(opfPath);
            if (!opfFile) {
                throw new Error(`Invalid EPUB: OPF file not found at ${opfPath}`);
            }
            
            const opfXml = await opfFile.async('text');
            const opfDoc = parser.parseFromString(opfXml, 'application/xml');
            
            // Extract metadata
            const metadata = this.extractMetadata(opfDoc);
            this.progressSubject.next({ progress: 50, message: 'Extracting metadata...' });
            
            // Get the directory containing the OPF file
            const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
            
            // Find spine items (reading order)
            const spineItems = Array.from(opfDoc.querySelectorAll('spine itemref')).map(item => 
                item.getAttribute('idref')
            ).filter(Boolean);
            
            this.progressSubject.next({ progress: 60, message: 'Reading content files...' });
            
            // Get manifest items
            const manifestItems = new Map<string, string>();
            opfDoc.querySelectorAll('manifest item').forEach(item => {
                const id = item.getAttribute('id');
                const href = item.getAttribute('href');
                if (id && href) {
                    manifestItems.set(id, href);
                }
            });
            
            // Extract HTML content from spine files
            let allHtmlContent = '';
            const tableOfContents: Array<{ title: string; level: number; id?: string }> = [];
            
            for (let i = 0; i < spineItems.length; i++) {
                const spineItemId = spineItems[i];
                if (!spineItemId) continue;
                
                const href = manifestItems.get(spineItemId);
                if (!href) continue;
                
                const fullPath = opfDir + href;
                const contentFile = zip.file(fullPath);
                
                if (contentFile) {
                    this.progressSubject.next({ 
                        progress: 60 + (i / spineItems.length) * 30, 
                        message: `Processing content ${i + 1} of ${spineItems.length}...` 
                    });
                    
                    const htmlContent = await contentFile.async('text');
                    
                    // Parse HTML to extract body content and table of contents
                    const htmlDoc = parser.parseFromString(htmlContent, 'text/html');
                    const bodyElement = htmlDoc.querySelector('body');
                    
                    if (bodyElement) {
                        // Extract headers for table of contents
                        const headers = bodyElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
                        headers.forEach(header => {
                            const level = parseInt(header.tagName.charAt(1));
                            const title = header.textContent?.trim() || '';
                            const id = header.getAttribute('id');
                            
                            if (title) {
                                tableOfContents.push({ title, level, id: id || undefined });
                            }
                        });
                        
                        // Add the HTML content with proper structure preservation
                        allHtmlContent += bodyElement.innerHTML + '\n\n';
                    } else {
                        // If no body element, try to extract content from the HTML
                        const cleanHtml = htmlContent.replace(/<head[\s\S]*?<\/head>/gi, '').replace(/<html[^>]*>|<\/html>|<body[^>]*>|<\/body>/gi, '');
                        allHtmlContent += cleanHtml + '\n\n';
                    }
                }
            }
            
            this.progressSubject.next({ progress: 95, message: 'Finalizing content...' });
            
            // Clean up HTML content while preserving structure
            allHtmlContent = this.cleanHtmlContent(allHtmlContent);
            
            this.progressSubject.next({ progress: 100, message: 'Complete!' });
            
            return {
                htmlContent: allHtmlContent,
                tableOfContents,
                metadata
            };
            
        } catch (error) {
            console.error('EPUB parsing error:', error);
            this.progressSubject.next({ progress: 0, message: 'Error occurred' });
            throw error instanceof Error ? error : new Error('Unknown parsing error');
        }
    }
    
    private extractMetadata(opfDoc: Document): SimpleEPUBContent['metadata'] {
        const metadata: SimpleEPUBContent['metadata'] = {};
        
        // Extract common metadata fields with proper namespace handling
        const titleElement = opfDoc.querySelector('metadata title, title');
        if (titleElement) metadata.title = titleElement.textContent?.trim();
        
        const authorElement = opfDoc.querySelector('metadata creator, creator');
        if (authorElement) metadata.author = authorElement.textContent?.trim();
        
        const languageElement = opfDoc.querySelector('metadata language, language');
        if (languageElement) metadata.language = languageElement.textContent?.trim();
        
        const identifierElement = opfDoc.querySelector('metadata identifier, identifier');
        if (identifierElement) metadata.identifier = identifierElement.textContent?.trim();
        
        const publisherElement = opfDoc.querySelector('metadata publisher, publisher');
        if (publisherElement) metadata.publisher = publisherElement.textContent?.trim();
        
        const dateElement = opfDoc.querySelector('metadata date, date');
        if (dateElement) metadata.date = dateElement.textContent?.trim();
        
        const descriptionElement = opfDoc.querySelector('metadata description, description');
        if (descriptionElement) metadata.description = descriptionElement.textContent?.trim();
        
        return metadata;
    }
    
    private cleanHtmlContent(html: string): string {
        // Minimal cleanup while preserving original formatting
        return html
            .replace(/<p>\s*<\/p>/g, '') // Remove empty paragraphs
            .replace(/<div>\s*<\/div>/g, '') // Remove empty divs
            .replace(/^\s+$/gm, '') // Remove lines that only contain whitespace
            .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines to 2
            .trim();
    }
}

// Export a singleton instance
export const simpleEpubParser = new SimpleEpubParserService();
