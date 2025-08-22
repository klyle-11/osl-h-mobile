// Web file picker implementation
export const pickFile = async () => {
    return new Promise<{uri: string; name: string; type: string} | null>((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,.epub,.txt,text/plain,application/pdf';
        
        input.onchange = (event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    resolve({
                        uri: e.target?.result as string,
                        name: file.name,
                        type: file.type || (file.name.endsWith('.epub') ? 'application/epub+zip' : 'text/plain')
                    });
                };
                
                // Handle different file types appropriately
                if (file.name.endsWith('.pdf')) {
                    reader.readAsDataURL(file);
                } else if (file.name.endsWith('.epub')) {
                    reader.readAsDataURL(file); // Read as data URL for EPUB files
                } else {
                    reader.readAsText(file);
                }
            } else {
                resolve(null);
            }
        };
        
        input.oncancel = () => resolve(null);
        input.click();
    });
};