import JSZip from 'jszip';

export interface EPUBContent {
    title: string;
    author: string;
    content: string;
}

export const parseEPUB = async (arrayBuffer: ArrayBuffer): Promise<EPUBContent> => {
    try {
        console.log('Starting EPUB parsing, buffer size:', arrayBuffer.byteLength);
        const zip = await JSZip.loadAsync(arrayBuffer);
        console.log('ZIP loaded successfully, files:', Object.keys(zip.files).length);
        
        // First, get the container.xml to find the OPF file
        const containerXml = await zip.file('META-INF/container.xml')?.async('text');
        if (!containerXml) {
            throw new Error('Invalid EPUB: No container.xml found');
        }
        console.log('Container.xml found and loaded');

        // Parse container.xml to find OPF file path
        const containerMatch = containerXml.match(/full-path="([^"]+)"/);
        if (!containerMatch) {
            throw new Error('Invalid EPUB: No OPF file path found in container.xml');
        }

        const opfPath = containerMatch[1];
        console.log('OPF path found:', opfPath);
        const opfFile = await zip.file(opfPath)?.async('text');
        if (!opfFile) {
            throw new Error('Invalid EPUB: OPF file not found at path: ' + opfPath);
        }
        console.log('OPF file loaded successfully');

        // Extract metadata
        const titleMatch = opfFile.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/);
        const authorMatch = opfFile.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/);
        
        const title = titleMatch ? titleMatch[1] : 'Unknown Title';
        const author = authorMatch ? authorMatch[1] : 'Unknown Author';
        console.log('Extracted metadata - Title:', title, 'Author:', author);

        // Get the directory of the OPF file
        const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);

        // Extract spine order
        const spineMatches = opfFile.match(/<itemref[^>]*idref="([^"]+)"/g);
        if (!spineMatches) {
            console.log('No spine found, will use alternative approach');
        }

        const spineIds = spineMatches ? spineMatches.map(match => {
            const idMatch = match.match(/idref="([^"]+)"/);
            return idMatch ? idMatch[1] : null;
        }).filter(id => id !== null) : [];
        console.log('Spine IDs found:', spineIds.length);

        // Map spine IDs to file paths
        const manifestItems: { [key: string]: string } = {};
        
        // Improved manifest parsing - handle multi-line attributes
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
        console.log('Manifest items mapped:', Object.keys(manifestItems).length);

        let fullContent = '';
        
        // Try spine-based extraction first (more efficient for well-structured EPUBs)
        if (spineIds.length > 0) {
            console.log('Attempting spine-based extraction...');
            let processedCount = 0;
            
            for (const spineId of spineIds.slice(0, 20)) { // Limit to first 20 chapters to avoid freezing
                const filePath = manifestItems[spineId];
                if (filePath) {
                    const fullPath = opfDir + filePath;
                    console.log(`Processing spine item ${++processedCount}/${Math.min(spineIds.length, 20)}: ${fullPath}`);
                    const fileContent = await zip.file(fullPath)?.async('text');
                    if (fileContent) {
                        // Enhanced HTML to text conversion with better formatting preservation
                        let textContent = fileContent
                            // Remove style and script tags with their content
                            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                            
                            // Preserve structural elements with proper formatting
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
                            
                            // Handle line breaks and page breaks
                            .replace(/<br\s*\/?>/gi, '\n')
                            .replace(/<div[^>]*page-break[^>]*>/gi, '\n[PAGE BREAK]\n')
                            
                            // Remove all remaining HTML tags
                            .replace(/<[^>]+>/g, ' ')
                            
                            // Handle HTML entities including common typography
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
                            .replace(/&#8230;/g, '…')
                            
                            // Clean up whitespace while preserving structure
                            .replace(/[ \t]+/g, ' ')
                            .replace(/\n[ \t]+/g, '\n')
                            .replace(/[ \t]+\n/g, '\n')
                            .replace(/\n{3,}/g, '\n\n')
                            .trim();
                        
                        if (textContent && textContent.length > 10) {
                            fullContent += textContent + '\n\n';
                            console.log(`Added ${textContent.length} characters from ${fullPath}`);
                        } else {
                            console.log(`Skipped ${fullPath} - no meaningful content (length: ${textContent.length})`);
                        }
                        
                        // Add small delay to prevent UI freezing
                        if (processedCount % 5 === 0) {
                            await new Promise(resolve => setTimeout(resolve, 10));
                        }
                    } else {
                        console.log(`Could not read file content for ${fullPath}`);
                    }
                }
            }
            
            if (spineIds.length > 20) {
                fullContent += `\n\n[Content truncated - showing first 20 chapters of ${spineIds.length} total chapters to improve performance]`;
            }
        }

        // Fallback approach if spine extraction didn't work or found minimal content
        if (fullContent.trim().length < 500) {
            console.log('Limited content found via spine, trying alternative approach...');
            
            // Alternative approach: Look for all HTML/XHTML files, prioritize text/ directory
            const htmlFiles = Object.keys(zip.files)
                .filter(filename => 
                    filename.match(/\.(html|xhtml|htm)$/i) && 
                    !filename.startsWith('__MACOSX') &&
                    !filename.includes('jacket') &&
                    !filename.includes('cover') &&
                    !filename.includes('titlepage')
                )
                .sort()
                .slice(0, 15); // Limit to first 15 files to prevent freezing
            
            console.log('Found HTML files for alternative extraction:', htmlFiles.length);
            
            let processedCount = 0;
            for (const filename of htmlFiles) {
                console.log(`Processing alternative file ${++processedCount}/${htmlFiles.length}: ${filename}`);
                const fileContent = await zip.file(filename)?.async('text');
                if (fileContent) {
                    let textContent = fileContent
                        // Enhanced formatting preservation
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
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
                        .replace(/<div[^>]*page-break[^>]*>/gi, '\n[PAGE BREAK]\n')
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
                    
                    if (textContent && textContent.length > 10) {
                        fullContent += textContent + '\n\n';
                        console.log(`Alternative extraction: Added ${textContent.length} characters from ${filename}`);
                    }
                    
                    // Add delay every few files
                    if (processedCount % 3 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 10));
                    }
                }
            }
            
            if (htmlFiles.length === 15 && Object.keys(zip.files).filter(f => f.match(/\.(html|xhtml|htm)$/i)).length > 15) {
                fullContent += '\n\n[Content truncated for performance - showing first 15 HTML files]';
            }
        }

        if (!fullContent.trim()) {
            // Last resort: show file structure for debugging
            const fileList = Object.keys(zip.files)
                .filter(name => !name.endsWith('/'))
                .slice(0, 20)
                .join(', ');
            throw new Error(`No readable text content found in EPUB file. Files found: ${fileList}${Object.keys(zip.files).length > 20 ? '...' : ''}`);
        }

        console.log('EPUB parsing completed successfully, content length:', fullContent.length);
        return {
            title,
            author,
            content: fullContent.trim()
        };
    } catch (error) {
        console.error('Error parsing EPUB:', error);
        throw error;
    }
};
