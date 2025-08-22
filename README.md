# OSL Native - Document Highlighting & Annotation Web App

A mobile-optimized web app for viewing PDF and EPUB documents with highlighting and annotation capabilities.

## Features

- **Document Library**: Add and manage PDF and EPUB documents
- **Text Highlighting**: Click on text spans to create persistent highlights
- **Annotations**: Add notes and comments to highlighted text
- **Persistent Storage**: All highlights and annotations are saved in browser localStorage
- **Mobile Optimized**: Built specifically for mobile web browsers with touch-friendly interface

## Architecture

### Core Components

1. **App.tsx** - Main application component managing state and navigation
2. **DocumentPicker.tsx** - Document library and file picker interface
3. **DocumentViewer.tsx** - Main document viewing component
4. **HighlightableText.tsx** - Text component with highlighting capabilities
5. **PDFViewer.tsx** - PDF document viewer (placeholder for now)
6. **AnnotationPanel.tsx** - Bottom panel for creating/editing annotations

### Data Flow

1. **Document Selection**: User selects a document from the library
2. **Text Selection**: User clicks words to create text selections
3. **Highlight Creation**: Selected text is saved as a highlight
4. **Annotation Management**: Users can add notes to highlights
5. **Persistence**: All data is stored in browser localStorage

### Storage Structure

```typescript
// Types
interface Highlight {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
  pageNumber?: number;
  documentId: string;
  createdAt: string;
  color?: string;
}

interface Annotation {
  id: string;
  highlightId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

interface Document {
  id: string;
  name: string;
  path: string;
  type: 'pdf' | 'epub';
  createdAt: string;
  lastOpened: string;
}
```

## Usage

### Adding Documents

1. Click "Sample" for a demo text document
2. Click "Add Document" to upload text files
3. Documents appear in the library with last opened dates

### Creating Highlights

1. Open a document
2. Click on a word to start selection
3. Click on another word to complete the selection
4. The annotation panel will appear
5. Add a note (optional) and click "Save Highlight"

### Managing Annotations

1. Click on existing highlighted text
2. View existing annotations
3. Add new annotations with "+ Add Note"
4. Delete annotations or entire highlights

### Text Selection Behavior

- **Single click**: Start/end text selection
- **Click highlighted text**: Open annotation panel
- **Selection range**: From first clicked word to second clicked word

## Technical Implementation

### Text Highlighting

The `HighlightableText` component splits text into individual words and tracks:
- Word positions and indices
- Current selection state
- Existing highlights from localStorage
- User click interactions

### Annotation System

- **Bottom-up approach**: Annotations are linked to highlights
- **Persistent storage**: All data survives browser sessions
- **Real-time updates**: UI reflects storage changes immediately

### File Handling

- **PDF Support**: Placeholder implementation (requires additional setup)
- **Text/EPUB**: Full highlighting and annotation support
- **Local Storage**: Documents and metadata stored in browser localStorage
- **File Upload**: Browser file picker for text document uploads

## Development Notes

### Dependencies

- React Native Web
- Expo SDK 53
- TypeScript
- Browser localStorage API

### Web Considerations

- Uses browser localStorage for persistence
- Optimized for mobile web browsers
- Touch-friendly interface with proper spacing
- Responsive design for various screen sizes

### Future Enhancements

1. **PDF Integration**: Full PDF rendering with PDF.js
2. **EPUB Parser**: Proper EPUB file parsing and styling
3. **Cloud Sync**: Sync highlights across devices
4. **Search**: Search within documents and annotations
5. **Export**: Export highlights and annotations
6. **PWA Features**: Install as Progressive Web App

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the web app:
   ```bash
   npm start
   ```

3. Open in your browser at `http://localhost:19006`

4. Test with the sample document to try highlighting features

5. Upload your own text files using the document picker

## Mobile Web Testing

To test on mobile devices:

1. Start the development server:
   ```bash
   npm run web
   ```

2. Find your local IP address and access the app at:
   ```
   http://YOUR_IP_ADDRESS:19006
   ```

3. Test on your mobile device's browser

The app provides a solid foundation for document annotation optimized for mobile web browsers with room for extensive customization and feature expansion.
