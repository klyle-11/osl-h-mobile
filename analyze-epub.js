const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function analyzeEPUB(epubPath) {
    try {
        console.log('Analyzing EPUB:', epubPath);
        
        // Read the EPUB file
        const data = fs.readFileSync(epubPath);
        const zip = await JSZip.loadAsync(data);
        
        console.log('\n=== EPUB File Structure ===');
        const files = Object.keys(zip.files).sort();
        files.forEach(filename => {
            if (!filename.endsWith('/')) {
                console.log(filename);
            }
        });
        
        console.log('\n=== Container.xml ===');
        const containerXml = await zip.file('META-INF/container.xml')?.async('text');
        if (containerXml) {
            console.log(containerXml);
            
            // Find OPF file
            const containerMatch = containerXml.match(/full-path="([^"]+)"/);
            if (containerMatch) {
                const opfPath = containerMatch[1];
                console.log('\n=== OPF File Path ===');
                console.log(opfPath);
                
                const opfFile = await zip.file(opfPath)?.async('text');
                if (opfFile) {
                    console.log('\n=== OPF Content (first 1000 chars) ===');
                    console.log(opfFile.substring(0, 1000));
                    
                    // Extract spine
                    const spineMatches = opfFile.match(/<itemref[^>]*idref="([^"]+)"/g);
                    console.log('\n=== Spine Items ===');
                    if (spineMatches) {
                        spineMatches.forEach(match => console.log(match));
                    }
                    
                    // Extract manifest
                    const manifestMatches = opfFile.match(/<item[^>]*id="([^"]+)"[^>]*href="([^"]+)"/g);
                    console.log('\n=== Manifest Items (first 10) ===');
                    if (manifestMatches) {
                        manifestMatches.slice(0, 10).forEach(match => console.log(match));
                    }
                }
            }
        }
        
        // Look for HTML files
        console.log('\n=== HTML/XHTML Files ===');
        const htmlFiles = files.filter(f => f.match(/\.(html|xhtml|htm)$/i));
        htmlFiles.forEach(f => console.log(f));
        
        // Sample content from first HTML file
        if (htmlFiles.length > 0) {
            const firstHtml = await zip.file(htmlFiles[0])?.async('text');
            if (firstHtml) {
                console.log(`\n=== Sample Content from ${htmlFiles[0]} (first 500 chars) ===`);
                console.log(firstHtml.substring(0, 500));
            }
            
            // Try a content file from text directory
            const textFiles = htmlFiles.filter(f => f.startsWith('text/'));
            if (textFiles.length > 0) {
                const textHtml = await zip.file(textFiles[0])?.async('text');
                if (textHtml) {
                    console.log(`\n=== Sample Content from ${textFiles[0]} (first 1000 chars) ===`);
                    console.log(textHtml.substring(0, 1000));
                }
            }
        }
        
    } catch (error) {
        console.error('Error analyzing EPUB:', error);
    }
}

// Run the analysis
const epubPath = '/Users/kabdellah/dev/osl-native/books/Black Reconstruction in America_ Toward a - W. E. B. Du Bois.epub';
analyzeEPUB(epubPath);
