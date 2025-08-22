import { Observable, from, map, switchMap, tap, catchError, throwError, BehaviorSubject } from 'rxjs';

export interface FilePickResult {
    uri: string;
    name: string;
    type: string;
    size: number;
}

export interface FileUploadProgress {
    stage: 'selecting' | 'reading' | 'processing' | 'complete' | 'error';
    message: string;
    progress: number;
    bytesProcessed?: number;
    totalBytes?: number;
}

class FileHandlerService {
    private uploadProgressSubject = new BehaviorSubject<FileUploadProgress>({
        stage: 'selecting',
        message: 'Ready to select file...',
        progress: 0
    });

    public uploadProgress$ = this.uploadProgressSubject.asObservable();

    pickFile(): Observable<FilePickResult> {
        this.uploadProgressSubject.next({
            stage: 'selecting',
            message: 'Select a file...',
            progress: 0
        });

        return new Observable<FilePickResult>(observer => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pdf,.epub,.txt,text/plain,application/pdf';
            
            input.onchange = (event) => {
                const file = (event.target as HTMLInputElement).files?.[0];
                if (file) {
                    this.uploadProgressSubject.next({
                        stage: 'reading',
                        message: 'Reading file...',
                        progress: 25,
                        totalBytes: file.size
                    });

                    this.processFile(file).subscribe({
                        next: result => {
                            this.uploadProgressSubject.next({
                                stage: 'complete',
                                message: 'File processed successfully!',
                                progress: 100,
                                bytesProcessed: file.size,
                                totalBytes: file.size
                            });
                            observer.next(result);
                            observer.complete();
                        },
                        error: error => {
                            this.uploadProgressSubject.next({
                                stage: 'error',
                                message: `Error: ${error.message}`,
                                progress: 0
                            });
                            observer.error(error);
                        }
                    });
                } else {
                    observer.next(null as any);
                    observer.complete();
                }
            };
            
            input.oncancel = () => {
                observer.next(null as any);
                observer.complete();
            };
            
            input.click();
        });
    }

    private processFile(file: File): Observable<FilePickResult> {
        this.uploadProgressSubject.next({
            stage: 'processing',
            message: 'Processing file...',
            progress: 50,
            bytesProcessed: file.size / 2,
            totalBytes: file.size
        });

        return new Observable<FilePickResult>(observer => {
            const reader = new FileReader();
            
            reader.onprogress = (e) => {
                if (e.lengthComputable) {
                    const progress = 50 + Math.round((e.loaded / e.total) * 40);
                    this.uploadProgressSubject.next({
                        stage: 'processing',
                        message: 'Processing file data...',
                        progress,
                        bytesProcessed: e.loaded,
                        totalBytes: e.total
                    });
                }
            };
            
            reader.onload = (e) => {
                const result: FilePickResult = {
                    uri: e.target?.result as string,
                    name: file.name,
                    type: file.type || this.inferFileType(file.name),
                    size: file.size
                };
                observer.next(result);
                observer.complete();
            };
            
            reader.onerror = () => {
                observer.error(new Error('Failed to read file'));
            };
            
            // Choose appropriate reading method based on file type
            if (file.name.endsWith('.pdf') || file.name.endsWith('.epub')) {
                reader.readAsDataURL(file);
            } else {
                reader.readAsText(file);
            }
        });
    }

    private inferFileType(filename: string): string {
        if (filename.endsWith('.epub')) return 'application/epub+zip';
        if (filename.endsWith('.pdf')) return 'application/pdf';
        if (filename.endsWith('.txt')) return 'text/plain';
        return 'application/octet-stream';
    }
}

export const fileHandlerService = new FileHandlerService();
