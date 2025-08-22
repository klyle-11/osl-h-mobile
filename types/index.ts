export interface Document {
  id: string;
  title: string;
  name?: string;
  path?: string;
  content: string;
  type: 'text' | 'pdf' | 'epub';
  createdAt: Date;
  lastModified: Date;
  lastOpened?: Date;
}

export interface Highlight {
  id: string;
  documentId: string;
  startIndex: number;
  endIndex: number;
  text: string;
  color: string;
  createdAt: Date;
  // EPUB-specific canonical locator for robust re-highlighting
  cfi?: string;
}

export interface Annotation {
  id: string;
  highlightId: string;
  content: string;
  text?: string; // For backward compatibility
  createdAt: Date;
  lastModified: Date;
}

export interface TextSelection {
  text: string;
  startIndex: number;
  endIndex: number;
  pageNumber?: number;
  // EPUB CFI for precise location from epub.js/react-reader
  cfi?: string;
}

export interface ParsedEPUBContent {
  title: string;
  author?: string;
  text: string;
}
